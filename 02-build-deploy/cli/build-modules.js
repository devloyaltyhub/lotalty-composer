#!/usr/bin/env node

/**
 * Build Modules CLI
 *
 * Build all loyalty_modules Node packages and optionally sync to cloud-service.
 *
 * Usage:
 *   node build-modules.js                  # Build all + sync to cloud-service
 *   node build-modules.js --build-only     # Build without syncing
 *   node build-modules.js --check          # Check if dists are up-to-date
 *   node build-modules.js --sync-only      # Just copy dists to cloud-service
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const logger = require('../../shared/utils/logger');
const { LOYALTYHUB_ROOT, LOYALTY_CLOUD_SERVICE_ROOT } = require('../../shared/utils/paths');

// =============================================================================
// MODULE DEFINITIONS
// =============================================================================

const MODULES_BASE = path.join(LOYALTYHUB_ROOT, 'loyalty_modules', 'cloud', 'node');

const MODULES = [
  'loyalty_ai',
  'loyalty_backup',
  'loyalty_events',
  'loyalty_health',
  'loyalty_insights_engine',
  'loyalty_notifications',
  'loyalty_pdv',
  'loyalty_reports',
];

// =============================================================================
// HELPERS
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    buildOnly: args.includes('--build-only'),
    check: args.includes('--check'),
    syncOnly: args.includes('--sync-only'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function showHelp() {
  console.log(`
  Build Modules - Build e sync dos loyalty_modules Node packages

  Usage:
    npm run build-modules                   Build all + sync para cloud-service
    npm run build-modules -- --build-only   Build sem sync
    npm run build-modules -- --check        Verificar se dists estao atualizados
    npm run build-modules -- --sync-only    Apenas copiar dists para cloud-service

  Modules: ${MODULES.join(', ')}
  `);
}

/**
 * Check if a module's dist is older than its src
 */
function isDistStale(moduleName) {
  const moduleDir = path.join(MODULES_BASE, moduleName);
  const srcDir = path.join(moduleDir, 'src');
  const distDir = path.join(moduleDir, 'dist');

  if (!fs.existsSync(distDir)) {
    return { stale: true, reason: 'dist/ nao existe' };
  }

  if (!fs.existsSync(srcDir)) {
    return { stale: false, reason: 'sem src/' };
  }

  const getNewestMtime = (baseDir) => {
    let newest = 0;
    const walk = (currentDir) => {
      if (!fs.existsSync(currentDir)) return;
      for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const full = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          const mtime = fs.statSync(full).mtimeMs;
          if (mtime > newest) newest = mtime;
        }
      }
    };
    walk(baseDir);
    return newest;
  };

  const srcNewest = getNewestMtime(srcDir);
  const distNewest = getNewestMtime(distDir);

  if (srcNewest > distNewest) {
    return { stale: true, reason: 'src/ mais recente que dist/' };
  }

  return { stale: false, reason: 'atualizado' };
}

/**
 * Build a single module
 */
function buildModule(moduleName) {
  const moduleDir = path.join(MODULES_BASE, moduleName);

  if (!fs.existsSync(moduleDir)) {
    logger.warn(`${moduleName}: diretorio nao encontrado, pulando`);
    return false;
  }

  const pkgPath = path.join(moduleDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    logger.warn(`${moduleName}: package.json nao encontrado, pulando`);
    return false;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  if (!pkg.scripts || !pkg.scripts.build) {
    logger.warn(`${moduleName}: sem script de build, pulando`);
    return false;
  }

  try {
    execSync('npm run build', {
      cwd: moduleDir,
      stdio: 'pipe',
      shell: '/bin/zsh',
    });
    logger.success(`${moduleName}: build OK`);
    return true;
  } catch (error) {
    logger.error(`${moduleName}: build falhou`);
    if (error.stderr) {
      console.error(error.stderr.toString());
    }
    return false;
  }
}

/**
 * Sync modules to cloud-service (runs copy-packages)
 */
function syncToCloudService() {
  logger.info('Sincronizando modulos para loyalty-cloud-service...');
  try {
    execSync('npm run copy-packages', {
      cwd: LOYALTY_CLOUD_SERVICE_ROOT,
      stdio: 'inherit',
      shell: '/bin/zsh',
    });
    logger.success('Sync para cloud-service OK');
    return true;
  } catch {
    logger.error('Sync para cloud-service falhou');
    return false;
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  logger.section('Build Modules');

  // Check mode: just report stale status
  if (args.check) {
    logger.info('Verificando status dos modulos...');
    let hasStale = false;

    for (const mod of MODULES) {
      const { stale, reason } = isDistStale(mod);
      if (stale) {
        logger.warn(`${mod}: DESATUALIZADO (${reason})`);
        hasStale = true;
      } else {
        logger.success(`${mod}: ${reason}`);
      }
    }

    if (hasStale) {
      logger.blank();
      logger.warn('Existem modulos desatualizados. Execute: npm run build-modules');
      process.exit(1);
    } else {
      logger.blank();
      logger.success('Todos os modulos estao atualizados');
      process.exit(0);
    }
  }

  // Sync-only mode
  if (args.syncOnly) {
    const ok = syncToCloudService();
    process.exit(ok ? 0 : 1);
  }

  // Build all modules
  logger.info(`Building ${MODULES.length} modulos...`);
  const results = [];

  for (const mod of MODULES) {
    const success = buildModule(mod);
    results.push({ module: mod, success });
  }

  // Summary
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  logger.blank();
  logger.info(`Build: ${successCount} OK, ${failCount} falhas`);

  // Sync to cloud-service unless build-only
  if (!args.buildOnly && failCount === 0) {
    logger.blank();
    syncToCloudService();
  } else if (failCount > 0) {
    logger.warn('Sync pulado devido a falhas no build');
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main();
