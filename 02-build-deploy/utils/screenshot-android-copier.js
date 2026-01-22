const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');
const { ANDROID_DEVICES, SOURCE_FOLDER_MAPPING } = require('./screenshot-device-configs');

class ScreenshotAndroidCopier {
  constructor(mockupsDir, outputMetadataDir) {
    this.mockupsDir = mockupsDir;
    this.outputMetadataDir = outputMetadataDir;
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  getScreenshotFiles(sourceDir) {
    if (!fs.existsSync(sourceDir)) {
      return [];
    }

    return fs
      .readdirSync(sourceDir)
      .filter((file) => file.endsWith('.png'))
      .sort();
  }

  copyToAndroidDevice(deviceKey) {
    const device = ANDROID_DEVICES[deviceKey];
    if (!device) {
      logger.warn(`Dispositivo Android desconhecido: ${deviceKey}`);
      return { count: 0, destination: null };
    }

    const sourceSubdir = SOURCE_FOLDER_MAPPING[device.folder] || '';
    const sourceDir = sourceSubdir ? path.join(this.mockupsDir, sourceSubdir) : this.mockupsDir;
    const destDir = path.join(this.outputMetadataDir, 'android', 'pt-BR', 'images', device.folder);

    this.ensureDir(destDir);

    const files = this.getScreenshotFiles(sourceDir);
    if (files.length === 0) {
      return { count: 0, destination: destDir };
    }

    const existingFiles = fs.readdirSync(destDir).filter((f) => f.endsWith('.png'));
    existingFiles.forEach((file) => fs.unlinkSync(path.join(destDir, file)));

    files.forEach((file) => {
      const src = path.join(sourceDir, file);
      const dest = path.join(destDir, file);
      fs.copyFileSync(src, dest);
    });

    return { count: files.length, destination: destDir };
  }

  copyFeatureGraphic() {
    const sourceSubdir = SOURCE_FOLDER_MAPPING.featureGraphic;
    const sourceDir = path.join(this.mockupsDir, sourceSubdir);
    const destDir = path.join(this.outputMetadataDir, 'android', 'pt-BR', 'images');

    this.ensureDir(destDir);

    const sourceFile = path.join(sourceDir, 'featureGraphic.png');
    const destFile = path.join(destDir, 'featureGraphic.png');

    if (!fs.existsSync(sourceFile)) {
      return { copied: false, destination: null };
    }

    if (fs.existsSync(destFile)) {
      fs.unlinkSync(destFile);
    }

    fs.copyFileSync(sourceFile, destFile);
    return { copied: true, destination: destFile };
  }

  copyToAndroid() {
    logger.startSpinner('Copiando screenshots para Android...');

    const results = {};
    let totalCount = 0;

    for (const deviceKey of Object.keys(ANDROID_DEVICES)) {
      results[deviceKey] = this.copyToAndroidDevice(deviceKey);
      totalCount += results[deviceKey].count;
    }

    results.featureGraphic = this.copyFeatureGraphic();

    if (totalCount === 0) {
      logger.failSpinner('Nenhum screenshot encontrado para Android');
    } else {
      const parts = [];
      if (results.phone?.count > 0) parts.push(`${results.phone.count} phone`);
      if (results.tablet?.count > 0) parts.push(`${results.tablet.count} tablet`);
      if (results.featureGraphic?.copied) parts.push('1 feature graphic');
      logger.succeedSpinner(`Android: ${parts.join(' + ')} copiados`);
    }

    return results;
  }
}

module.exports = ScreenshotAndroidCopier;
