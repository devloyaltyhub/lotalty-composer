#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  LOYALTYHUB_ROOT,
  WHITE_LABEL_APP_ROOT,
  WHITE_LABEL_PUBSPEC,
  LOYALTY_ADMIN_ROOT,
} = require('../utils/paths');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getFlutterProjects() {
  const projects = [
    { name: 'loyalty_core', path: path.join(LOYALTYHUB_ROOT, 'loyalty_core') },
    { name: 'loyalty-app', path: WHITE_LABEL_APP_ROOT },
    { name: 'loyalty-admin-main', path: LOYALTY_ADMIN_ROOT },
    {
      name: 'loyalty_delivery',
      path: path.join(LOYALTYHUB_ROOT, 'loyalty_modules/admin/flutter/loyalty_delivery'),
    },
    {
      name: 'loyalty_payment',
      path: path.join(LOYALTYHUB_ROOT, 'loyalty_modules/mobile/flutter/loyalty_payment'),
    },
    {
      name: 'loyalty_payment_core',
      path: path.join(LOYALTYHUB_ROOT, 'loyalty_modules/shared/flutter/loyalty_payment_core'),
    },
    {
      name: 'loyalty_ecommerce',
      path: path.join(LOYALTYHUB_ROOT, 'loyalty_modules/mobile/flutter/loyalty_ecommerce'),
    },
    {
      name: 'loyalty_sales_funnel',
      path: path.join(LOYALTYHUB_ROOT, 'loyalty_modules/shared/flutter/loyalty_sales_funnel'),
    },
  ];

  return projects.filter((p) => fs.existsSync(path.join(p.path, 'pubspec.yaml')));
}

function checkFlutterProject() {
  if (!fs.existsSync(WHITE_LABEL_APP_ROOT)) {
    log('❌ Projeto Flutter não encontrado em white_label_app/', 'red');
    process.exit(1);
  }

  if (!fs.existsSync(WHITE_LABEL_PUBSPEC)) {
    log('❌ pubspec.yaml não encontrado no projeto Flutter', 'red');
    process.exit(1);
  }

  return WHITE_LABEL_APP_ROOT;
}

/**
 * Loads ignored paths from .unused-files-ignore in the project root.
 * Each line is a relative path (e.g. lib/firebase_options.dart).
 * Lines starting with # are comments. Empty lines are skipped.
 */
function loadIgnoredFiles(projectPath) {
  const ignorePath = path.join(projectPath, '.unused-files-ignore');
  if (!fs.existsSync(ignorePath)) return [];

  return fs
    .readFileSync(ignorePath, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function extractUnusedFiles(output, projectPath) {
  return output
    .split('\n')
    .filter((line) => line.includes('unused file:'))
    .map((line) => {
      const match = line.match(/unused file:\s*(.+)/);
      if (!match) return null;
      const fullPath = match[1].trim();
      return path.relative(projectPath, fullPath);
    })
    .filter(Boolean);
}

function runCheckOnProject(project) {
  const libDir = path.join(project.path, 'lib');
  if (!fs.existsSync(libDir)) {
    return { name: project.name, success: true, unusedFiles: [], ignoredCount: 0 };
  }

  const ignoredFiles = loadIgnoredFiles(project.path);

  try {
    const output = execSync('dart run dart_code_linter:metrics check-unused-files lib', {
      cwd: project.path,
      encoding: 'utf-8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const allUnused = extractUnusedFiles(output, project.path);
    const realUnused = allUnused.filter((f) => !ignoredFiles.includes(f));
    const ignoredCount = allUnused.length - realUnused.length;

    return {
      name: project.name,
      success: realUnused.length === 0,
      unusedFiles: realUnused,
      ignoredCount,
    };
  } catch (error) {
    const stdout = error.stdout ? error.stdout.toString() : '';
    const stderr = error.stderr ? error.stderr.toString() : '';
    const combined = (stdout + '\n' + stderr).trim();

    const allUnused = extractUnusedFiles(combined, project.path);
    const realUnused = allUnused.filter((f) => !ignoredFiles.includes(f));
    const ignoredCount = allUnused.length - realUnused.length;

    if (realUnused.length > 0) {
      return { name: project.name, success: false, unusedFiles: realUnused, ignoredCount };
    }

    return { name: project.name, success: true, unusedFiles: [], ignoredCount };
  }
}

function runUnusedFilesCheck() {
  const projects = getFlutterProjects();
  log(`\n📦 Verificando ${projects.length} projetos Flutter...\n`, 'blue');

  let allPassed = true;

  for (const project of projects) {
    log(`  🔍 ${project.name}...`, 'blue');
    const result = runCheckOnProject(project);

    if (!result.success) {
      allPassed = false;
      log(`  ❌ ${project.name}: ${result.unusedFiles.length} arquivo(s) não utilizado(s)`, 'red');
      result.unusedFiles.forEach((f) => log(`     - ${f}`, 'yellow'));
    } else {
      const ignoredMsg = result.ignoredCount > 0 ? ` (${result.ignoredCount} ignorado(s))` : '';
      log(`  ✅ ${project.name}: limpo${ignoredMsg}`, 'green');
    }
  }

  if (!allPassed) {
    log('\n⚠️  Arquivos não utilizados encontrados! Remova-os antes de commitar.', 'yellow');
  }

  return allPassed;
}

function main() {
  log('🚀 Iniciando verificação de arquivos não utilizados (dart_code_linter)...', 'bold');

  const originalCwd = process.cwd();

  try {
    checkFlutterProject();
    const success = runUnusedFilesCheck();

    process.chdir(originalCwd);

    if (success) {
      log('\n✅ Todas as verificações passaram! Commit pode prosseguir.', 'green');
      process.exit(0);
    } else {
      log('\n❌ Verificação falhou! Commit bloqueado.', 'red');
      process.exit(1);
    }
  } catch (error) {
    process.chdir(originalCwd);
    log(`❌ Erro inesperado: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, checkFlutterProject, runUnusedFilesCheck, loadIgnoredFiles };
