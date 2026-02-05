/**
 * GitHub API functions for restore-backup
 */

const { GITHUB_CONFIG } = require('./types');
const { formatSize } = require('./utils');

function validateGitHubConfig() {
  const missing = [];
  if (!GITHUB_CONFIG.token) {
    missing.push('GITHUB_BACKUP_TOKEN');
  }
  if (!GITHUB_CONFIG.owner) {
    missing.push('GITHUB_BACKUP_OWNER');
  }
  if (!GITHUB_CONFIG.repo) {
    missing.push('GITHUB_BACKUP_REPO');
  }

  if (missing.length > 0) {
    console.error('Variaveis de ambiente faltando:', missing.join(', '));
    process.exit(1);
  }
}

async function githubFetch(endpoint, options = {}) {
  const url = `https://api.github.com${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_CONFIG.token}`,
      Accept: 'application/vnd.github.v3+json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }

  return response.json();
}

async function downloadFile(filePath) {
  const endpoint = `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;

  try {
    const fileInfo = await githubFetch(endpoint);

    if (fileInfo.size > 1024 * 1024) {
      console.log(
        `  Arquivo grande (${formatSize(fileInfo.size)}), usando blob API...`
      );
      const blobData = await githubFetch(
        `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/git/blobs/${fileInfo.sha}`
      );
      return Buffer.from(blobData.content, 'base64');
    }

    return Buffer.from(fileInfo.content, 'base64');
  } catch (error) {
    if (error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

async function listFiles(dirPath) {
  const endpoint = `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${dirPath}`;

  try {
    const items = await githubFetch(endpoint);
    return Array.isArray(items) ? items : [];
  } catch (error) {
    if (error.message.includes('404')) {
      return [];
    }
    throw error;
  }
}

module.exports = {
  validateGitHubConfig,
  githubFetch,
  downloadFile,
  listFiles,
};
