/**
 * Backup CLI Configuration
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CONFIG = {
  GITHUB_BACKUP_TOKEN: process.env.GITHUB_BACKUP_TOKEN || '',
  GITHUB_BACKUP_OWNER: process.env.GITHUB_BACKUP_OWNER || '',
  GITHUB_BACKUP_REPO: process.env.GITHUB_BACKUP_REPO || '',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  BACKUP_HOUR_START: parseInt(process.env.BACKUP_HOUR_START || '2', 10),
};

function validateConfig() {
  const required = [
    'GITHUB_BACKUP_TOKEN',
    'GITHUB_BACKUP_OWNER',
    'GITHUB_BACKUP_REPO',
  ];

  const missing = required.filter((key) => !CONFIG[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    return false;
  }

  return true;
}

module.exports = { CONFIG, validateConfig };
