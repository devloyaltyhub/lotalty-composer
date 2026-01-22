const fs = require('fs');
const path = require('path');
const logger = require('../../../shared/utils/logger');
const clientSelector = require('../../../shared/utils/client-selector');

class MetadataChecker {
  constructor(clientName, config, checkResult) {
    this.clientName = clientName;
    this.clientDir = clientSelector.getClientDir(clientName);
    this.config = config;
    this.checkResult = checkResult;
  }

  check() {
    logger.info('Checking app store metadata...');

    const metadataDir = path.join(this.clientDir, 'metadata');

    if (!fs.existsSync(metadataDir)) {
      this.checkResult.fail('Metadata directory not found');
      return false;
    }

    const locale = this.config?.locale || 'pt-BR';

    const androidMetadata = path.join(metadataDir, 'android', locale, 'title.txt');
    if (!fs.existsSync(androidMetadata)) {
      this.checkResult.fail('Android metadata incomplete');
    } else {
      this.checkResult.pass('Android metadata exists');
    }

    const iosMetadata = path.join(metadataDir, 'ios', locale, 'name.txt');
    if (!fs.existsSync(iosMetadata)) {
      this.checkResult.fail('iOS metadata incomplete');
    } else {
      this.checkResult.pass('iOS metadata exists');
    }

    return true;
  }

  checkScreenshots() {
    logger.info('Checking screenshots...');

    const loyaltyAppRoot = path.join(__dirname, '..', '..', '..', '..');
    const metadataDir = path.join(loyaltyAppRoot, 'white_label_app', 'metadata');

    const androidScreenshots = path.join(metadataDir, 'android', 'pt-BR', 'images', 'phoneScreenshots');
    let androidCount = 0;

    if (fs.existsSync(androidScreenshots)) {
      androidCount = fs.readdirSync(androidScreenshots).filter((f) => f.endsWith('.png')).length;
    }

    if (androidCount < 2) {
      this.checkResult.warn(`Android screenshots: ${androidCount} (minimo 2 necessarios para Play Store)`);
    } else {
      this.checkResult.pass(`Android screenshots: ${androidCount}`);
    }

    const iosScreenshots = path.join(metadataDir, 'ios', 'pt-BR', 'APP_IPHONE_65');
    let iosCount = 0;

    if (fs.existsSync(iosScreenshots)) {
      iosCount = fs.readdirSync(iosScreenshots).filter((f) => f.endsWith('.png')).length;
    }

    if (iosCount < 2) {
      this.checkResult.warn(`iOS screenshots (6.5"): ${iosCount} (minimo 2 necessarios para App Store)`);
    } else {
      this.checkResult.pass(`iOS screenshots (6.5"): ${iosCount}`);
    }

    const iosSizes = ['APP_IPHONE_55', 'APP_IPAD_PRO_129'];
    for (const size of iosSizes) {
      const sizePath = path.join(metadataDir, 'ios', 'pt-BR', size);
      if (fs.existsSync(sizePath)) {
        const count = fs.readdirSync(sizePath).filter((f) => f.endsWith('.png')).length;
        if (count > 0) {
          this.checkResult.pass(`iOS screenshots (${size}): ${count}`);
        }
      }
    }

    return androidCount >= 2 || iosCount >= 2;
  }
}

module.exports = MetadataChecker;
