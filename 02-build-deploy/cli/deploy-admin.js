#!/usr/bin/env node

/**
 * Deploy Admin CLI
 *
 * Build and deploy loyalty-admin-main to Google Play Store.
 * Uses Shorebird for OTA-enabled builds.
 *
 * Usage:
 *   node deploy-admin.js                     # Interactive mode
 *   node deploy-admin.js --track=internal    # Deploy to internal testing
 *   node deploy-admin.js --track=production  # Deploy to production
 *   node deploy-admin.js --version=1.0.0+5   # Set specific version
 *   node deploy-admin.js --build-only        # Build without deploying
 */

const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');

// Load environment variables
const { loadEnvWithExpansion } = require('../../01-client-setup/shared/env-loader');
loadEnvWithExpansion(__dirname);

const logger = require('../../shared/utils/logger');
const AdminBuilder = require('../admin-builder');

/**
 * Parse CLI arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    track: args.find(a => a.startsWith('--track='))?.split('=')[1],
    version: args.find(a => a.startsWith('--version='))?.split('=')[1],
    buildOnly: args.includes('--build-only'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
  Deploy Admin - Build and deploy loyalty-admin-main to Google Play

  Usage:
    npm run deploy-admin              Interactive mode
    npm run deploy-admin -- --track=internal
    npm run deploy-admin -- --track=production
    npm run deploy-admin -- --build-only

  Options:
    --track=<track>     Deploy target: internal | production
    --version=X.Y.Z+B   Set specific version (e.g., 1.0.0+5)
    --build-only        Build without deploying
    --help, -h          Show this help
  `);
}

/**
 * Validate version format
 */
function isValidVersion(version) {
  return /^[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+$/.test(version);
}

/**
 * Prompt for deploy target
 */
async function promptTrack() {
  const { track } = await inquirer.prompt([
    {
      type: 'list',
      name: 'track',
      message: 'Destino do deploy:',
      choices: [
        { name: 'Internal Testing (teste interno)', value: 'internal' },
        { name: 'Production (producao)', value: 'production' },
      ],
    },
  ]);
  return track;
}

/**
 * Prompt for version strategy
 */
async function promptVersion(builder) {
  const current = builder.getVersionInfo();
  const nextBuild = parseInt(current.buildNumber, 10) + 1;
  const autoVersion = `${current.version}+${nextBuild}`;

  logger.keyValue('Versao atual', current.full);

  const { strategy } = await inquirer.prompt([
    {
      type: 'list',
      name: 'strategy',
      message: 'Como definir a versao?',
      choices: [
        { name: `Incrementar automaticamente (${current.full} → ${autoVersion})`, value: 'auto' },
        { name: 'Definir manualmente', value: 'manual' },
      ],
    },
  ]);

  if (strategy === 'auto') {
    return null; // Use auto-increment
  }

  const { manualVersion } = await inquirer.prompt([
    {
      type: 'input',
      name: 'manualVersion',
      message: 'Digite a versao (X.Y.Z+B):',
      validate: input => isValidVersion(input) || 'Formato invalido. Use X.Y.Z+B (ex: 1.0.0+5)',
    },
  ]);

  return manualVersion;
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

  logger.section('Admin Deploy');

  // Validate version arg if provided
  if (args.version && !isValidVersion(args.version)) {
    logger.error(`Formato de versao invalido: ${args.version}`);
    logger.error('Use o formato X.Y.Z+B (ex: 1.0.0+5)');
    process.exit(1);
  }

  const builder = new AdminBuilder();

  try {
    // Check prerequisites first
    builder.checkPrerequisites();

    // Determine track
    let track = args.track;
    if (!track && !args.buildOnly) {
      track = await promptTrack();
    }

    // Determine version
    let version = args.version;
    if (!version) {
      version = await promptVersion(builder);
    }

    // Set version if manual
    if (version) {
      builder.setVersion(version);
    } else {
      builder.incrementBuildNumber();
    }

    const finalVersion = builder.getVersionInfo();
    logger.keyValue('Versao para build', finalVersion.full);

    // Confirm
    const confirmMsg = args.buildOnly
      ? `Iniciar build do Admin v${finalVersion.full}?`
      : `Iniciar deploy do Admin v${finalVersion.full} para ${track}?`;

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: confirmMsg,
        default: true,
      },
    ]);

    if (!confirm) {
      logger.info('Cancelado');
      process.exit(0);
    }

    // Execute
    if (args.buildOnly) {
      builder.buildAndroid();
      logger.success('Build concluido!');
    } else {
      await builder.buildAndDeploy({ track, skipBuild: false });
    }

    process.exit(0);

  } catch (error) {
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  }
}

main();
