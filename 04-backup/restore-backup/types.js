/**
 * Restore Backup Types and Configuration
 */

const { existsSync, readdirSync, readFileSync } = require('fs');
const { join } = require('path');
const { CONFIG } = require('../config');

const GITHUB_CONFIG = {
  token: CONFIG.GITHUB_BACKUP_TOKEN,
  owner: CONFIG.GITHUB_BACKUP_OWNER,
  repo: CONFIG.GITHUB_BACKUP_REPO,
};

function discoverClients() {
  const clients = {};
  const credentialsDir = join(process.cwd(), 'credentials');

  if (!existsSync(credentialsDir)) {
    console.error('Credentials folder not found:', credentialsDir);
    return clients;
  }

  const files = readdirSync(credentialsDir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    try {
      const filePath = join(credentialsDir, file);
      const content = JSON.parse(readFileSync(filePath, 'utf8'));
      const projectId = content.project_id;

      if (projectId) {
        const clientName = file.replace('.json', '');
        clients[clientName] = projectId;
      }
    } catch {
      console.warn(`Failed to parse ${file}`);
    }
  }

  return clients;
}

const CLIENTS = discoverClients();

module.exports = {
  GITHUB_CONFIG,
  CLIENTS,
};
