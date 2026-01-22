const fs = require('fs');
const path = require('path');
const logger = require('../logger');

function createEnvironmentChecks(context) {
  const { setFailed } = context;

  function checkEnvVariables() {
    logger.startSpinner('Checking environment variables...');

    const required = ['MASTER_FIREBASE_PROJECT_ID', 'GOOGLE_APPLICATION_CREDENTIALS'];
    const missing = [];

    required.forEach((varName) => {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    });

    if (missing.length > 0) {
      logger.failSpinner('Missing environment variables');
      missing.forEach((varName) => {
        logger.error(`${varName} is not set`);
      });
      logger.info('Create a .env file with required variables');
      setFailed();
      return false;
    }

    logger.succeedSpinner('All required environment variables are set');
    return true;
  }

  function checkCredentialFiles() {
    logger.startSpinner('Checking credential files...');

    const files = [
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      process.env.MASTER_FIREBASE_SERVICE_ACCOUNT,
    ].filter(Boolean);

    const missing = [];

    files.forEach((file) => {
      const resolvedPath = path.isAbsolute(file) ? file : path.join(__dirname, '../../../', file);

      if (!fs.existsSync(resolvedPath)) {
        missing.push(resolvedPath);
      }
    });

    if (missing.length > 0) {
      logger.failSpinner('Missing credential files');
      missing.forEach((file) => {
        logger.error(`File not found: ${file}`);
      });
      setFailed();
      return false;
    }

    logger.succeedSpinner('All credential files found');
    return true;
  }

  return {
    checkEnvVariables,
    checkCredentialFiles,
  };
}

module.exports = { createEnvironmentChecks };
