const inquirer = require('inquirer');
const Separator = inquirer.Separator;
const chalk = require('chalk');

const { SCRIPTS, WORKFLOWS } = require('../config');
const ConfigManager = require('./config-manager');
const WorkflowEngine = require('./workflow-engine');
const CommandRunner = require('./command-runner');
const MenuRenderer = require('./menu-renderer');
const { checkGitStatus, promptGitWarning } = require('./git-status');

class LoyaltyCLI {
  constructor() {
    this.configManager = new ConfigManager();
    this.commandRunner = new CommandRunner(this.configManager);
    this.menuRenderer = new MenuRenderer();
  }

  async showMainMenu() {
    this.menuRenderer.printHeader();

    const choices = [
      ...this.menuRenderer.createMenuChoices(WORKFLOWS, 'workflow'),
      new Separator(chalk.bold.yellow('\nSCRIPTS INDIVIDUAIS')),
      {
        name: chalk.cyan('  - Executar Script Individual'),
        value: 'INDIVIDUAL',
        short: 'Scripts Individuais',
      },
      new Separator('\n'),
      { name: chalk.red('Sair'), value: 'EXIT', short: 'Sair' },
    ];

    const { selection } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selection',
        message: 'O que voce gostaria de fazer?',
        choices,
        pageSize: 20,
      },
    ]);

    return selection;
  }

  async showIndividualScriptsMenu() {
    this.menuRenderer.printHeader();

    const choices = [
      ...this.menuRenderer.createMenuChoices(SCRIPTS, 'script'),
      { name: chalk.gray('Voltar ao Menu Principal'), value: 'BACK', short: 'Voltar' },
    ];

    const { selection } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selection',
        message: 'Selecione um script para executar:',
        choices,
        pageSize: 20,
      },
    ]);

    return selection;
  }

  async handleSelection(selection) {
    if (selection === 'EXIT') {
      console.log(chalk.cyan('\nAte logo!\n'));
      process.exit(0);
    }

    if (selection === 'INDIVIDUAL') {
      const script = await this.showIndividualScriptsMenu();

      if (script === 'BACK') {
        return true;
      }

      try {
        await this.commandRunner.runScript(script);
      } catch (error) {
        // Error already logged
      }

      return await this.promptContinue();
    }

    const workflow = selection;
    const engine = new WorkflowEngine(workflow, this.configManager);

    try {
      await engine.execute();
    } catch (error) {
      console.log(chalk.red(`\nErro no fluxo: ${error.message}\n`));
    }

    return await this.promptContinue();
  }

  async promptContinue() {
    const { shouldContinue } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldContinue',
        message: 'Voltar ao menu?',
        default: true,
      },
    ]);

    return shouldContinue;
  }

  async handleDirectCommand(args) {
    const command = args[2];

    if (command === '--list' || command === '-l') {
      console.log(chalk.bold.cyan('\nFluxos Disponiveis:\n'));
      Object.values(WORKFLOWS).forEach((wf) => {
        console.log(`  ${chalk.green('>')} ${wf.name} - ${chalk.gray(wf.description)}`);
      });

      console.log(chalk.bold.cyan('\nScripts Disponiveis:\n'));
      Object.values(SCRIPTS).forEach((script) => {
        console.log(`  ${chalk.green('-')} ${script.name} - ${chalk.gray(script.description)}`);
      });

      console.log();
      return;
    }

    if (command === 'workflow' && args[3]) {
      const workflowKey = args[3].toUpperCase().replace(/-/g, '_');
      const workflow = WORKFLOWS[workflowKey];

      if (!workflow) {
        console.log(chalk.red(`\nFluxo nao encontrado: ${args[3]}\n`));
        console.log(chalk.yellow('Use --list para ver fluxos disponiveis\n'));
        process.exit(1);
      }

      const engine = new WorkflowEngine(workflow, this.configManager);
      await engine.execute();
      return;
    }

    const scriptKey = command.toUpperCase().replace(/-/g, '_');
    const script = SCRIPTS[scriptKey];

    if (!script) {
      console.log(chalk.red(`\nComando nao encontrado: ${command}\n`));
      console.log(chalk.yellow('Use --list para ver comandos disponiveis\n'));
      process.exit(1);
    }

    await this.commandRunner.runScript(script);
  }

  async run() {
    try {
      const gitStatus = checkGitStatus();
      if (gitStatus.hasChanges) {
        const shouldContinue = await promptGitWarning(gitStatus);
        if (!shouldContinue) {
          process.exit(0);
        }
      }

      if (process.argv.length > 2) {
        await this.handleDirectCommand(process.argv);
        return;
      }

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const selection = await this.showMainMenu();
        const shouldContinue = await this.handleSelection(selection);

        if (!shouldContinue) {
          console.log(chalk.cyan('\nAte logo!\n'));
          process.exit(0);
        }
      }
    } catch (error) {
      console.error(chalk.red('\nOcorreu um erro inesperado:'), error);
      process.exit(1);
    }
  }
}

module.exports = LoyaltyCLI;
