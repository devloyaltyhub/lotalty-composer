const fs = require('fs');
const logger = require('../logger');

function createPlatformChecks() {
  function checkMacOS() {
    logger.startSpinner('Checking operating system...');

    if (process.platform !== 'darwin') {
      logger.failSpinner('Not running on macOS');
      logger.warn('macOS is required for iOS builds');
      logger.info('Android builds will work, but iOS builds will fail');
      return false;
    }

    logger.succeedSpinner('Running on macOS');
    return true;
  }

  function checkAndroidSDK() {
    logger.startSpinner('Checking Android SDK...');

    const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

    if (!androidHome || !fs.existsSync(androidHome)) {
      logger.failSpinner('Android SDK not found');
      logger.warn('ANDROID_HOME environment variable not set or path does not exist');
      logger.info('Set ANDROID_HOME to your Android SDK path');
      return false;
    }

    logger.succeedSpinner(`Android SDK found: ${androidHome}`);
    return true;
  }

  return {
    checkMacOS,
    checkAndroidSDK,
  };
}

module.exports = { createPlatformChecks };
