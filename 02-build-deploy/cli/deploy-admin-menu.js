#!/usr/bin/env node

/**
 * Deploy Admin Menu CLI
 *
 * Unified menu for deploying loyalty-admin-main to Android (Play Store) and/or Web (GitHub Pages).
 *
 * Usage:
 *   node deploy-admin-menu.js    # Interactive menu
 */

const { spawn } = require('child_process');
const path = require('path');
const inquirer = require('inquirer');
const logger = require('../../shared/utils/logger');

const DEPLOY_SCRIPTS = {
  android: path.join(__dirname, 'deploy-admin.js'),
  web: path.join(__dirname, 'deploy-admin-web.js'),
};

/**
 * Run a deploy script
 */
function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * Main function
 */
async function main() {
  logger.section('Deploy Admin');

  const { platform } = await inquirer.prompt([
    {
      type: 'list',
      name: 'platform',
      message: 'Qual plataforma deseja fazer deploy?',
      choices: [
        { name: '📱 Android (Google Play Store)', value: 'android' },
        { name: '🌐 Web (GitHub Pages)', value: 'web' },
        { name: '🚀 Ambos (Android + Web)', value: 'both' },
      ],
    },
  ]);

  try {
    if (platform === 'android' || platform === 'both') {
      logger.blank();
      await runScript(DEPLOY_SCRIPTS.android);
    }

    if (platform === 'web' || platform === 'both') {
      logger.blank();
      await runScript(DEPLOY_SCRIPTS.web);
    }

    if (platform === 'both') {
      logger.blank();
      logger.success('Deploy completo (Android + Web) finalizado!');
    }

  } catch (error) {
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  }
}

main();
