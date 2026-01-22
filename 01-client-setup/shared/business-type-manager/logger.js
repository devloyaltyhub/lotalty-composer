const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class Logger {
  static log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  static success(message) {
    this.log(`✅ ${message}`, 'green');
  }

  static error(message) {
    this.log(`❌ ${message}`, 'red');
  }

  static warning(message) {
    this.log(`⚠️  ${message}`, 'yellow');
  }

  static info(message) {
    this.log(`ℹ️  ${message}`, 'blue');
  }

  static section(title) {
    this.log(`\n${title}`, 'cyan');
    this.log('='.repeat(60), 'cyan');
  }

  static subsection(title) {
    this.log(`\n${title}`, 'blue');
  }
}

module.exports = { Logger, colors };
