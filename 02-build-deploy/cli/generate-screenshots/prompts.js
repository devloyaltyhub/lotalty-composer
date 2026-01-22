/**
 * CLI Prompts for Screenshot Generation
 *
 * Handles all user interaction for the screenshot generator CLI.
 */

const inquirer = require('inquirer');
const logger = require('../../../shared/utils/logger');
const clientSelector = require('../../../shared/utils/client-selector');

/**
 * Prompt user to confirm regeneration when screenshots already exist
 * @param {Object} existingCheck - Result from checkExistingScreenshots
 * @returns {Promise<boolean>} Whether to proceed with regeneration
 */
async function promptRegenerateConfirmation(existingCheck) {
  logger.warn(`Screenshots ja existentes encontrados (${existingCheck.total} arquivos):`);
  for (const { platform, count } of existingCheck.details) {
    logger.keyValue(`  ${platform}`, `${count} screenshots`);
  }
  logger.blank();

  const { shouldRegenerate } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldRegenerate',
      message: 'Deseja gerar novos screenshots? (Este processo e demorado)',
      default: false,
    },
  ]);

  return shouldRegenerate;
}

/**
 * Prompt user to select a client
 * @returns {Promise<string>} Selected client code
 */
async function promptClientSelection() {
  const clientNames = clientSelector.listClients();

  if (clientNames.length === 0) {
    logger.error('Nenhum cliente encontrado em clients/');
    process.exit(1);
  }

  const clients = clientNames.map((name) => {
    try {
      const config = clientSelector.loadClientConfig(name);
      return {
        name: `${config.clientName || name} (${config.clientCode || name})`,
        value: name,
      };
    } catch {
      return { name, value: name };
    }
  });

  const { selectedClient } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedClient',
      message: 'Selecione o cliente:',
      choices: clients,
    },
  ]);

  return selectedClient;
}

/**
 * Prompt user for pipeline options
 * @returns {Promise<Object>} Pipeline options
 */
async function promptPipelineOptions() {
  const defaultOptions = {
    deviceChoice: 1,
    gradientChoice: 0,
    angleChoice: 2,
    addLogo: true,
  };

  const { useDefaults } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useDefaults',
      message: 'Usar configuracoes padrao para mockups?',
      default: true,
    },
  ]);

  if (useDefaults) {
    return defaultOptions;
  }

  const customOptions = await inquirer.prompt([
    {
      type: 'number',
      name: 'deviceChoice',
      message: 'Device choice (1=iPhone, 2=Pixel):',
      default: 1,
    },
    {
      type: 'number',
      name: 'gradientChoice',
      message: 'Gradient (0=Cor Cliente, 1=Purple, 2=Blue, 3=Orange, 4=Green, 5=Dark, 6=Red):',
      default: 0,
    },
    {
      type: 'number',
      name: 'angleChoice',
      message: 'Angle choice (1=15, 2=20, 3=25):',
      default: 2,
    },
    {
      type: 'confirm',
      name: 'addLogo',
      message: 'Adicionar logo no rodape dos mockups?',
      default: true,
    },
  ]);

  return { ...defaultOptions, ...customOptions };
}

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    clientCode: args.find((arg) => arg.startsWith('--client='))?.split('=')[1],
    help: args.includes('--help') || args.includes('-h'),
  };
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
  Generate Screenshots - Captura screenshots para App Store e Play Store

  Usage:
    node generate-screenshots.js
    node generate-screenshots.js --client=demo

  Options:
    --client=<code>     Client code (skip selection prompt)
    --help, -h          Show this help
  `);
}

module.exports = {
  promptRegenerateConfirmation,
  promptClientSelection,
  promptPipelineOptions,
  parseArgs,
  showHelp,
};
