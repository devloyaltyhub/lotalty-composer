/**
 * Restore Backup Types and Configuration
 */

const { CONFIG } = require('../config');

const GITHUB_CONFIG = {
  token: CONFIG.GITHUB_BACKUP_TOKEN,
  owner: CONFIG.GITHUB_BACKUP_OWNER,
  repo: CONFIG.GITHUB_BACKUP_REPO,
};

const CLIENTS = {
  'na-rede': 'na-rede-loyalty-hub-club-4948',
  demo: 'loyalty-hub-club',
};

module.exports = {
  GITHUB_CONFIG,
  CLIENTS,
};
