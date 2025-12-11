/**
 * CLI Classes
 * Core classes for the Loyalty CLI application
 */

const inquirer = require('inquirer');
const Separator = inquirer.Separator;
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const boxen = require('boxen');

const { SCRIPTS, WORKFLOWS } = require('./config');

const CONFIG_FILE = path.join(__dirname, '..', '.loyalty-cli-config.json');
const PROJECT_ROOT = path.join(__dirname, '../..');

// ============================================================================
// GIT STATUS CHECKER
// ============================================================================

/**
 * Check if there are uncommitted changes in git
 * @returns {{ hasChanges: boolean, staged: string[], unstaged: string[], untracked: string[] }}
 */
function checkGitStatus() {
  try {
    const status = execSync('git status --porcelain', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });

    const lines = status.trim().split('\n').filter(Boolean);
    const staged = [];
    const unstaged = [];
    const untracked = [];

    for (const line of lines) {
      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const fileName = line.slice(3);

      if (indexStatus === '?' && workTreeStatus === '?') {
        untracked.push(fileName);
      } else if (indexStatus !== ' ' && indexStatus !== '?') {
        staged.push(fileName);
      }
      if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
        unstaged.push(fileName);
      }
    }

    return {
      hasChanges: lines.length > 0,
      staged,
      unstaged,
      untracked,
    };
  } catch {
    // Not a git repo or git not available
    return { hasChanges: false, staged: [], unstaged: [], untracked: [] };
  }
}

/**
 * Display git status warning and prompt user to continue
 * @param {{ staged: string[], unstaged: string[], untracked: string[] }} gitStatus
 * @returns {Promise<boolean>} true if user wants to continue
 */
async function promptGitWarning(gitStatus) {
  console.log(
    boxen(
      chalk.bold.yellow('⚠️  ATENÇÃO: Existem alterações não commitadas no repositório!\n\n') +
        chalk.white(
          'Executar comandos do CLI pode sobrescrever ou perder suas alterações.\n' +
            'Recomendamos fazer commit ou stash antes de continuar.\n'
        ),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
      }
    )
  );

  if (gitStatus.staged.length > 0) {
    console.log(chalk.green.bold('📝 Staged (prontos para commit):'));
    gitStatus.staged.slice(0, 5).forEach((f) => console.log(chalk.green(`   ${f}`)));
    if (gitStatus.staged.length > 5) {
      console.log(chalk.green(`   ... e mais ${gitStatus.staged.length - 5} arquivo(s)`));
    }
    console.log();
  }

  if (gitStatus.unstaged.length > 0) {
    console.log(chalk.red.bold('📝 Modified (não staged):'));
    gitStatus.unstaged.slice(0, 5).forEach((f) => console.log(chalk.red(`   ${f}`)));
    if (gitStatus.unstaged.length > 5) {
      console.log(chalk.red(`   ... e mais ${gitStatus.unstaged.length - 5} arquivo(s)`));
    }
    console.log();
  }

  if (gitStatus.untracked.length > 0) {
    console.log(chalk.gray.bold('📝 Untracked (novos arquivos):'));
    gitStatus.untracked.slice(0, 5).forEach((f) => console.log(chalk.gray(`   ${f}`)));
    if (gitStatus.untracked.length > 5) {
      console.log(chalk.gray(`   ... e mais ${gitStatus.untracked.length - 5} arquivo(s)`));
    }
    console.log();
  }

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'O que você gostaria de fazer?',
      choices: [
        { name: chalk.yellow('⚠️  Continuar mesmo assim (não recomendado)'), value: 'continue' },
        { name: chalk.green('📦 Fazer stash das alterações e continuar'), value: 'stash' },
        { name: chalk.red('❌ Cancelar e resolver manualmente'), value: 'cancel' },
      ],
    },
  ]);

  if (action === 'cancel') {
    console.log(chalk.cyan('\n💡 Dica: Execute "git status" para ver as alterações'));
    console.log(chalk.cyan('   Use "git add . && git commit -m \"msg\"" para commitar'));
    console.log(chalk.cyan('   Ou "git stash" para salvar temporariamente\n'));
    return false;
  }

  if (action === 'stash') {
    try {
      execSync('git stash push -m "Auto-stash before CLI operation"', {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      });
      console.log(chalk.green('\n✅ Alterações salvas no stash com sucesso!'));
      console.log(chalk.gray('   Use "git stash pop" para recuperá-las depois.\n'));
    } catch (error) {
      console.log(chalk.red('\n❌ Erro ao fazer stash:', error.message));
      return false;
    }
  }

  return true;
}

// ============================================================================
// CONFIGURATION MANAGER
// ============================================================================

class ConfigManager {
  constructor() {
    this.config = this.loadConfig();
    this.lastError = null; // Track last error for debugging
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      // Log error but continue with defaults - CLI should still work
      this.lastError = error;
      console.warn(
        chalk.yellow(`⚠ Could not load CLI config (${error.code || error.message}), using defaults`)
      );
    }
    return {
      lastClient: null,
      favoriteWorkflows: [],
    };
  }

  saveConfig() {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
      this.lastError = null;
      return true;
    } catch (error) {
      // Log error so user knows settings may not persist
      this.lastError = error;
      console.warn(chalk.yellow(`⚠ Could not save CLI config: ${error.message}`));
      return false;
    }
  }

  /**
   * Check if config operations are working
   * @returns {boolean} True if last operation succeeded
   */
  isHealthy() {
    return this.lastError === null;
  }

  setLastClient(clientName) {
    this.config.lastClient = clientName;
    this.saveConfig();
  }

  getLastClient() {
    return this.config.lastClient;
  }
}

// ============================================================================
// WORKFLOW ENGINE
// ============================================================================

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
        chalk.bold.cyan(`📦 Workflow: ${this.workflow.name}\n`) +
          chalk.gray(this.workflow.description),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'cyan',
        }
      )
    );

    // Confirm if workflow requires it
    if (this.workflow.confirmStart) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: chalk.yellow(
            '⚠️  Esta é uma operação crítica. Tem certeza que deseja prosseguir?'
          ),
          default: false,
        },
      ]);

      if (!confirmed) {
        console.log(chalk.yellow('\n📋 Fluxo cancelado\n'));
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

      // Skip optional steps on user request
      if (step.optional) {
        const { shouldRun } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldRun',
            message: 'Este passo é opcional. Executar?',
            default: true,
          },
        ]);

        if (!shouldRun) {
          console.log(chalk.yellow('⏭️  Pulado\n'));
          continue;
        }
      }

      try {
        await this.runScript(step.script);
      } catch (error) {
        console.log(chalk.red(`\n✗ Passo ${this.currentStep} falhou: ${error.message}\n`));

        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'O que você gostaria de fazer?',
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
          i--; // Retry current step
          continue;
        }
        // Skip continues to next step
      }
    }

    const duration = this.formatDuration(Date.now() - this.startTime);

    console.log(
      boxen(
        chalk.green.bold('✓ Fluxo Concluído com Sucesso!\n\n') +
          chalk.white(`Duração: ${duration}`),
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
      // Set environment variable to skip preflight if this is a workflow step
      const env = { ...process.env };

      // Check if we just ran preflight in a previous step
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

// ============================================================================
// COMMAND RUNNER
// ============================================================================

class CommandRunner {
  constructor(configManager) {
    this.configManager = configManager;
    this.automationDir = path.join(__dirname, '..');
  }

  async runScript(scriptConfig) {
    console.log(
      boxen(`${chalk.bold.cyan(scriptConfig.name)  }\n${  chalk.gray(scriptConfig.description)}`, {
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
          console.log(chalk.green(`\n✓ Concluído em ${duration}\n`));
          resolve();
        } else {
          console.log(chalk.red(`\n✗ Falhou (código ${code}) após ${duration}\n`));
          reject(new Error(`Script falhou com código ${code}`));
        }
      });

      child.on('error', (error) => {
        console.log(chalk.red(`\n✗ Erro: ${error.message}\n`));
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

// ============================================================================
// MENU RENDERER
// ============================================================================

class MenuRenderer {
  printHeader() {
    console.clear();
    console.log(
      boxen(
        `${chalk.bold.cyan('Loyalty Hub - CLI de Automação') 
          }\n${ 
          chalk.gray('v2.0 - Interativo & Fluxos de Trabalho')}`,
        {
          padding: 1,
          margin: { top: 1, bottom: 0, left: 2, right: 2 },
          borderStyle: 'double',
          borderColor: 'cyan',
          textAlignment: 'center',
        }
      )
    );
  }

  groupByCategory(items) {
    const grouped = {};

    Object.values(items).forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });

    return grouped;
  }

  createMenuChoices(items, type = 'script') {
    const grouped = this.groupByCategory(items);
    const choices = [];

    Object.entries(grouped).forEach(([category, categoryItems]) => {
      choices.push(new Separator(chalk.bold.yellow(`\n${category}`)));

      categoryItems.forEach((item) => {
        const prefix = type === 'workflow' ? '▶' : '›';
        choices.push({
          name: `  ${chalk.green(prefix)} ${item.name} ${chalk.gray(`- ${  item.description}`)}`,
          value: item,
          short: item.name,
        });
      });
    });

    choices.push(new Separator('\n'));

    return choices;
  }
}

// ============================================================================
// MAIN CLI APPLICATION
// ============================================================================

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
      new Separator(chalk.bold.yellow('\n🔧 SCRIPTS INDIVIDUAIS')),
      {
        name: chalk.cyan('  › Executar Script Individual'),
        value: 'INDIVIDUAL',
        short: 'Scripts Individuais',
      },
      new Separator('\n'),
      { name: chalk.red('❌ Sair'), value: 'EXIT', short: 'Sair' },
    ];

    const { selection } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selection',
        message: 'O que você gostaria de fazer?',
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
      { name: chalk.gray('« Voltar ao Menu Principal'), value: 'BACK', short: 'Voltar' },
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
      console.log(chalk.cyan('\n👋 Até logo!\n'));
      process.exit(0);
    }

    if (selection === 'INDIVIDUAL') {
      const script = await this.showIndividualScriptsMenu();

      if (script === 'BACK') {
        return true; // Continue to main menu
      }

      try {
        await this.commandRunner.runScript(script);
      } catch (error) {
        // Error already logged
      }

      return await this.promptContinue();
    }

    // It's a workflow
    const workflow = selection;
    const engine = new WorkflowEngine(workflow, this.configManager);

    try {
      await engine.execute();
    } catch (error) {
      console.log(chalk.red(`\n✗ Erro no fluxo: ${error.message}\n`));
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
      console.log(chalk.bold.cyan('\n📦 Fluxos Disponíveis:\n'));
      Object.values(WORKFLOWS).forEach((wf) => {
        console.log(`  ${chalk.green('▶')} ${wf.name} - ${chalk.gray(wf.description)}`);
      });

      console.log(chalk.bold.cyan('\n🔧 Scripts Disponíveis:\n'));
      Object.values(SCRIPTS).forEach((script) => {
        console.log(`  ${chalk.green('›')} ${script.name} - ${chalk.gray(script.description)}`);
      });

      console.log();
      return;
    }

    // Check if it's a workflow
    if (command === 'workflow' && args[3]) {
      const workflowKey = args[3].toUpperCase().replace(/-/g, '_');
      const workflow = WORKFLOWS[workflowKey];

      if (!workflow) {
        console.log(chalk.red(`\n✗ Fluxo não encontrado: ${args[3]}\n`));
        console.log(chalk.yellow('Use --list para ver fluxos disponíveis\n'));
        process.exit(1);
      }

      const engine = new WorkflowEngine(workflow, this.configManager);
      await engine.execute();
      return;
    }

    // Check if it's an individual script
    const scriptKey = command.toUpperCase().replace(/-/g, '_');
    const script = SCRIPTS[scriptKey];

    if (!script) {
      console.log(chalk.red(`\n✗ Comando não encontrado: ${command}\n`));
      console.log(chalk.yellow('Use --list para ver comandos disponíveis\n'));
      process.exit(1);
    }

    await this.commandRunner.runScript(script);
  }

  async run() {
    try {
      // Check for uncommitted git changes before running any commands
      const gitStatus = checkGitStatus();
      if (gitStatus.hasChanges) {
        const shouldContinue = await promptGitWarning(gitStatus);
        if (!shouldContinue) {
          process.exit(0);
        }
      }

      // Check if direct command mode
      if (process.argv.length > 2) {
        await this.handleDirectCommand(process.argv);
        return;
      }

      // Interactive mode
      while (true) {
        const selection = await this.showMainMenu();
        const shouldContinue = await this.handleSelection(selection);

        if (!shouldContinue) {
          console.log(chalk.cyan('\n👋 Até logo!\n'));
          process.exit(0);
        }
      }
    } catch (error) {
      console.error(chalk.red('\n✗ Ocorreu um erro inesperado:'), error);
      process.exit(1);
    }
  }
}

module.exports = {
  ConfigManager,
  WorkflowEngine,
  CommandRunner,
  MenuRenderer,
  LoyaltyCLI,
};
