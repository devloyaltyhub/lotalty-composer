/**
 * Path validation utilities
 * Validates file paths, path safety, and prevents path traversal attacks
 */

const path = require('path');
const config = require('../../config');
const { ValidationError } = require('../../../shared/utils/error-handler');

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

  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new ValidationError(
      `${fieldName} contains path traversal characters: ${value}`,
      fieldName,
      { provided: value }
    );
  }

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
  const normalized = path.normalize(trimmed);
  const resolved = path.resolve(normalized);

  const projectRoot = path.resolve(__dirname, '../../..');
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
 * @param {boolean} options.allowAbsolute - Allow absolute paths (optional)
 * @returns {{ safe: boolean, reason?: string }} Result with reason if unsafe
 */
function isPathTraversalSafe(value, options = {}) {
  if (!value || typeof value !== 'string') {
    return { safe: false, reason: 'Empty or invalid value' };
  }

  const trimmed = value.trim();

  if (trimmed.includes('..')) {
    return { safe: false, reason: 'Contains parent directory reference (..)' };
  }

  if (path.isAbsolute(trimmed) && !options.allowAbsolute) {
    return { safe: false, reason: 'Absolute paths not allowed' };
  }

  if (trimmed.includes('\0')) {
    return { safe: false, reason: 'Contains null byte' };
  }

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

module.exports = {
  validatePathSafe,
  validateFilePath,
  isPathTraversalSafe,
  assertPathSafe,
};
