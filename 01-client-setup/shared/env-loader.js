/**
 * Environment Variables Loader
 *
 * Utility to load and expand environment variables from .env files
 * Handles $HOME, $USER and other environment variable expansions
 */

const path = require('path');

// Automation root directory (for relative path resolution)
const AUTOMATION_ROOT = path.resolve(__dirname, '../..');

/**
 * Expand environment variables in a string
 * Supports $HOME, $USER, and any other environment variable
 *
 * @param {string} value - String containing environment variables to expand
 * @returns {string} - Expanded string
 */
function expandEnvVars(value) {
  if (!value) return value;
  return value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    return process.env[varName] || match;
  });
}

/**
 * Resolve a path by expanding environment variables and making it absolute
 *
 * @param {string} pathValue - Path string to resolve
 * @param {string} baseDir - Base directory for relative paths (default: automation root)
 * @returns {string|null} - Resolved absolute path or null if input is empty
 */
function resolvePath(pathValue, baseDir = AUTOMATION_ROOT) {
  if (!pathValue) return null;

  // Expand environment variables
  let resolved = expandEnvVars(pathValue);

  // Resolve relative paths from base directory
  if (!path.isAbsolute(resolved)) {
    resolved = path.resolve(baseDir, resolved);
  }

  return resolved;
}

/**
 * Resolve credential paths by expanding environment variables only
 * Modifies process.env in place (preserves relative paths)
 *
 * @param {string} envVar - The name of the environment variable to resolve
 */
function resolveCredentialPath(envVar) {
  const value = process.env[envVar];
  if (!value) return;

  // Only expand environment variables, don't resolve to absolute
  const expanded = expandEnvVars(value);
  if (expanded !== value) {
    process.env[envVar] = expanded;
  }
}

/**
 * Resolve credential paths by expanding environment variables AND making absolute
 * Modifies process.env in place
 *
 * @param {string} envVar - The name of the environment variable to resolve
 */
function resolveCredentialPathFull(envVar) {
  const resolved = resolvePath(process.env[envVar]);
  if (resolved) {
    process.env[envVar] = resolved;
  }
}

/**
 * Load environment variables from automation/.env and expand paths
 * Call this at the start of any CLI script
 *
 * @param {string} scriptDir - __dirname of the calling script
 */
function loadEnvWithExpansion(scriptDir) {
  // Load .env file (assuming script is in automation/01-client-setup/cli/)
  const envPath = path.join(scriptDir, '../../.env');
  require('dotenv').config({ path: envPath });

  // Expand all credential-related environment variables
  const credentialVars = [
    'MASTER_FIREBASE_SERVICE_ACCOUNT',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'GOOGLE_PLAY_JSON_KEY',
    'APP_STORE_CONNECT_API_KEY',
  ];

  credentialVars.forEach(resolveCredentialPath);
}

module.exports = {
  loadEnvWithExpansion,
  resolveCredentialPath,
  resolveCredentialPathFull,
  resolvePath,
  expandEnvVars,
  AUTOMATION_ROOT,
};
