const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');
const { IOS_DEVICES, SOURCE_FOLDER_MAPPING } = require('./screenshot-device-configs');

class ScreenshotIosCopier {
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

  removeDir(dir) {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.removeDir(fullPath);
      } else {
        fs.unlinkSync(fullPath);
      }
    }
    fs.rmdirSync(dir);
  }

  copyIosScreenshots(deviceKey, sourceSubdir, destDir) {
    const device = IOS_DEVICES[deviceKey];
    if (!device) {
      logger.warn(`Dispositivo iOS desconhecido: ${deviceKey}`);
      return { count: 0, files: [] };
    }

    const sourceDir = path.join(this.mockupsDir, sourceSubdir);
    const files = this.getScreenshotFiles(sourceDir);

    if (files.length === 0) {
      return { count: 0, files: [] };
    }

    const copiedFiles = [];
    files.forEach((file) => {
      const src = path.join(sourceDir, file);

      let destFilename = file;
      if (device.filenameSuffix) {
        const ext = path.extname(file);
        const basename = path.basename(file, ext);
        destFilename = `${basename}${device.filenameSuffix}${ext}`;
      }

      const dest = path.join(destDir, destFilename);
      fs.copyFileSync(src, dest);
      copiedFiles.push(destFilename);
    });

    return { count: files.length, files: copiedFiles };
  }

  copyToIos() {
    logger.startSpinner('Copiando screenshots para iOS...');

    const destDir = path.join(this.outputMetadataDir, 'ios', 'pt-BR');
    this.ensureDir(destDir);

    const existingFiles = fs.readdirSync(destDir).filter((f) => f.endsWith('.png'));
    existingFiles.forEach((file) => fs.unlinkSync(path.join(destDir, file)));

    const oldDeviceFolders = ['APP_IPHONE_55', 'APP_IPHONE_65', 'APP_IPHONE_67', 'APP_IPAD_PRO_129'];
    for (const folder of oldDeviceFolders) {
      const oldPath = path.join(destDir, folder);
      if (fs.existsSync(oldPath)) {
        this.removeDir(oldPath);
        logger.info(`  Removida pasta antiga: ${folder}`);
      }
    }

    const results = {};
    let totalCount = 0;

    for (const deviceKey of Object.keys(IOS_DEVICES)) {
      const sourceSubdir = SOURCE_FOLDER_MAPPING[deviceKey];
      if (sourceSubdir) {
        results[deviceKey] = this.copyIosScreenshots(deviceKey, sourceSubdir, destDir);
        totalCount += results[deviceKey].count;
      } else {
        results[deviceKey] = { count: 0, files: [] };
      }
    }

    if (totalCount === 0) {
      logger.failSpinner('Nenhum screenshot encontrado para iOS');
    } else {
      const iPhoneCount = results.APP_IPHONE_67?.count || 0;
      const iPadCount = results.APP_IPAD_PRO_129?.count || 0;
      logger.succeedSpinner(`iOS: ${iPhoneCount} iPhone + ${iPadCount} iPad screenshots copiados para pt-BR/`);
    }

    return results;
  }
}

module.exports = ScreenshotIosCopier;
