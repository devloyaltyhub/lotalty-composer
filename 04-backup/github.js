/**
 * GitHub API functions for backup-cli
 */

const { CONFIG, validateConfig } = require('./config');
const { color } = require('./utils');

function validateGitHubConfig() {
  if (!validateConfig()) {
    process.exit(1);
  }
}

async function githubFetch(endpoint) {
  const url = `https://api.github.com${endpoint}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${CONFIG.GITHUB_BACKUP_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }

  return response.json();
}

async function getManifest(date, client, type) {
  const endpoint = `/repos/${CONFIG.GITHUB_BACKUP_OWNER}/${CONFIG.GITHUB_BACKUP_REPO}/contents/backups/${date}/${client}/${type}/manifest.json`;

  try {
    const file = await githubFetch(endpoint);
    if (!file) {
      return null;
    }

    const content = Buffer.from(file.content, 'base64').toString('utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function listBackups() {
  console.log(color('\n=== Backups Disponiveis ===\n', 'cyan'));

  const endpoint = `/repos/${CONFIG.GITHUB_BACKUP_OWNER}/${CONFIG.GITHUB_BACKUP_REPO}/contents/backups`;

  try {
    const dates = await githubFetch(endpoint);

    if (!dates || dates.length === 0) {
      console.log(color('Nenhum backup encontrado.', 'yellow'));
      return [];
    }

    const sortedDates = dates
      .filter((d) => d.type === 'dir')
      .sort((a, b) => b.name.localeCompare(a.name));

    const backups = [];

    for (const dateDir of sortedDates) {
      const dateEndpoint = `/repos/${CONFIG.GITHUB_BACKUP_OWNER}/${CONFIG.GITHUB_BACKUP_REPO}/contents/backups/${dateDir.name}`;
      const clients = await githubFetch(dateEndpoint);

      if (!clients) {
        continue;
      }

      for (const clientDir of clients.filter((c) => c.type === 'dir')) {
        const firestoreManifest = await getManifest(
          dateDir.name,
          clientDir.name,
          'firestore'
        );
        const storageManifest = await getManifest(
          dateDir.name,
          clientDir.name,
          'storage'
        );

        const backup = {
          date: dateDir.name,
          client: clientDir.name,
          firestore: firestoreManifest,
          storage: storageManifest,
        };

        backups.push(backup);
      }
    }

    if (backups.length === 0) {
      console.log(color('Nenhum backup encontrado.', 'yellow'));
      return [];
    }

    let currentDate = '';
    for (let i = 0; i < backups.length; i++) {
      const backup = backups[i];

      if (backup.date !== currentDate) {
        if (currentDate !== '') {
          console.log('');
        }
        console.log(color(`${backup.date}`, 'bright'));
        console.log(color('─'.repeat(50), 'dim'));
        currentDate = backup.date;
      }

      const firestoreInfo = backup.firestore
        ? `${backup.firestore.stats.totalCollections} collections, ${backup.firestore.stats.totalDocuments} docs`
        : 'N/A';

      const storageInfo = backup.storage
        ? `${backup.storage.stats.totalFiles} arquivos`
        : 'N/A';

      console.log(
        `  ${color(`[${i + 1}]`, 'cyan')} ${color(backup.client, 'green')}`
      );
      console.log(`      Firestore: ${firestoreInfo}`);
      console.log(`      Storage: ${storageInfo}`);

      if (backup.firestore) {
        console.log(
          color(`      Exportado: ${backup.firestore.exportedAt}`, 'dim')
        );
      }
    }

    console.log('');
    return backups;
  } catch (error) {
    console.error(color(`\nErro ao listar backups: ${error.message}`, 'red'));
    return [];
  }
}

module.exports = {
  validateGitHubConfig,
  githubFetch,
  getManifest,
  listBackups,
};
