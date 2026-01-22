const path = require('path');

const AUTOMATION_ROOT = path.resolve(__dirname, '../..');

/**
 * Expands environment variables in a path string.
 * Supports formats like $HOME, $USER, etc.
 * @param {string} pathStr - Path string potentially containing env variables
 * @returns {string} Path with env variables expanded
 */
function expandEnvVariables(pathStr) {
  return pathStr.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    return process.env[varName] || match;
  });
}

/**
 * Resolves a service account path.
 * - Expands environment variables
 * - Resolves relative paths from automation root
 * @param {string} serviceAccountPath - Path to service account JSON
 * @returns {string} Resolved absolute path
 */
function resolveServiceAccountPath(serviceAccountPath) {
  let resolvedPath = expandEnvVariables(serviceAccountPath);

  if (!path.isAbsolute(resolvedPath)) {
    resolvedPath = path.resolve(AUTOMATION_ROOT, resolvedPath);
  }

  return resolvedPath;
}

/**
 * Gets the master service account path from environment variables.
 * @returns {string|null} Path to master service account or null if not set
 */
function getMasterServiceAccountPath() {
  return process.env.MASTER_FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

/**
 * Gets the master Firebase project ID from environment.
 * @returns {string|null} Master project ID or null if not set
 */
function getMasterProjectId() {
  return process.env.MASTER_FIREBASE_PROJECT_ID;
}

module.exports = {
  AUTOMATION_ROOT,
  expandEnvVariables,
  resolveServiceAccountPath,
  getMasterServiceAccountPath,
  getMasterProjectId,
};
