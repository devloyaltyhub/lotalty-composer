const { spawn } = require('child_process');
const path = require('path');
const chalk = require('chalk');
const boxen = require('boxen');

class CommandRunner {
  constructor(configManager) {
    this.configManager = configManager;
    this.automationDir = path.join(__dirname, '..');
  }

  async runScript(scriptConfig) {
    console.log(
      boxen(`${chalk.bold.cyan(scriptConfig.name)}\n${chalk.gray(scriptConfig.description)}`, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
      })
    );

    const startTime = Date.now();
    const scriptPath = path.join(this.automationDir, scriptConfig.script);
    const args = scriptConfig.args || [];

    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath, ...args], {
        stdio: 'inherit',
        cwd: path.join(this.automationDir, '..'),
      });

      child.on('close', (code) => {
        const duration = this.formatDuration(Date.now() - startTime);

        if (code === 0) {
          console.log(chalk.green(`\nConcluido em ${duration}\n`));
          resolve();
        } else {
          console.log(chalk.red(`\nFalhou (codigo ${code}) apos ${duration}\n`));
          reject(new Error(`Script falhou com codigo ${code}`));
        }
      });

      child.on('error', (error) => {
        console.log(chalk.red(`\nErro: ${error.message}\n`));
        reject(error);
      });
    });
  }

  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }
}

module.exports = CommandRunner;
