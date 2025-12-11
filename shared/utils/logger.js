const chalk = require('chalk');
const ora = require('ora');
const winston = require('winston');
const path = require('path');
const fs = require('fs');

class Logger {
  constructor() {
    this.spinner = null;
    this.winstonLogger = null;
    this.setupWinston();
  }

  /**
   * Setup Winston file logging
   * Creates logs directory and configures transports
   */
  setupWinston() {
    const logsDir = path.join(process.cwd(), 'logs');

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Configure Winston
    this.winstonLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
          const msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
          return stack ? `${msg}\n${stack}` : msg;
        })
      ),
      transports: [
        // Write all logs to combined.log
        new winston.transports.File({
          filename: path.join(logsDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        // Write errors to error.log
        new winston.transports.File({
          filename: path.join(logsDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      ],
    });
  }

  /**
   * Log to file using Winston
   * @param {string} level - Log level (info, warn, error)
   * @param {string} message - Message to log
   */
  logToFile(level, message) {
    if (this.winstonLogger) {
      // Strip ANSI color codes for file logging
      const cleanMessage = message.replace(/\u001b\[\d+m/g, '');
      this.winstonLogger.log(level, cleanMessage);
    }
  }

  // Success messages
  success(message) {
    console.log(chalk.green('✓'), chalk.green(message));
    this.logToFile('info', `✓ ${message}`);
  }

  // Error messages
  error(message) {
    console.log(chalk.red('✗'), chalk.red(message));
    this.logToFile('error', `✗ ${message}`);
  }

  // Warning messages
  warn(message) {
    console.log(chalk.yellow('⚠'), chalk.yellow(message));
    this.logToFile('warn', `⚠ ${message}`);
  }

  // Info messages
  info(message) {
    console.log(chalk.blue('ℹ'), chalk.blue(message));
    this.logToFile('info', `ℹ ${message}`);
  }

  // Section headers
  section(title) {
    console.log('\n' + chalk.bold.cyan('━'.repeat(50)));
    console.log(chalk.bold.cyan(`  ${title}`));
    console.log(chalk.bold.cyan('━'.repeat(50)) + '\n');
    this.logToFile('info', `=== ${title} ===`);
  }

  // Sub-section headers
  subSection(title) {
    console.log(chalk.bold.white(`\n${title}:`));
    this.logToFile('info', `--- ${title} ---`);
  }

  // Start spinner
  startSpinner(text) {
    this.spinner = ora({
      text: chalk.cyan(text),
      spinner: 'dots',
    }).start();
    this.logToFile('info', `⏳ ${text}`);
  }

  // Update spinner text
  updateSpinner(text) {
    if (this.spinner) {
      this.spinner.text = chalk.cyan(text);
      this.logToFile('info', `⏳ ${text}`);
    }
  }

  // Stop spinner with success
  succeedSpinner(text) {
    if (this.spinner) {
      this.spinner.succeed(chalk.green(text));
      this.spinner = null;
    }
    this.logToFile('info', `✓ ${text}`);
  }

  // Stop spinner with error
  failSpinner(text) {
    if (this.spinner) {
      this.spinner.fail(chalk.red(text));
      this.spinner = null;
    }
    this.logToFile('error', `✗ ${text}`);
  }

  // Stop spinner without status
  stopSpinner() {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  // Print key-value pairs
  keyValue(key, value, indent = 0) {
    const padding = ' '.repeat(indent);
    console.log(`${padding}${chalk.gray(key + ':')} ${chalk.white(value)}`);
  }

  // Print credentials box
  credentialsBox(clientCode, email, password) {
    const boxWidth = 50;
    const border = '━'.repeat(boxWidth);

    console.log('\n' + chalk.yellow(border));
    console.log(chalk.yellow('  🔐 Admin App Credentials'));
    console.log(chalk.yellow(border));
    console.log(chalk.white(`  Client Code: ${chalk.bold(clientCode)}`));
    console.log(chalk.white(`  Email: ${chalk.bold(email)}`));
    console.log(chalk.white(`  Temporary Password: ${chalk.bold.green(password)}`));
    console.log(chalk.yellow(border));
    console.log(chalk.yellow('  ⚠️  Save these credentials securely!'));
    console.log(chalk.yellow('  📲 Share with client to login to Admin App'));
    console.log(chalk.yellow('  🔐 Change password on first login'));
    console.log(chalk.yellow(border) + '\n');
  }

  // Print summary box
  summaryBox(data) {
    const boxWidth = 50;
    const border = '━'.repeat(boxWidth);

    console.log('\n' + chalk.green(border));
    console.log(chalk.green.bold('  ✅ Client Created Successfully!'));
    console.log(chalk.green(border));

    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'object' && !Array.isArray(value)) {
        console.log(chalk.white(`  ${key}:`));
        Object.entries(value).forEach(([subKey, subValue]) => {
          console.log(chalk.gray(`    ${subKey}: ${chalk.white(subValue)}`));
        });
      } else if (Array.isArray(value)) {
        console.log(chalk.white(`  ${key}:`));
        value.forEach((item) => {
          console.log(chalk.gray(`    • ${chalk.white(item)}`));
        });
      } else {
        console.log(chalk.white(`  ${key}: ${chalk.bold(value)}`));
      }
    });

    console.log(chalk.green(border) + '\n');
  }

  // Blank line
  blank() {
    console.log('');
  }

  // Raw console.log
  log(message) {
    console.log(message);
  }
}

// Export singleton instance
module.exports = new Logger();
