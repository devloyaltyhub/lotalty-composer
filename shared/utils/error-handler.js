/**
 * Centralized error handling utility
 * Provides consistent error handling across all automation scripts
 *
 * Features:
 * - Standardized error classes (from error-types.js)
 * - Consistent logging
 * - Optional Telegram notifications
 * - Cleanup function execution
 * - Stack trace logging
 * - Exit code management
 * - Retry with exponential backoff (from retry-helpers.js)
 */

const logger = require('./logger');
const telegram = require('./telegram');
const { withRetry, retryWithBackoff, makeSafe } = require('./retry-helpers');
const {
  AutomationError,
  ValidationError,
  FirebaseError,
  GitError,
  FileSystemError,
  CommandError,
  ConfigurationError,
  ExternalServiceError,
  TimeoutError,
  RollbackError,
} = require('./error-types');

class ErrorHandler {
  constructor() {
    this.cleanupFunctions = [];
  }

  /**
   * Register a cleanup function to be called on error
   * @param {Function} cleanupFn - Async function to execute during cleanup
   * @param {string} description - Description of what this cleanup does
   */
  registerCleanup(cleanupFn, description = 'Cleanup') {
    this.cleanupFunctions.push({ fn: cleanupFn, description });
  }

  /**
   * Clear all registered cleanup functions
   */
  clearCleanups() {
    this.cleanupFunctions = [];
  }

  /**
   * Execute all registered cleanup functions
   * Executes in reverse order (LIFO - Last In First Out)
   */
  async executeCleanups() {
    if (this.cleanupFunctions.length === 0) {
      return;
    }

    logger.warn('Executing cleanup functions...');

    for (let i = this.cleanupFunctions.length - 1; i >= 0; i--) {
      const { fn, description } = this.cleanupFunctions[i];

      try {
        logger.info(`Cleanup: ${description}`);
        await fn();
        logger.success(`Cleanup "${description}" completed`);
      } catch (cleanupError) {
        logger.error(`Failed to execute cleanup "${description}": ${cleanupError.message}`);
      }
    }

    this.clearCleanups();
  }

  /**
   * Handle CLI errors with consistent behavior
   * @param {Error} error - The error to handle
   * @param {Object} options - Error handling options
   * @param {boolean} options.sendTelegram - Whether to send Telegram notification
   * @param {Function} options.cleanup - Additional cleanup function to execute
   * @param {number} options.exitCode - Exit code to use (default: 1)
   * @param {boolean} options.showStack - Whether to show stack trace (default: true)
   */
  async handleCLIError(error, options = {}) {
    const { sendTelegram = false, cleanup = null, exitCode = 1, showStack = true } = options;

    logger.error('');
    logger.error('===================================');
    logger.error('  ERROR OCCURRED');
    logger.error('===================================');
    logger.error(`Message: ${error.message}`);

    if (showStack && error.stack) {
      logger.error('');
      logger.error('Stack Trace:');
      logger.error(error.stack);
    }

    logger.error('===================================');
    logger.error('');

    await this.executeCleanups();

    if (cleanup && typeof cleanup === 'function') {
      try {
        logger.info('Executing additional cleanup...');
        await cleanup();
        logger.success('Additional cleanup completed');
      } catch (cleanupError) {
        logger.error(`Additional cleanup failed: ${cleanupError.message}`);
      }
    }

    if (sendTelegram) {
      try {
        await telegram.sendMessage(`Automation Error\n\n${error.message}`, 'error');
      } catch (telegramError) {
        logger.warn(`Failed to send Telegram notification: ${telegramError.message}`);
      }
    }

    process.exit(exitCode);
  }

  /**
   * Handles an error with consistent logging and optional exit (static version)
   * @param {Error} error - The error to handle
   * @param {Object} options - Handler options
   * @param {boolean} options.exit - Whether to exit the process
   * @param {number} options.exitCode - Exit code if exiting
   * @param {string} options.context - Additional context for logging
   */
  static handle(error, options = {}) {
    const { exit = false, exitCode = 1, context = '' } = options;

    const errorInfo =
      error instanceof AutomationError
        ? error.toJSON()
        : {
            name: error.name,
            message: error.message,
            stack: error.stack,
          };

    logger.error(`${context ? `[${context}] ` : ''}${error.message}`);

    if (exit) {
      process.exit(exitCode);
    }

    return errorInfo;
  }

  /**
   * Wrap an async function with error handling
   * @param {Function} fn - Async function to wrap
   * @param {Object} options - Error handling options
   * @returns {Function} Wrapped function
   */
  wrapAsync(fn, options = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        await this.handleCLIError(error, options);
      }
    };
  }

  /**
   * Handle error with retry logic (delegates to retry-helpers)
   */
  async withRetry(fn, options = {}) {
    return withRetry(fn, options);
  }

  /**
   * Retries an operation with exponential backoff (static version)
   */
  static async retry(fn, options = {}) {
    return retryWithBackoff(fn, options);
  }

  /**
   * Create a safe version of a function (delegates to retry-helpers)
   */
  makeSafe(fn, description = 'Operation') {
    return makeSafe(fn, description);
  }

  /**
   * Validate required environment variables
   * @param {string[]} requiredVars - Array of required variable names
   * @throws {Error} If any required variable is missing
   */
  validateEnvVars(requiredVars) {
    const missing = [];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables:\n  - ${missing.join('\n  - ')}\n\n` +
          `Please configure these in automation/.env`
      );
    }
  }

  /**
   * Validates that all required parameters are present
   * @param {Object} params - Parameters object
   * @param {string[]} required - Array of required parameter names
   * @throws {ValidationError} If any required parameter is missing
   */
  static validateRequired(params, required) {
    const missing = required.filter((key) => !params[key]);
    if (missing.length > 0) {
      throw new ValidationError(`Missing required parameters: ${missing.join(', ')}`, missing[0], {
        missing,
        provided: Object.keys(params),
      });
    }
  }
}

const errorHandlerInstance = new ErrorHandler();

module.exports = errorHandlerInstance;

module.exports.ErrorHandler = ErrorHandler;
module.exports.AutomationError = AutomationError;
module.exports.ValidationError = ValidationError;
module.exports.FirebaseError = FirebaseError;
module.exports.GitError = GitError;
module.exports.FileSystemError = FileSystemError;
module.exports.CommandError = CommandError;
module.exports.ConfigurationError = ConfigurationError;
module.exports.ExternalServiceError = ExternalServiceError;
module.exports.TimeoutError = TimeoutError;
module.exports.RollbackError = RollbackError;
