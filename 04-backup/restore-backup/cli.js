/**
 * CLI parsing and help for restore-backup
 */

const { CLIENTS } = require('./types');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    client: null,
    date: null,
    firestoreOnly: false,
    storageOnly: false,
    dryRun: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--firestore-only') {
      options.firestoreOnly = true;
    } else if (arg === '--storage-only') {
      options.storageOnly = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--client=')) {
      options.client = arg.split('=')[1];
    } else if (arg.startsWith('--date=')) {
      options.date = arg.split('=')[1];
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Restaurar Backup Firebase (Firestore + Storage)

USO:
  npm run backup:restore -- --client=<nome> --date=<YYYY-MM-DD> [opcoes]

ARGUMENTOS OBRIGATORIOS:
  --client=<nome>     Nome do cliente (ex: na-rede, demo)
  --date=<data>       Data do backup (formato: YYYY-MM-DD)

OPCOES:
  --firestore-only    Restaura apenas o Firestore
  --storage-only      Restaura apenas o Storage
  --dry-run           Simula a restauracao sem fazer alteracoes
  --help, -h          Mostra esta ajuda

EXEMPLOS:
  npm run backup:restore -- --client=na-rede --date=2025-12-12
  npm run backup:restore -- --client=na-rede --date=2025-12-12 --firestore-only
  npm run backup:restore -- --client=na-rede --date=2025-12-12 --dry-run

VARIAVEIS DE AMBIENTE NECESSARIAS:
  GITHUB_BACKUP_TOKEN   Token de acesso ao GitHub
  GITHUB_BACKUP_OWNER   Owner do repositorio (org ou usuario)
  GITHUB_BACKUP_REPO    Nome do repositorio de backup

CLIENTES DISPONIVEIS:
${Object.entries(CLIENTS)
  .map(([name, projectId]) => `  - ${name} (${projectId})`)
  .join('\n')}
`);
}

function validateOptions(options) {
  if (!options.client) {
    console.error('Erro: --client eh obrigatorio');
    console.error('Use --help para ver opcoes');
    process.exit(1);
  }

  if (!options.date) {
    console.error('Erro: --date eh obrigatorio');
    console.error('Use --help para ver opcoes');
    process.exit(1);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    console.error('Erro: data deve estar no formato YYYY-MM-DD');
    process.exit(1);
  }

  const projectId = CLIENTS[options.client];
  if (!projectId) {
    console.error(`Erro: cliente "${options.client}" nao encontrado`);
    console.error('Clientes disponiveis:', Object.keys(CLIENTS).join(', '));
    process.exit(1);
  }

  return projectId;
}

module.exports = {
  parseArgs,
  showHelp,
  validateOptions,
};
