/**
 * Retry Helpers for Automation System
 * Provides retry logic with exponential backoff
 */

const logger = require('./logger');

/**
 * Simple retry with fixed delay
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.delayMs - Delay between retries in ms (default: 1000)
 * @param {Function} options.onRetry - Callback called before each retry
 * @returns {Promise<any>} Result of the function
 */
async function withRetry(fn, options = {}) {
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

  throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
}

/**
 * Retry with exponential backoff
 * @param {Function} fn - The function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {number} options.backoffFactor - Multiplier for delay (default: 2)
 * @param {Function} options.shouldRetry - Function to determine if retry should happen
 * @returns {Promise} Result of the function
 */
async function retryWithBackoff(fn, options = {}) {
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
function makeSafe(fn, description = 'Operation') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.warn(`${description} failed (non-critical): ${error.message}`);
      return null;
    }
  };
}

module.exports = {
  withRetry,
  retryWithBackoff,
  makeSafe,
};
