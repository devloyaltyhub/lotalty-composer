/**
 * Shorebird command runner
 * Handles execution of shorebird CLI commands
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { WHITE_LABEL_APP_ROOT } = require('../../../shared/utils/paths');
const { log } = require('./log-utils');

/**
 * Check if Shorebird is installed
 * @returns {boolean}
 */
function isShorebirdInstalled() {
  try {
    execSync('which shorebird', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Shorebird is configured for the project
 * @returns {object} - { configured: boolean, reason?: string }
 */
function isShorebirdConfigured() {
  const shorebirdYaml = path.join(WHITE_LABEL_APP_ROOT, 'shorebird.yaml');

  if (!fs.existsSync(shorebirdYaml)) {
    return { configured: false, reason: 'shorebird.yaml nao encontrado' };
  }

  const content = fs.readFileSync(shorebirdYaml, 'utf8');
  if (content.includes('placeholder-')) {
    return {
      configured: false,
      reason: 'app_id e placeholder (execute shorebird init)',
    };
  }

  return { configured: true };
}

/**
 * Run shorebird command
 * @param {string[]} args - Command arguments
 * @returns {Promise<void>}
 */
function runShorebird(args) {
  return new Promise((resolve, reject) => {
    log.info(`Executando: shorebird ${args.join(' ')}`);
    console.log('');

    const proc = spawn('shorebird', args, {
      cwd: WHITE_LABEL_APP_ROOT,
      stdio: 'inherit',
      env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Shorebird exited with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

module.exports = {
  isShorebirdInstalled,
  isShorebirdConfigured,
  runShorebird,
};
