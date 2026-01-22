const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const { LOYALTY_CREDENTIALS_ROOT } = require('../paths');

function createIosChecks(context) {
  const { setFailed } = context;

  function checkIosCertificatesSetup(clientCode = null) {
    if (process.platform !== 'darwin') {
      return true;
    }

    logger.startSpinner('Checking iOS certificates setup...');

    const requiredEnvVars = [
      'MATCH_GIT_URL',
      'MATCH_PASSWORD',
      'APPLE_TEAM_ID',
      'APP_STORE_CONNECT_API_KEY_ID',
      'APP_STORE_CONNECT_API_ISSUER_ID',
      'APP_STORE_CONNECT_API_KEY',
    ];

    const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingEnvVars.length > 0) {
      logger.failSpinner('iOS certificate environment variables not set');
      logger.warn('The following variables are required for iOS certificate generation:');
      missingEnvVars.forEach((varName) => logger.warn(`  - ${varName}`));
      logger.info('Add these to your .env file to enable iOS builds');
      return false;
    }

    if (!clientCode) {
      logger.succeedSpinner('iOS certificate environment variables set');
      return true;
    }

    const iosClientDir = path.join(LOYALTY_CREDENTIALS_ROOT, 'clients', clientCode, 'ios');

    if (!fs.existsSync(iosClientDir)) {
      logger.failSpinner(`iOS certificates not found for client: ${clientCode}`);
      logger.error('Client does not have iOS provisioning profiles');
      logger.info('Generate certificates: npm run setup:ios');
      setFailed();
      return false;
    }

    const profiles = fs.readdirSync(iosClientDir).filter((f) => f.endsWith('.mobileprovision'));

    if (profiles.length === 0) {
      logger.failSpinner(`No iOS provisioning profiles for ${clientCode}`);
      logger.error('Client directory exists but no .mobileprovision files found');
      logger.info('Generate certificates: npm run setup:ios');
      setFailed();
      return false;
    }

    const profileText = profiles.length > 1 ? 'profiles' : 'profile';
    logger.succeedSpinner(
      `iOS certificates ready${clientCode ? ` for ${clientCode} (${profiles.length} ${profileText})` : ''}`
    );
    return true;
  }

  return {
    checkIosCertificatesSetup,
  };
}

module.exports = { createIosChecks };
