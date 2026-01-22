const fs = require('fs');
const path = require('path');
const logger = require('../../../shared/utils/logger');
const clientSelector = require('../../../shared/utils/client-selector');

class AssetChecker {
  constructor(clientName, checkResult) {
    this.clientName = clientName;
    this.clientDir = clientSelector.getClientDir(clientName);
    this.checkResult = checkResult;
  }

  check() {
    logger.info('Checking assets...');

    const assetsDir = path.join(this.clientDir, 'assets');

    if (!fs.existsSync(assetsDir)) {
      this.checkResult.fail('Assets directory not found');
      return false;
    }

    const clientSpecificDir = path.join(assetsDir, 'client_specific_assets');

    if (!fs.existsSync(clientSpecificDir)) {
      this.checkResult.fail('client_specific_assets directory not found');
      return false;
    }

    const requiredAssets = ['logo.png', 'transparent-logo.png'];
    const missingAssets = requiredAssets.filter(
      (asset) => !fs.existsSync(path.join(clientSpecificDir, asset))
    );

    if (missingAssets.length > 0) {
      this.checkResult.fail(`Missing client assets: ${missingAssets.join(', ')}`);
      return false;
    }

    this.checkResult.pass('Client-specific assets complete');
    return true;
  }
}

module.exports = AssetChecker;
