const logger = require('./logger');
const telegram = require('./telegram');

/**
 * Centralized error handling utility
 * Provides consistent error handling across all automation scripts
 *
 * Features:
 * - Standardized error classes
 * - Consistent logging
 * - Optional Telegram notifications
 * - Cleanup function execution
 * - Stack trace logging
 * - Exit code management
 * - Retry with exponential backoff
 */

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Base error class for all automation errors
 */
class AutomationError extends Error {
  constructor(message, code = 'AUTOMATION_ERROR', metadata = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      metadata: this.metadata,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Validation error for invalid input
 */
class ValidationError extends AutomationError {
  constructor(message, field = null, metadata = {}) {
    super(message, 'VALIDATION_ERROR', { field, ...metadata });
  }
}

/**
 * Firebase operation error
 */
class FirebaseError extends AutomationError {
  constructor(message, operation = null, metadata = {}) {
    super(message, 'FIREBASE_ERROR', { operation, ...metadata });
  }
}

/**
 * Git operation error
 */
class GitError extends AutomationError {
  constructor(message, command = null, metadata = {}) {
    super(message, 'GIT_ERROR', { command, ...metadata });
  }
}

/**
 * File system operation error
 */
class FileSystemError extends AutomationError {
  constructor(message, path = null, metadata = {}) {
    super(message, 'FILESYSTEM_ERROR', { path, ...metadata });
  }
}

/**
 * External command execution error
 */
class CommandError extends AutomationError {
  constructor(message, command = null, exitCode = null, metadata = {}) {
    super(message, 'COMMAND_ERROR', { command, exitCode, ...metadata });
  }
}

/**
 * Configuration error
 */
class ConfigurationError extends AutomationError {
  constructor(message, key = null, metadata = {}) {
    super(message, 'CONFIGURATION_ERROR', { key, ...metadata });
  }
}

/**
 * Network or external service error
 */
class ExternalServiceError extends AutomationError {
  constructor(message, service = null, metadata = {}) {
    super(message, 'EXTERNAL_SERVICE_ERROR', { service, ...metadata });
  }
}

/**
 * Timeout error
 */
class TimeoutError extends AutomationError {
  constructor(message, operation = null, timeout = null, metadata = {}) {
    super(message, 'TIMEOUT_ERROR', { operation, timeout, ...metadata });
  }
}

/**
 * Rollback error
 */
class RollbackError extends AutomationError {
  constructor(message, step = null, metadata = {}) {
    super(message, 'ROLLBACK_ERROR', { step, ...metadata });
  }
}

// ============================================================================
// ERROR HANDLER CLASS
// ============================================================================

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

    // Execute in reverse order
    for (let i = this.cleanupFunctions.length - 1; i >= 0; i--) {
      const { fn, description } = this.cleanupFunctions[i];

      try {
        logger.info(`Cleanup: ${description}`);
        await fn();
        logger.success(`✓ ${description} completed`);
      } catch (cleanupError) {
        logger.error(`Failed to execute cleanup "${description}": ${cleanupError.message}`);
        // Continue with other cleanups even if one fails
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

    // Log the error
    logger.error('');
    logger.error('═══════════════════════════════════════');
    logger.error('  ERROR OCCURRED');
    logger.error('═══════════════════════════════════════');
    logger.error(`Message: ${error.message}`);

    if (showStack && error.stack) {
      logger.error('');
      logger.error('Stack Trace:');
      logger.error(error.stack);
    }

    logger.error('═══════════════════════════════════════');
    logger.error('');

    // Execute registered cleanups
    await this.executeCleanups();

    // Execute additional cleanup if provided
    if (cleanup && typeof cleanup === 'function') {
      try {
        logger.info('Executing additional cleanup...');
        await cleanup();
        logger.success('Additional cleanup completed');
      } catch (cleanupError) {
        logger.error(`Additional cleanup failed: ${cleanupError.message}`);
      }
    }

    // Send Telegram notification if requested
    if (sendTelegram) {
      try {
        await telegram.sendMessage(`❌ Automation Error\n\n${error.message}`, 'error');
      } catch (telegramError) {
        logger.warn(`Failed to send Telegram notification: ${telegramError.message}`);
      }
    }

    // Exit process
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
   * Handle error with retry logic
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Retry options
   * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
   * @param {number} options.delayMs - Delay between retries in ms (default: 1000)
   * @param {Function} options.onRetry - Callback called before each retry
   * @returns {Promise<any>} Result of the function
   */
  async withRetry(fn, options = {}) {
    const { maxRetries = 3, delayMs = 1000, onRetry = null } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          logger.warn(`Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
          logger.info(`Retrying in ${delayMs}ms...`);

          if (onRetry) {
            await onRetry(attempt, error);
          }

          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries failed
    throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
  }

  /**
   * Retries an operation with exponential backoff (static version)
   * @param {Function} fn - The function to retry
   * @param {Object} options - Retry options
   * @returns {Promise} Result of the function
   */
  static async retry(fn, options = {}) {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffFactor = 2,
      shouldRetry = () => true,
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries && shouldRetry(error)) {
          logger.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);

          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * backoffFactor, maxDelay);
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  /**
   * Create a safe version of a function that logs but doesn't throw
   * Useful for optional operations that shouldn't break the flow
   * @param {Function} fn - Function to make safe
   * @param {string} description - Description for logging
   * @returns {Function} Safe version of the function
   */
  makeSafe(fn, description = 'Operation') {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        logger.warn(`${description} failed (non-critical): ${error.message}`);
        return null;
      }
    };
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

// Create singleton instance for backward compatibility
const errorHandlerInstance = new ErrorHandler();

// Export both the instance (default) and all error classes
module.exports = errorHandlerInstance;

// Also export as named exports for destructuring
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
