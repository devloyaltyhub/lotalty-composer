/**
 * Utility validation functions
 * Validates required fields, environment variables, and provides sanitization
 */

const { ValidationError } = require('../../../shared/utils/error-handler');

/**
 * Sanitizes a string for safe use in shell commands
 * @param {string} value - Value to sanitize
 * @returns {string} Sanitized value
 */
function sanitizeForShell(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value.replace(/[;&|`$(){}[\]<>\\]/g, '').trim();
}

/**
 * Validates an object has all required fields
 * @param {Object} obj - Object to validate
 * @param {string[]} requiredFields - Array of required field names
 * @param {string} objectName - Name of object for error messages
 * @throws {ValidationError} If any required field is missing
 */
function validateRequiredFields(obj, requiredFields, objectName = 'object') {
  if (!obj || typeof obj !== 'object') {
    throw new ValidationError(`${objectName} is required and must be an object`);
  }

  const missing = requiredFields.filter((field) => !obj[field]);

  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields in ${objectName}: ${missing.join(', ')}`,
      missing[0],
      { missing, provided: Object.keys(obj) }
    );
  }
}

/**
 * Validates environment variables
 * @param {string[]} requiredVars - Array of required environment variable names
 * @throws {ValidationError} If any required variable is missing or empty
 */
function validateEnvironmentVariables(requiredVars) {
  const missing = requiredVars.filter((varName) => {
    const value = process.env[varName];
    return !value || value.trim() === '';
  });

  if (missing.length > 0) {
    throw new ValidationError(
      `Missing or empty required environment variables: ${missing.join(', ')}`,
      missing[0],
      { missing }
    );
  }
}

module.exports = {
  sanitizeForShell,
  validateRequiredFields,
  validateEnvironmentVariables,
};
