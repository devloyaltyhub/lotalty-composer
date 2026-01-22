/**
 * Input validation utilities
 * Main entry point that aggregates all validators
 *
 * Validators are organized into modules:
 * - format-validators: Email, client code, bundle ID, hex color, business type, Apple team ID, Git URL
 * - path-validators: Path safety, file path, path traversal prevention
 * - utility-validators: Required fields, environment variables, shell sanitization
 */

const {
  validateEmail,
  validateClientCode,
  validateBundleId,
  validateHexColor,
  validateBusinessTypeKey,
  validateAppleTeamId,
  validateGitUrl,
} = require('./validators/format-validators');

const {
  validatePathSafe,
  validateFilePath,
  isPathTraversalSafe,
  assertPathSafe,
} = require('./validators/path-validators');

const {
  sanitizeForShell,
  validateRequiredFields,
  validateEnvironmentVariables,
} = require('./validators/utility-validators');

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
