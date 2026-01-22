const { execSync } = require('child_process');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const boxen = require('boxen');

const PROJECT_ROOT = path.join(__dirname, '../..');

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
    return { hasChanges: false, staged: [], unstaged: [], untracked: [] };
  }
}

async function promptGitWarning(gitStatus) {
  console.log(
    boxen(
      chalk.bold.yellow('ATENCAO: Existem alteracoes nao commitadas no repositorio!\n\n') +
        chalk.white(
          'Executar comandos do CLI pode sobrescrever ou perder suas alteracoes.\n' +
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
    console.log(chalk.green.bold('Staged (prontos para commit):'));
    gitStatus.staged.slice(0, 5).forEach((f) => console.log(chalk.green(`   ${f}`)));
    if (gitStatus.staged.length > 5) {
      console.log(chalk.green(`   ... e mais ${gitStatus.staged.length - 5} arquivo(s)`));
    }
    console.log();
  }

  if (gitStatus.unstaged.length > 0) {
    console.log(chalk.red.bold('Modified (nao staged):'));
    gitStatus.unstaged.slice(0, 5).forEach((f) => console.log(chalk.red(`   ${f}`)));
    if (gitStatus.unstaged.length > 5) {
      console.log(chalk.red(`   ... e mais ${gitStatus.unstaged.length - 5} arquivo(s)`));
    }
    console.log();
  }

  if (gitStatus.untracked.length > 0) {
    console.log(chalk.gray.bold('Untracked (novos arquivos):'));
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
      message: 'O que voce gostaria de fazer?',
      choices: [
        { name: chalk.yellow('Continuar mesmo assim (nao recomendado)'), value: 'continue' },
        { name: chalk.green('Fazer stash das alteracoes e continuar'), value: 'stash' },
        { name: chalk.red('Cancelar e resolver manualmente'), value: 'cancel' },
      ],
    },
  ]);

  if (action === 'cancel') {
    console.log(chalk.cyan('\nDica: Execute "git status" para ver as alteracoes'));
    console.log(chalk.cyan('   Use "git add . && git commit -m \'msg\'" para commitar'));
    console.log(chalk.cyan('   Ou "git stash" para salvar temporariamente\n'));
    return false;
  }

  if (action === 'stash') {
    try {
      execSync('git stash push -m "Auto-stash before CLI operation"', {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      });
      console.log(chalk.green('\nAlteracoes salvas no stash com sucesso!'));
      console.log(chalk.gray('   Use "git stash pop" para recupera-las depois.\n'));
    } catch (error) {
      console.log(chalk.red('\nErro ao fazer stash:', error.message));
      return false;
    }
  }

  return true;
}

module.exports = {
  checkGitStatus,
  promptGitWarning,
};
