#!/usr/bin/env node

/**
 * Deploy Admin Menu CLI
 *
 * Deploys loyalty-admin-main to Web (GitHub Pages).
 * NOTE: Admin is web-only. For mobile admin, use the white-label app.
 *
 * Usage:
 *   node deploy-admin-menu.js    # Deploy to web
 */

const { spawn } = require('child_process');
const path = require('path');
const logger = require('../../shared/utils/logger');

const DEPLOY_SCRIPT = path.join(__dirname, 'deploy-admin-web.js');

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
  logger.section('Deploy Admin (Web)');
  logger.info('Admin is web-only. Deploying to GitHub Pages...');
  logger.blank();

  try {
    await runScript(DEPLOY_SCRIPT);
  } catch (error) {
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  }
}

main();
