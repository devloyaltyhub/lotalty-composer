#!/usr/bin/env node
/**
 * List backups from GitHub
 */

const { validateGitHubConfig, listBackups } = require('./github');

async function main() {
  validateGitHubConfig();
  await listBackups();
}

main().catch((error) => {
  console.error(`\nErro fatal: ${error.message}`);
  process.exit(1);
});
