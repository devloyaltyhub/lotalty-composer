/**
 * Prompt utilities for Shorebird CLI
 * Handles user input and menu display
 */

const readline = require('readline');
const { log } = require('./log-utils');
const { getCurrentVersion } = require('./version-utils');

/**
 * Create readline interface for user input
 * @returns {readline.Interface}
 */
function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask user a question
 * @param {readline.Interface} rl - Readline interface
 * @param {string} question - Question to ask
 * @returns {Promise<string>}
 */
function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Show main menu and get user choice
 * @returns {Promise<string>}
 */
async function showMenu() {
  const rl = createPrompt();

  console.log('');
  log.title('Shorebird OTA Updates');

  const currentVersion = getCurrentVersion();
  if (currentVersion) {
    log.info(`Versao atual: ${currentVersion}`);
  }

  console.log('');
  console.log('  1. Criar Release (para submissao na store)');
  console.log('  2. Criar Patch (correcao OTA sem passar pela store)');
  console.log('  3. Abrir Console Shorebird (ver releases/patches)');
  console.log('  4. Verificar Instalacao (shorebird doctor)');
  console.log('  0. Sair');
  console.log('');

  const choice = await ask(rl, 'Escolha uma opcao: ');
  rl.close();

  return choice;
}

/**
 * Get platform choice from user
 * @returns {Promise<string|null>}
 */
async function getPlatform() {
  const rl = createPrompt();

  console.log('');
  console.log('  1. Android');
  console.log('  2. iOS');
  console.log('  3. Ambos');
  console.log('');

  const choice = await ask(rl, 'Plataforma: ');
  rl.close();

  switch (choice) {
    case '1':
      return 'android';
    case '2':
      return 'ios';
    case '3':
      return 'both';
    default:
      return null;
  }
}

/**
 * Wait for user to press Enter
 * @returns {Promise<void>}
 */
async function waitForEnter() {
  const rl = createPrompt();
  await ask(rl, 'Pressione Enter para continuar...');
  rl.close();
}

module.exports = {
  createPrompt,
  ask,
  showMenu,
  getPlatform,
  waitForEnter,
};
