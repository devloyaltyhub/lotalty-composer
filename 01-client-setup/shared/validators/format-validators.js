/**
 * Format validation utilities
 * Validates format patterns for emails, client codes, bundle IDs, etc.
 */

const { URL } = require('url');
const config = require('../../config');
const { ValidationError } = require('../../../shared/utils/error-handler');

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

  const httpsPattern = /^https:\/\/.+\.git$/;
  const sshPattern = /^git@.+:.+\.git$/;

  if (!httpsPattern.test(trimmed) && !sshPattern.test(trimmed)) {
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

module.exports = {
  validateEmail,
  validateClientCode,
  validateBundleId,
  validateHexColor,
  validateBusinessTypeKey,
  validateAppleTeamId,
  validateGitUrl,
};
