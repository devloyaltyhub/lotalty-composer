const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const { WHITE_LABEL_APP_ROOT } = require('../paths');

function createWhiteLabelChecks(context) {
  const { setFailed } = context;

  function checkWhiteLabelAppConfig() {
    logger.startSpinner('Checking white_label_app configuration...');

    const whiteLabelPath = WHITE_LABEL_APP_ROOT;

    const requiredFiles = [
      { path: path.join(whiteLabelPath, 'config.json'), name: 'config.json' },
      { path: path.join(whiteLabelPath, 'pubspec.yaml'), name: 'pubspec.yaml' },
    ];

    const requiredDirs = [
      { path: path.join(whiteLabelPath, 'metadata'), name: 'metadata/' },
      {
        path: path.join(whiteLabelPath, 'assets', 'client_specific_assets'),
        name: 'assets/client_specific_assets/',
      },
    ];

    const missingFiles = [];
    const missingDirs = [];

    requiredFiles.forEach(({ path: filePath, name }) => {
      if (!fs.existsSync(filePath)) {
        missingFiles.push(name);
      }
    });

    requiredDirs.forEach(({ path: dirPath, name }) => {
      if (!fs.existsSync(dirPath)) {
        missingDirs.push(name);
      }
    });

    if (missingFiles.length > 0 || missingDirs.length > 0) {
      logger.failSpinner('white_label_app configuration incomplete');

      if (missingFiles.length > 0) {
        logger.error('Missing files:');
        missingFiles.forEach((file) => logger.error(`  - white_label_app/${file}`));
      }

      if (missingDirs.length > 0) {
        logger.error('Missing directories:');
        missingDirs.forEach((dir) => logger.error(`  - white_label_app/${dir}`));
      }

      logger.blank();
      logger.info('Run white-label setup first: npm run start');
      setFailed();
      return false;
    }

    try {
      const configPath = path.join(whiteLabelPath, 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      const requiredConfigFields = ['clientCode', 'clientName', 'bundleId'];
      const missingConfigFields = requiredConfigFields.filter((field) => !config[field]);

      if (missingConfigFields.length > 0) {
        logger.failSpinner('config.json missing required fields');
        logger.error('Missing fields in white_label_app/config.json:');
        missingConfigFields.forEach((field) => logger.error(`  - ${field}`));
        logger.blank();
        logger.info('Run white-label setup: npm run start');
        setFailed();
        return false;
      }

      logger.succeedSpinner(`white_label_app configured for: ${config.clientName} (${config.clientCode})`);
      return true;
    } catch (error) {
      logger.failSpinner('config.json is invalid');
      logger.error(`Error parsing config.json: ${error.message}`);
      setFailed();
      return false;
    }
  }

  return {
    checkWhiteLabelAppConfig,
  };
}

module.exports = { createWhiteLabelChecks };
