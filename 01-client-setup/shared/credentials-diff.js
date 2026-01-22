const logger = require('../../shared/utils/logger');

/**
 * Keys that should be compared between old and new credentials
 */
const CREDENTIAL_KEYS_TO_CHECK = [
  'iosAppId',
  'iosApiKey',
  'androidAppId',
  'androidApiKey',
  'webAppId',
  'webApiKey',
];

/**
 * Show diff between old and new credentials
 * @param {string} clientCode - Client identifier
 * @param {Object|null} oldCreds - Old credentials from Master Firebase
 * @param {Object} newCreds - New credentials parsed from firebase_options.dart
 * @returns {boolean} True if there are changes
 */
function showCredentialsDiff(clientCode, oldCreds, newCreds) {
  logger.section(`Changes for: ${clientCode}`);

  let hasChanges = false;

  for (const key of CREDENTIAL_KEYS_TO_CHECK) {
    const oldValue = oldCreds?.[key];
    const newValue = newCreds[key];

    if (oldValue !== newValue) {
      hasChanges = true;
      logger.blank();
      logger.info(`${key}:`);

      if (oldValue) {
        logger.error(`  Old: ${oldValue}`);
      } else {
        logger.warn(`  Old: (not set)`);
      }

      if (newValue) {
        logger.success(`  New: ${newValue}`);
      } else {
        logger.warn(`  New: (not set)`);
      }

      logPlatformMismatchWarning(key, oldValue);
    }
  }

  if (!hasChanges) {
    logger.success('No changes needed - credentials are correct');
  }

  logger.blank();
  return hasChanges;
}

/**
 * Log warning for platform mismatches (e.g., iOS App ID set to Android value)
 * @param {string} key - Credential key
 * @param {string|null} oldValue - Old credential value
 */
function logPlatformMismatchWarning(key, oldValue) {
  if (key === 'iosAppId' && oldValue && oldValue.includes(':android:')) {
    logger.warn(`  ISSUE: iOS App ID was set to Android value!`);
  }
  if (key === 'androidAppId' && oldValue && oldValue.includes(':ios:')) {
    logger.warn(`  ISSUE: Android App ID was set to iOS value!`);
  }
}

/**
 * Compare credentials and return change details
 * @param {Object|null} oldCreds - Old credentials
 * @param {Object} newCreds - New credentials
 * @returns {Object} Comparison result with hasChanges and details
 */
function compareCredentials(oldCreds, newCreds) {
  const changes = [];

  for (const key of CREDENTIAL_KEYS_TO_CHECK) {
    const oldValue = oldCreds?.[key];
    const newValue = newCreds[key];

    if (oldValue !== newValue) {
      changes.push({
        key,
        oldValue,
        newValue,
        isPlatformMismatch:
          (key === 'iosAppId' && oldValue?.includes(':android:')) ||
          (key === 'androidAppId' && oldValue?.includes(':ios:')),
      });
    }
  }

  return {
    hasChanges: changes.length > 0,
    changes,
  };
}

module.exports = {
  showCredentialsDiff,
  compareCredentials,
  CREDENTIAL_KEYS_TO_CHECK,
};
