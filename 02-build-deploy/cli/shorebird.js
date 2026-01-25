#!/usr/bin/env node
/**
 * Shorebird OTA Updates CLI
 * Manage Shorebird releases and patches for OTA updates
 */

const { log } = require('./shorebird/log-utils');
const {
  isShorebirdInstalled,
  isShorebirdConfigured,
} = require('./shorebird/shorebird-runner');
const { showMenu, waitForEnter } = require('./shorebird/prompt-utils');
const {
  createRelease,
  createPatch,
  openConsole,
  runDoctor,
  showHelp,
} = require('./shorebird/commands');

/**
 * Check prerequisites before running
 */
function checkPrerequisites() {
  if (!isShorebirdInstalled()) {
    log.error('Shorebird CLI nao esta instalado');
    log.info('Instale com:');
    console.log(
      '  curl --proto "=https" --tlsv1.2 https://raw.githubusercontent.com/shorebirdtech/install/main/install.sh -sSf | bash'
    );
    process.exit(1);
  }

  const configCheck = isShorebirdConfigured();
  if (!configCheck.configured) {
    log.error(`Shorebird nao esta configurado: ${configCheck.reason}`);
    log.info('Para configurar, execute:');
    console.log('  cd white_label_app && shorebird init');
    process.exit(1);
  }
}

/**
 * Handle command line arguments
 * @param {string} command - Command to execute
 * @returns {Promise<boolean>} - True if command was handled
 */
async function handleCommand(command) {
  switch (command) {
    case 'release':
      await createRelease();
      return true;
    case 'patch':
      await createPatch();
      return true;
    case 'console':
      await openConsole();
      return true;
    case 'doctor':
      await runDoctor();
      return true;
    case 'help':
      showHelp();
      return true;
    default:
      return false;
  }
}

/**
 * Handle interactive menu choice
 * @param {string} choice - Menu choice
 * @returns {Promise<boolean>} - True to continue loop, false to exit
 */
async function handleMenuChoice(choice) {
  switch (choice) {
    case '1':
      await createRelease();
      return true;
    case '2':
      await createPatch();
      return true;
    case '3':
      await openConsole();
      return true;
    case '4':
      await runDoctor();
      return true;
    case '0':
      log.info('Ate mais!');
      return false;
    default:
      log.warn('Opcao invalida');
      return true;
  }
}

/**
 * Run interactive menu loop
 */
async function runInteractiveMenu() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const choice = await showMenu();

    try {
      const shouldContinue = await handleMenuChoice(choice);
      if (!shouldContinue) {
        process.exit(0);
      }
    } catch (error) {
      log.error(`Erro: ${error.message}`);
    }

    console.log('');
    await waitForEnter();
  }
}

/**
 * Main entry point
 */
async function main() {
  checkPrerequisites();

  const args = process.argv.slice(2);
  const command = args[0];

  if (command) {
    const handled = await handleCommand(command);
    if (!handled) {
      log.error(`Comando desconhecido: ${command}`);
      process.exit(1);
    }
    return;
  }

  await runInteractiveMenu();
}

if (require.main === module) {
  main().catch((error) => {
    log.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  createRelease,
  createPatch,
  openConsole,
  runDoctor,
};
