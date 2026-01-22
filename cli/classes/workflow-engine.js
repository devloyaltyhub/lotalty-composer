const { spawn } = require('child_process');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const boxen = require('boxen');

class WorkflowEngine {
  constructor(workflow, configManager) {
    this.workflow = workflow;
    this.configManager = configManager;
    this.currentStep = 0;
    this.startTime = null;
    this.automationDir = path.join(__dirname, '..');
  }

  async execute() {
    console.log(
      boxen(
        chalk.bold.cyan(`Workflow: ${this.workflow.name}\n`) +
          chalk.gray(this.workflow.description),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'cyan',
        }
      )
    );

    if (this.workflow.confirmStart) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: chalk.yellow(
            'Esta e uma operacao critica. Tem certeza que deseja prosseguir?'
          ),
          default: false,
        },
      ]);

      if (!confirmed) {
        console.log(chalk.yellow('\nFluxo cancelado\n'));
        return false;
      }
    }

    this.startTime = Date.now();
    const steps = this.workflow.steps;

    for (let i = 0; i < steps.length; i++) {
      this.currentStep = i + 1;
      const step = steps[i];

      console.log(chalk.cyan(`\n${'─'.repeat(50)}`));
      console.log(
        chalk.bold.white(`Passo ${this.currentStep}/${steps.length}: ${step.script.name}`)
      );
      console.log(chalk.gray(step.script.description));
      console.log(chalk.cyan(`${'─'.repeat(50)}\n`));

      if (step.optional) {
        const { shouldRun } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldRun',
            message: 'Este passo e opcional. Executar?',
            default: true,
          },
        ]);

        if (!shouldRun) {
          console.log(chalk.yellow('Pulado\n'));
          continue;
        }
      }

      try {
        await this.runScript(step.script);
      } catch (error) {
        console.log(chalk.red(`\nPasso ${this.currentStep} falhou: ${error.message}\n`));

        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'O que voce gostaria de fazer?',
            choices: [
              { name: 'Abortar fluxo', value: 'abort' },
              { name: 'Pular este passo e continuar', value: 'skip' },
              { name: 'Tentar novamente este passo', value: 'retry' },
            ],
          },
        ]);

        if (action === 'abort') {
          return false;
        } else if (action === 'retry') {
          i--;
          continue;
        }
      }
    }

    const duration = this.formatDuration(Date.now() - this.startTime);

    console.log(
      boxen(
        chalk.green.bold('Fluxo Concluido com Sucesso!\n\n') +
          chalk.white(`Duracao: ${duration}`),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'double',
          borderColor: 'green',
        }
      )
    );

    return true;
  }

  async runScript(scriptConfig) {
    const scriptPath = path.join(this.automationDir, scriptConfig.script);
    const args = scriptConfig.args || [];

    return new Promise((resolve, reject) => {
      const env = { ...process.env };

      if (this.workflow && this.currentStep > 1) {
        const previousSteps = this.workflow.steps.slice(0, this.currentStep - 1);
        const hasPreflightRun = previousSteps.some(
          (step) => step.script.script === 'shared/utils/preflight-check.js'
        );

        if (hasPreflightRun) {
          env.SKIP_PREFLIGHT_CHECK = '1';
        }
      }

      const child = spawn('node', [scriptPath, ...args], {
        stdio: 'inherit',
        cwd: path.join(this.automationDir, '..'),
        env,
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Script exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
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

module.exports = WorkflowEngine;
