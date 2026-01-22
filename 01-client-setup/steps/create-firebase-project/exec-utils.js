const { execSync } = require('child_process');

const DEFAULT_TIMEOUT = 30000;

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: DEFAULT_TIMEOUT,
      ...options,
    }).trim();
  } catch (error) {
    if (error.killed && error.signal === 'SIGTERM') {
      throw new Error(`Command timed out after ${options.timeout || DEFAULT_TIMEOUT}ms: ${command}`);
    }

    const fullError = [error.message, error.stderr, error.stdout].filter(Boolean).join('\n');
    throw new Error(`Command failed: ${command}\n${fullError}`);
  }
}

function checkAppAlreadyExistsError(errorMsg) {
  return (
    errorMsg.includes('already exists') ||
    errorMsg.includes('already_exists') ||
    errorMsg.includes('entity already exists')
  );
}

function isFirebaseNotEnabledError(errorMsg) {
  return errorMsg.includes('not found') || errorMsg.includes('404');
}

module.exports = {
  exec,
  checkAppAlreadyExistsError,
  isFirebaseNotEnabledError,
  DEFAULT_TIMEOUT,
};
