#!/usr/bin/env node

const fs = require('fs');
const { WHITE_LABEL_APP_ROOT, WHITE_LABEL_PUBSPEC } = require('../utils/paths');

// Cores para output
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

function checkFlutterProject() {
  const flutterProjectPath = WHITE_LABEL_APP_ROOT;

  if (!fs.existsSync(flutterProjectPath)) {
    log('❌ Projeto Flutter não encontrado em white_label_app/', 'red');
    process.exit(1);
  }

  const pubspecPath = WHITE_LABEL_PUBSPEC;
  if (!fs.existsSync(pubspecPath)) {
    log('❌ pubspec.yaml não encontrado no projeto Flutter', 'red');
    process.exit(1);
  }

  return flutterProjectPath;
}

function runUnusedFilesCheck(_flutterProjectPath) {
  // dart_code_metrics foi removido do projeto
  // Esta verificação agora é um no-op que sempre retorna sucesso
  log('⏭️  Verificação de arquivos não utilizados pulada (dart_code_metrics removido)', 'yellow');
  return true;
}

function main() {
  log('🚀 Iniciando verificação de arquivos não utilizados...', 'bold');

  const originalCwd = process.cwd();

  try {
    const flutterProjectPath = checkFlutterProject();
    const success = runUnusedFilesCheck(flutterProjectPath);

    // Volta para o diretório original
    process.chdir(originalCwd);

    if (success) {
      log('\n✅ Todas as verificações passaram! Commit pode prosseguir.', 'green');
      process.exit(0);
    } else {
      log('\n❌ Verificação falhou! Commit bloqueado.', 'red');
      process.exit(1);
    }
  } catch (error) {
    // Volta para o diretório original em caso de erro
    process.chdir(originalCwd);

    log(`❌ Erro inesperado: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Executa apenas se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = { main, checkFlutterProject, runUnusedFilesCheck };
