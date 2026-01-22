/**
 * CLI Logger Utility
 *
 * Provides colored console output for CLI scripts.
 * Reusable across all CLI tools in the automation system.
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

class CliLogger {
  static log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  static success(message) {
    this.log(message, colors.green);
  }

  static error(message) {
    this.log(message, colors.red);
  }

  static warning(message) {
    this.log(message, colors.yellow);
  }

  static info(message) {
    this.log(message, colors.cyan);
  }

  static section(title) {
    this.log(`\n${title}`, colors.cyan);
  }

  static header(title) {
    this.log('\n========================================', colors.bright);
    this.log(title, colors.bright);
    this.log('========================================\n', colors.bright);
  }

  static successHeader(title) {
    this.log('\n========================================', colors.bright);
    this.log(title, colors.green + colors.bright);
    this.log('========================================\n', colors.bright);
  }

  static errorHeader(title) {
    this.log('\n========================================', colors.bright);
    this.log(title, colors.red + colors.bright);
    this.log('========================================\n', colors.bright);
  }
}

module.exports = { CliLogger, colors };
