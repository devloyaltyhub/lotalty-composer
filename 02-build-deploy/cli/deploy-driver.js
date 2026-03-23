#!/usr/bin/env node

/**
 * Deploy Driver CLI
 *
 * Build and deploy loyalty-driver to Google Play Store.
 *
 * Usage:
 *   node deploy-driver.js                    # Interactive mode
 *   node deploy-driver.js --build-only       # Build without deploying
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');

const { loadEnvWithExpansion } = require('../../01-client-setup/shared/env-loader');
loadEnvWithExpansion(__dirname);

const logger = require('../../shared/utils/logger');
const { LOYALTY_DRIVER_ROOT, FASTLANE_DIR } = require('../../shared/utils/paths');

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    buildOnly: args.includes('--build-only'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function showHelp() {
  console.log(`
  Deploy Driver - Build and deploy loyalty-driver to Google Play Store

  Usage:
    npm run deploy-driver              Interactive mode
    npm run deploy-driver -- --build-only

  Options:
    --build-only        Build APK/AAB without deploying
    --help, -h          Show this help
  `);
}

function exec(cmd, opts = {}) {
  const { silent = false, cwd = LOYALTY_DRIVER_ROOT } = opts;
  return execSync(cmd, {
    cwd,
    stdio: silent ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
}

function getVersionInfo() {
  const pubspecPath = path.join(LOYALTY_DRIVER_ROOT, 'pubspec.yaml');
  const pubspec = fs.readFileSync(pubspecPath, 'utf8');
  const match = pubspec.match(/^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)/m);

  if (!match) {
    throw new Error('Version not found in pubspec.yaml');
  }

  return {
    version: match[1],
    buildNumber: parseInt(match[2], 10),
    full: `${match[1]}+${match[2]}`,
  };
}

function incrementBuildNumber() {
  const pubspecPath = path.join(LOYALTY_DRIVER_ROOT, 'pubspec.yaml');
  let pubspec = fs.readFileSync(pubspecPath, 'utf8');
  const info = getVersionInfo();
  const next = info.buildNumber + 1;
  pubspec = pubspec.replace(
    /^version:\s*[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+/m,
    `version: ${info.version}+${next}`,
  );
  fs.writeFileSync(pubspecPath, pubspec, 'utf8');
  return `${info.version}+${next}`;
}

function checkPrerequisites() {
  if (!fs.existsSync(LOYALTY_DRIVER_ROOT)) {
    throw new Error(`loyalty-driver not found at ${LOYALTY_DRIVER_ROOT}`);
  }

  const keyProps = path.join(LOYALTY_DRIVER_ROOT, 'android', 'key.properties');
  if (!fs.existsSync(keyProps)) {
    throw new Error('android/key.properties not found. Configure signing first.');
  }
}

async function buildAndroid() {
  logger.info('Building Android AAB...');
  exec('flutter pub get');
  exec('flutter build appbundle --release');
  logger.success('Android AAB built successfully');
}

async function deployToPlayStore() {
  logger.info('Deploying to Play Store (internal track)...');
  exec('fastlane driver_android_deploy_internal', { cwd: FASTLANE_DIR });
  logger.success('Deployed to Play Store internal track');
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  logger.section('Driver App Deploy');

  try {
    checkPrerequisites();

    const versionInfo = getVersionInfo();
    logger.keyValue('Versao atual', versionInfo.full);

    const action = args.buildOnly
      ? 'build-only'
      : (
          await inquirer.prompt([
            {
              type: 'list',
              name: 'action',
              message: 'O que deseja fazer?',
              choices: [
                { name: 'Build e Deploy (Play Store internal)', value: 'full' },
                { name: 'Apenas Build (AAB)', value: 'build-only' },
              ],
            },
          ])
        ).action;

    if (action === 'full') {
      const nextVersion = incrementBuildNumber();
      logger.keyValue('Nova versao', nextVersion);

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Build e deploy do Driver v${nextVersion}?`,
          default: true,
        },
      ]);

      if (!confirm) {
        logger.info('Cancelado');
        process.exit(0);
      }

      await buildAndroid();
      await deployToPlayStore();

      exec(`git add pubspec.yaml && git commit -m "chore: bump driver to v${nextVersion}"`);
      logger.success(`Deploy concluido! Driver v${nextVersion}`);
    } else {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Build do Driver v${versionInfo.full}? (sem incremento)`,
          default: true,
        },
      ]);

      if (!confirm) {
        logger.info('Cancelado');
        process.exit(0);
      }

      await buildAndroid();
      logger.success(`Build concluido! AAB em build/app/outputs/bundle/release/`);
    }

    process.exit(0);
  } catch (error) {
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  }
}

main();
