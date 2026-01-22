const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const { LOYALTY_CREDENTIALS_ROOT } = require('../paths');

function createKeystoreChecks(context) {
  const { commandExists, setFailed } = context;

  function checkAndroidKeystoreSetup(clientCode = null) {
    logger.startSpinner('Checking Android keystore setup...');

    if (!commandExists('keytool')) {
      logger.failSpinner('keytool not found');
      logger.warn('Java keytool is required for Android keystore generation');
      logger.info('Install: brew install openjdk');
      logger.info('Or visit: https://adoptium.net/');
      return false;
    }

    if (!clientCode) {
      logger.succeedSpinner('keytool available (Java installed)');
      return true;
    }

    const androidDir = path.join(LOYALTY_CREDENTIALS_ROOT, 'clients', clientCode, 'android');

    if (!fs.existsSync(androidDir)) {
      logger.failSpinner(`Android keystores not found for client: ${clientCode}`);
      logger.error('Client does not have Android keystores');
      logger.info('Generate keystores: npm run setup:keystore');
      setFailed();
      return false;
    }

    const keystoreDebug = path.join(androidDir, 'keystore-debug.jks');
    const keystoreRelease = path.join(androidDir, 'keystore-release.jks');
    const keystoreProps = path.join(androidDir, 'keystore.properties');

    const missingFiles = [];
    if (!fs.existsSync(keystoreDebug)) missingFiles.push('keystore-debug.jks');
    if (!fs.existsSync(keystoreRelease)) missingFiles.push('keystore-release.jks');
    if (!fs.existsSync(keystoreProps)) missingFiles.push('keystore.properties');

    if (missingFiles.length > 0) {
      logger.failSpinner(`Missing Android keystore files for ${clientCode}`);
      missingFiles.forEach((file) => logger.error(`  Missing: ${file}`));
      logger.info('Generate keystores: npm run setup:keystore');
      setFailed();
      return false;
    }

    logger.succeedSpinner(`Android keystores ready${clientCode ? ` for ${clientCode}` : ''}`);
    return true;
  }

  return {
    checkAndroidKeystoreSetup,
  };
}

module.exports = { createKeystoreChecks };
