/**
 * Input validation utilities
 * Provides validation functions for all user inputs to prevent security vulnerabilities
 */

const path = require('path');
const { URL } = require('url');
const config = require('../config');
const { ValidationError } = require('../../shared/utils/error-handler');

/**
 * Validates an email address
 * @param {string} email - Email to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {string} Validated email
 * @throws {ValidationError} If email is invalid
 */
function validateEmail(email, fieldName = 'email') {
  if (!email || typeof email !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  const trimmed = email.trim().toLowerCase();

  if (!config.validation.email.test(trimmed)) {
    throw new ValidationError(`Invalid email format: ${email}`, fieldName, { provided: email });
  }

  return trimmed;
}

/**
 * Validates a client code
 * @param {string} clientCode - Client code to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {string} Validated client code
 * @throws {ValidationError} If client code is invalid
 */
function validateClientCode(clientCode, fieldName = 'clientCode') {
  if (!clientCode || typeof clientCode !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  const trimmed = clientCode.trim().toLowerCase();

  if (!config.validation.clientCode.test(trimmed)) {
    throw new ValidationError(
      `Invalid client code format. Must be 3-50 characters, lowercase letters, numbers, and hyphens only: ${clientCode}`,
      fieldName,
      { provided: clientCode, pattern: config.validation.clientCode.toString() }
    );
  }

  // Additional security: prevent path traversal
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new ValidationError(
      `Client code contains invalid path characters: ${clientCode}`,
      fieldName,
      { provided: clientCode }
    );
  }

  return trimmed;
}

/**
 * Validates a bundle ID (iOS/Android)
 * @param {string} bundleId - Bundle ID to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {string} Validated bundle ID
 * @throws {ValidationError} If bundle ID is invalid
 */
function validateBundleId(bundleId, fieldName = 'bundleId') {
  if (!bundleId || typeof bundleId !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  const trimmed = bundleId.trim().toLowerCase();

  if (!config.validation.bundleId.test(trimmed)) {
    throw new ValidationError(
      `Invalid bundle ID format. Must be reverse domain notation (e.g., com.example.app): ${bundleId}`,
      fieldName,
      { provided: bundleId }
    );
  }

  return trimmed;
}

/**
 * Validates a hex color code
 * @param {string} hexColor - Hex color to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {string} Validated hex color (with # prefix)
 * @throws {ValidationError} If hex color is invalid
 */
function validateHexColor(hexColor, fieldName = 'hexColor') {
  if (!hexColor || typeof hexColor !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  const trimmed = hexColor.trim();

  if (!config.validation.hexColor.test(trimmed)) {
    throw new ValidationError(
      `Invalid hex color format. Must be #RRGGBB or #AARRGGBB: ${hexColor}`,
      fieldName,
      { provided: hexColor }
    );
  }

  // Ensure it has # prefix
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

/**
 * Validates a business type key
 * @param {string} businessTypeKey - Business type key to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {string} Validated business type key
 * @throws {ValidationError} If business type key is invalid
 */
function validateBusinessTypeKey(businessTypeKey, fieldName = 'businessTypeKey') {
  if (!businessTypeKey || typeof businessTypeKey !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  const trimmed = businessTypeKey.trim();

  if (!config.validation.businessTypeKey.test(trimmed)) {
    throw new ValidationError(
      `Invalid business type key format. Must start with a letter, contain only letters, numbers, and underscores: ${businessTypeKey}`,
      fieldName,
      { provided: businessTypeKey }
    );
  }

  // Additional security: prevent path traversal
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new ValidationError(
      `Business type key contains invalid path characters: ${businessTypeKey}`,
      fieldName,
      { provided: businessTypeKey }
    );
  }

  return trimmed;
}

/**
 * Validates a path-safe string (for use in file/directory names)
 * @param {string} value - Value to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {string} Validated value
 * @throws {ValidationError} If value contains unsafe characters
 */
function validatePathSafe(value, fieldName = 'value') {
  if (!value || typeof value !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  const trimmed = value.trim();

  // Check for path traversal
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new ValidationError(
      `${fieldName} contains path traversal characters: ${value}`,
      fieldName,
      { provided: value }
    );
  }

  // Check for unsafe characters
  if (!config.validation.pathSafe.test(trimmed)) {
    throw new ValidationError(
      `${fieldName} contains invalid characters. Only letters, numbers, hyphens, and underscores allowed: ${value}`,
      fieldName,
      { provided: value }
    );
  }

  return trimmed;
}

/**
 * Validates an Apple Team ID
 * @param {string} teamId - Team ID to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {string} Validated team ID
 * @throws {ValidationError} If team ID is invalid
 */
function validateAppleTeamId(teamId, fieldName = 'appleTeamId') {
  if (!teamId || typeof teamId !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  const trimmed = teamId.trim().toUpperCase();

  if (!config.validation.appleTeamId.test(trimmed)) {
    throw new ValidationError(
      `Invalid Apple Team ID format. Must be 10 alphanumeric characters: ${teamId}`,
      fieldName,
      { provided: teamId }
    );
  }

  return trimmed;
}

/**
 * Validates a Git URL
 * @param {string} gitUrl - Git URL to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {string} Validated Git URL
 * @throws {ValidationError} If Git URL is invalid
 */
function validateGitUrl(gitUrl, fieldName = 'gitUrl') {
  if (!gitUrl || typeof gitUrl !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  const trimmed = gitUrl.trim();

  // Support both HTTPS and SSH git URLs
  const httpsPattern = /^https:\/\/.+\.git$/;
  const sshPattern = /^git@.+:.+\.git$/;

  if (!httpsPattern.test(trimmed) && !sshPattern.test(trimmed)) {
    // Try to parse as URL for more validation
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'https:' && url.protocol !== 'ssh:' && url.protocol !== 'git:') {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      throw new ValidationError(
        `Invalid Git URL format. Must be HTTPS (https://...) or SSH (git@...): ${gitUrl}`,
        fieldName,
        { provided: gitUrl }
      );
    }
  }

  return trimmed;
}

/**
 * Validates that a file path exists and is safe
 * @param {string} filePath - File path to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {string} Normalized path
 * @throws {ValidationError} If path is invalid or unsafe
 */
function validateFilePath(filePath, fieldName = 'filePath') {
  if (!filePath || typeof filePath !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  const trimmed = filePath.trim();

  // Normalize and resolve the path
  const normalized = path.normalize(trimmed);
  const resolved = path.resolve(normalized);

  // Ensure the resolved path doesn't escape the project directory
  const projectRoot = path.resolve(__dirname, '../..');
  if (!resolved.startsWith(projectRoot)) {
    throw new ValidationError(`Path escapes project directory: ${filePath}`, fieldName, {
      provided: filePath,
      resolved,
    });
  }

  return normalized;
}

/**
 * Checks if a path/string is safe from path traversal attacks
 * @param {string} value - Value to check
 * @param {Object} options - Options
 * @param {string} options.baseDir - Base directory to validate against (optional)
 * @returns {{ safe: boolean, reason?: string }} Result with reason if unsafe
 */
function isPathTraversalSafe(value, options = {}) {
  if (!value || typeof value !== 'string') {
    return { safe: false, reason: 'Empty or invalid value' };
  }

  const trimmed = value.trim();

  // Check for obvious path traversal patterns
  if (trimmed.includes('..')) {
    return { safe: false, reason: 'Contains parent directory reference (..)' };
  }

  // Check for absolute paths when not expected
  if (path.isAbsolute(trimmed) && !options.allowAbsolute) {
    return { safe: false, reason: 'Absolute paths not allowed' };
  }

  // Check for null bytes (can be used to bypass filters)
  if (trimmed.includes('\0')) {
    return { safe: false, reason: 'Contains null byte' };
  }

  // If baseDir provided, ensure resolved path stays within it
  if (options.baseDir) {
    const resolved = path.resolve(options.baseDir, trimmed);
    const normalizedBase = path.resolve(options.baseDir);
    if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
      return { safe: false, reason: 'Path escapes base directory' };
    }
  }

  return { safe: true };
}

/**
 * Asserts that a path is safe from traversal attacks
 * @param {string} value - Value to check
 * @param {string} fieldName - Field name for error messages
 * @param {Object} options - Options (same as isPathTraversalSafe)
 * @returns {string} The value if safe
 * @throws {ValidationError} If path is unsafe
 */
function assertPathSafe(value, fieldName = 'path', options = {}) {
  const result = isPathTraversalSafe(value, options);
  if (!result.safe) {
    throw new ValidationError(`${fieldName} failed security check: ${result.reason}`, fieldName, {
      provided: value,
    });
  }
  return value;
}

/**
 * Sanitizes a string for safe use in shell commands
 * @param {string} value - Value to sanitize
 * @returns {string} Sanitized value
 */
function sanitizeForShell(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  // Remove potentially dangerous characters
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
  validateEmail,
  validateClientCode,
  validateBundleId,
  validateHexColor,
  validateBusinessTypeKey,
  validatePathSafe,
  validateAppleTeamId,
  validateGitUrl,
  validateFilePath,
  isPathTraversalSafe,
  assertPathSafe,
  sanitizeForShell,
  validateRequiredFields,
  validateEnvironmentVariables,
};
