/**
 * Logging utilities for Shorebird CLI
 * Simple colored console output
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}i${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}v${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}!${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}x${colors.reset} ${msg}`),
  title: (msg) =>
    console.log(`\n${colors.bright}${colors.cyan}>> ${msg}${colors.reset}\n`),
};

module.exports = { log, colors };
