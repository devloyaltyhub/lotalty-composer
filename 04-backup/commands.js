/**
 * Command handlers for backup-cli
 */

const path = require('path');
const { spawn } = require('child_process');

const { color, createReadline, ask } = require('./utils');
const { validateGitHubConfig, listBackups } = require('./github');

async function cmdList() {
  validateGitHubConfig();
  await listBackups();
}

async function restoreMenu(rl) {
  console.log(color('\n=== Restaurar Backup ===\n', 'cyan'));

  const backups = await listBackups();

  if (backups.length === 0) {
    return;
  }

  const indexStr = await ask(
    rl,
    color('Selecione o numero do backup (ou "c" para cancelar): ', 'cyan')
  );

  if (indexStr.toLowerCase() === 'c') {
    console.log(color('Cancelado.', 'yellow'));
    return;
  }

  const index = parseInt(indexStr, 10) - 1;
  if (isNaN(index) || index < 0 || index >= backups.length) {
    console.log(color('Numero invalido.', 'red'));
    return;
  }

  const backup = backups[index];

  console.log(color('\nO que restaurar?', 'bright'));
  console.log('  [1] Tudo (Firestore + Storage)');
  console.log('  [2] Apenas Firestore');
  console.log('  [3] Apenas Storage');
  console.log('  [4] Cancelar');

  const scopeChoice = await ask(rl, color('\nEscolha: ', 'cyan'));

  let scope = '';
  switch (scopeChoice.trim()) {
    case '1':
      scope = '';
      break;
    case '2':
      scope = '--firestore-only';
      break;
    case '3':
      scope = '--storage-only';
      break;
    case '4':
      console.log(color('Cancelado.', 'yellow'));
      return;
    default:
      console.log(color('Opcao invalida.', 'red'));
      return;
  }

  const dryRun = await ask(
    rl,
    color('\nDeseja simular primeiro (dry-run)? [S/n]: ', 'cyan')
  );

  const useDryRun = dryRun.toLowerCase() !== 'n';

  const args = [
    `--client=${backup.client}`,
    `--date=${backup.date}`,
    scope,
    useDryRun ? '--dry-run' : '',
  ]
    .filter(Boolean)
    .join(' ');

  console.log(
    color(`\nExecutando: npm run backup:restore -- ${args}\n`, 'dim')
  );

  const child = spawn(
    'node',
    [
      path.join(__dirname, 'restore-backup', 'index.js'),
      `--client=${backup.client}`,
      `--date=${backup.date}`,
      ...(scope ? [scope] : []),
      ...(useDryRun ? ['--dry-run'] : []),
    ],
    {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    }
  );

  await new Promise((resolve) => {
    child.on('close', resolve);
  });

  if (useDryRun) {
    const confirm = await ask(
      rl,
      color('\nDeseja executar a restauracao de verdade? [s/N]: ', 'cyan')
    );

    if (confirm.toLowerCase() === 's') {
      console.log(color('\nExecutando restauracao real...\n', 'yellow'));

      const realChild = spawn(
        'node',
        [
          path.join(__dirname, 'restore-backup', 'index.js'),
          `--client=${backup.client}`,
          `--date=${backup.date}`,
          ...(scope ? [scope] : []),
        ],
        {
          stdio: 'inherit',
          cwd: path.join(__dirname, '..'),
        }
      );

      await new Promise((resolve) => {
        realChild.on('close', resolve);
      });
    }
  }
}

async function mainMenu() {
  console.log(color('\n╔══════════════════════════════════════╗', 'cyan'));
  console.log(color('║       BACKUP CLI - Firebase          ║', 'cyan'));
  console.log(color('╚══════════════════════════════════════╝', 'cyan'));

  const rl = createReadline();

  while (true) {
    console.log(color('\nOpcoes:', 'bright'));
    console.log('  [1] Listar backups');
    console.log('  [2] Restaurar backup');
    console.log('  [3] Sair');

    const choice = await ask(rl, color('\nEscolha uma opcao: ', 'cyan'));

    switch (choice.trim()) {
      case '1':
        await listBackups();
        break;

      case '2':
        await restoreMenu(rl);
        break;

      case '3':
      case 'q':
      case 'quit':
      case 'exit':
        console.log(color('\nAte logo!\n', 'green'));
        rl.close();
        process.exit(0);

      default:
        console.log(color('Opcao invalida. Tente novamente.', 'yellow'));
    }
  }
}

function showHelp() {
  console.log(`
${color('Backup CLI - Firebase', 'cyan')}

${color('Uso:', 'bright')}
  npm run backup:cli           Menu interativo
  npm run backup:list          Listar backups disponiveis
  npm run backup:restore       Restaurar backup

${color('Comandos:', 'bright')}
  list, ls     Lista todos os backups (do mais recente ao mais antigo)
  restore      Mostra como restaurar um backup
  help         Mostra esta ajuda

${color('Exemplos:', 'bright')}
  npm run backup:cli
  npm run backup:list
`);
}

function showRestoreInfo() {
  console.log(
    color(
      'Use: npm run backup:restore -- --client=<nome> --date=<YYYY-MM-DD>',
      'cyan'
    )
  );
  console.log(color('Ou use o menu interativo: npm run backup:cli', 'cyan'));
}

module.exports = {
  cmdList,
  restoreMenu,
  mainMenu,
  showHelp,
  showRestoreInfo,
};
