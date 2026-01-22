const fs = require('fs');
const clientSelector = require('../../../shared/utils/client-selector');
const logger = require('../../../shared/utils/logger');

class ConfigChecker {
  constructor(clientName, checkResult) {
    this.clientName = clientName;
    this.checkResult = checkResult;
  }

  check() {
    logger.info('Checking configuration...');

    try {
      const configPath = clientSelector.getClientConfigPath(this.clientName);

      if (!fs.existsSync(configPath)) {
        this.checkResult.fail('Config file not found');
        return null;
      }

      const config = clientSelector.loadClientConfig(this.clientName);

      const requiredFields = [
        'clientName',
        'clientCode',
        'bundleId',
        'firebaseProjectId',
        'adminEmail',
        'businessType',
      ];

      const missing = requiredFields.filter((field) => !config[field]);

      if (missing.length > 0) {
        this.checkResult.fail(`Config missing fields: ${missing.join(', ')}`);
        return null;
      }

      this.checkResult.pass('Config file valid');
      return config;
    } catch (error) {
      this.checkResult.fail(`Config error: ${error.message}`);
      return null;
    }
  }
}

module.exports = ConfigChecker;
