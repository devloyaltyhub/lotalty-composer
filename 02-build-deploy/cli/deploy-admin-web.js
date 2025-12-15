#!/usr/bin/env node

/**
 * Deploy Admin Web CLI
 *
 * Build Flutter Web and deploy loyalty-admin-main to GitHub Pages.
 *
 * Usage:
 *   node deploy-admin-web.js                    # Interactive mode
 *   node deploy-admin-web.js --build-only       # Build without deploying
 *   node deploy-admin-web.js --skip-build       # Deploy existing build
 *   node deploy-admin-web.js --message="..."    # Custom commit message
 */

const path = require('path');
const inquirer = require('inquirer');

// Load environment variables
const { loadEnvWithExpansion } = require('../../01-client-setup/shared/env-loader');
loadEnvWithExpansion(__dirname);

const logger = require('../../shared/utils/logger');
const AdminWebBuilder = require('../admin-web-builder');

/**
 * Parse CLI arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    buildOnly: args.includes('--build-only'),
    skipBuild: args.includes('--skip-build'),
    message: args.find(a => a.startsWith('--message='))?.split('=').slice(1).join('='),
    help: args.includes('--help') || args.includes('-h'),
  };
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
  Deploy Admin Web - Build and deploy loyalty-admin-main to GitHub Pages

  Usage:
    npm run deploy-admin-web              Interactive mode
    npm run deploy-admin-web -- --build-only
    npm run deploy-admin-web -- --skip-build
    npm run deploy-admin-web -- --message="Custom commit message"

  Options:
    --build-only        Build without deploying to GitHub
    --skip-build        Deploy existing build (skip flutter build)
    --message="..."     Custom commit message
    --help, -h          Show this help

  Deploy Target:
    Repository: devloyaltyhub.github.io
    URL: https://devloyaltyhub.github.io
  `);
}

/**
 * Prompt for action
 */
async function promptAction() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'O que deseja fazer?',
      choices: [
        { name: 'Build e Deploy completo', value: 'full' },
        { name: 'Apenas Build (sem deploy)', value: 'build-only' },
        { name: 'Apenas Deploy (usar build existente)', value: 'skip-build' },
      ],
    },
  ]);
  return action;
}

/**
 * Prompt for custom commit message
 */
async function promptCommitMessage(defaultMessage) {
  const { useCustom } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useCustom',
      message: 'Deseja usar uma mensagem de commit customizada?',
      default: false,
    },
  ]);

  if (!useCustom) {
    return null;
  }

  const { message } = await inquirer.prompt([
    {
      type: 'input',
      name: 'message',
      message: 'Mensagem de commit:',
      default: defaultMessage,
    },
  ]);

  return message;
}

/**
 * Main function
 */
async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  logger.section('Admin Web Deploy');

  const builder = new AdminWebBuilder();

  try {
    // Check prerequisites first
    builder.checkPrerequisites();

    // Get version info
    const versionInfo = builder.getVersionInfo();
    logger.keyValue('Versao atual', versionInfo.full);
    logger.keyValue('Destino', 'https://devloyaltyhub.github.io');

    // Determine action
    let action;
    if (args.buildOnly) {
      action = 'build-only';
    } else if (args.skipBuild) {
      action = 'skip-build';
    } else {
      action = await promptAction();
    }

    // Handle build-only
    if (action === 'build-only') {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Iniciar build do Admin Web v${versionInfo.full}?`,
          default: true,
        },
      ]);

      if (!confirm) {
        logger.info('Cancelado');
        process.exit(0);
      }

      await builder.buildOnly();
      process.exit(0);
    }

    // Handle full deploy or skip-build
    const skipBuild = action === 'skip-build';

    // Get commit message
    const date = new Date().toISOString().split('T')[0];
    const defaultMessage = `Deploy Admin Web v${versionInfo.full} - ${date}`;
    const message = args.message || await promptCommitMessage(defaultMessage);

    // Confirm
    const actionText = skipBuild ? 'deploy (sem build)' : 'build e deploy';
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Iniciar ${actionText} do Admin Web v${versionInfo.full}?`,
        default: true,
      },
    ]);

    if (!confirm) {
      logger.info('Cancelado');
      process.exit(0);
    }

    // Execute
    await builder.buildAndDeploy({ skipBuild, message });

    logger.blank();
    logger.success('Deploy concluido! Acesse: https://devloyaltyhub.github.io');

    process.exit(0);

  } catch (error) {
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  }
}

main();
