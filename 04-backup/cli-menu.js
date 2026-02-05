#!/usr/bin/env node
/**
 * Backup CLI - Interactive Menu
 *
 * Usage:
 *   npm run backup:cli           # Menu interativo
 *   npm run backup:cli list      # Listar backups
 *   npm run backup:cli restore   # Informacoes sobre restauracao
 */

const { color } = require('./utils');
const { validateGitHubConfig } = require('./github');
const {
  cmdList,
  mainMenu,
  showHelp,
  showRestoreInfo,
} = require('./commands');

function parseCommand() {
  const args = process.argv.slice(2);
  return args[0] || 'menu';
}

async function main() {
  validateGitHubConfig();

  const command = parseCommand();

  switch (command) {
    case 'list':
    case 'ls':
      await cmdList();
      break;

    case 'restore':
      showRestoreInfo();
      break;

    case 'menu':
    case '':
      await mainMenu();
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      console.log(color(`Comando desconhecido: ${command}`, 'red'));
      console.log('Use: npm run backup:cli help');
  }
}

main().catch((error) => {
  console.error(color(`\nErro fatal: ${error.message}`, 'red'));
  process.exit(1);
});
