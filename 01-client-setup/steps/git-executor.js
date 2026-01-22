const { execSync } = require('child_process');
const config = require('../config');
const { ErrorHandler, GitError } = require('../../shared/utils/error-handler');

/**
 * Git Executor
 *
 * Low-level git command execution with retry logic and error handling.
 * Used by GitCredentialsManager for all git operations.
 */

const NETWORK_ERROR_PATTERNS = [
  'connection refused',
  'network',
  'timeout',
  'could not resolve host',
];

/**
 * Check if error is a network error that should be retried
 */
function isNetworkError(error) {
  const errorMsg = error.message.toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pattern) => errorMsg.includes(pattern));
}

/**
 * Execute git command with improved error handling
 * @param {string} command - Git command to execute
 * @param {string} cwd - Working directory for the command
 * @param {Object} options - Execution options
 * @returns {string} Command output
 */
function execGit(command, cwd, options = {}) {
  const { retryable = false, silent = false } = options;

  const executeCommand = () => {
    try {
      const result = execSync(command, {
        cwd,
        encoding: 'utf8',
        stdio: silent ? 'pipe' : ['pipe', 'pipe', 'pipe'],
        timeout: config.git.timeout,
        ...options,
      });
      return result ? result.trim() : '';
    } catch (error) {
      const errorMessage = [
        `Git command failed: ${command}`,
        `Exit code: ${error.status}`,
        error.stderr ? `Stderr: ${error.stderr.trim()}` : '',
        error.stdout ? `Stdout: ${error.stdout.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      throw new GitError(errorMessage, command, {
        exitCode: error.status,
        stderr: error.stderr,
        stdout: error.stdout,
      });
    }
  };

  if (retryable) {
    return ErrorHandler.retry(executeCommand, {
      maxRetries: config.git.maxRetries,
      initialDelay: config.git.retryDelay,
      shouldRetry: isNetworkError,
    });
  }

  return executeCommand();
}

/**
 * Check if git repo is initialized in the given directory
 * @param {string} cwd - Directory to check
 * @returns {boolean}
 */
function isGitInitialized(cwd) {
  try {
    execGit('git rev-parse --git-dir', cwd, { silent: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if there are uncommitted changes in the repo
 * @param {string} cwd - Repository directory
 * @returns {boolean}
 */
function hasUncommittedChanges(cwd) {
  try {
    const status = execGit('git status --porcelain', cwd, { silent: true });
    return status.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if repository has any commits
 * @param {string} cwd - Repository directory
 * @returns {boolean}
 */
function hasAnyCommits(cwd) {
  try {
    execGit('git log -1', cwd, { silent: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if remote is configured
 * @param {string} cwd - Repository directory
 * @returns {boolean}
 */
function hasRemote(cwd) {
  try {
    const remote = execGit('git remote', cwd, { silent: true });
    return remote.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get list of tracked files matching a pattern
 * @param {string} cwd - Repository directory
 * @param {string} pattern - File pattern to match
 * @returns {string} List of matching files
 */
function getTrackedFiles(cwd, pattern) {
  try {
    return execGit(`git ls-files ${pattern}`, cwd, { silent: true });
  } catch {
    return '';
  }
}

/**
 * Get staged changes
 * @param {string} cwd - Repository directory
 * @returns {string} List of staged files
 */
function getStagedChanges(cwd) {
  try {
    return execGit('git diff --cached --name-only', cwd, { silent: true });
  } catch {
    return '';
  }
}

module.exports = {
  execGit,
  isGitInitialized,
  hasUncommittedChanges,
  hasAnyCommits,
  hasRemote,
  getTrackedFiles,
  getStagedChanges,
};
