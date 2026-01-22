const { execSync } = require('child_process');

/**
 * Execute a shell command with error handling.
 * @param {string} command - The command to execute
 * @param {object} options - Execution options
 * @param {boolean} options.silent - Suppress stdout/stderr
 * @param {boolean} options.ignoreError - Return null instead of throwing
 * @returns {string|null} Command output or null if error and ignoreError=true
 */
function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
  } catch (error) {
    if (options.ignoreError) {
      return null;
    }
    throw error;
  }
}

/**
 * Check if Firebase CLI is installed.
 * @returns {{ installed: boolean, version: string|null }}
 */
function checkFirebaseCLIInstalled() {
  try {
    const version = exec('firebase --version', { silent: true }).trim();
    return { installed: true, version };
  } catch (error) {
    return { installed: false, version: null };
  }
}

/**
 * Check if user is authenticated with Firebase.
 * @returns {{ authenticated: boolean, email: string|null }}
 */
function checkFirebaseAuthentication() {
  try {
    const output = exec('firebase login:list', { silent: true });

    if (output && output.includes('@')) {
      const emailMatch = output.match(/[\w.-]+@[\w.-]+\.\w+/);
      return {
        authenticated: true,
        email: emailMatch ? emailMatch[0] : null,
      };
    }
    return { authenticated: false, email: null };
  } catch (error) {
    return { authenticated: false, email: null };
  }
}

module.exports = {
  exec,
  checkFirebaseCLIInstalled,
  checkFirebaseAuthentication,
};
