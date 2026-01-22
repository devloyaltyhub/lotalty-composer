const fs = require('fs');
const logger = require('../../shared/utils/logger');
const {
  PROJECT_CONFIGS,
  IOS_DEVICES,
  ANDROID_DEVICES,
  getProjectConfig,
} = require('./screenshot-device-configs');
const ScreenshotAndroidCopier = require('./screenshot-android-copier');
const ScreenshotIosCopier = require('./screenshot-ios-copier');

class ScreenshotMetadataCopier {
  constructor(clientCode, repoPath = process.cwd(), projectKey = 'app') {
    this.clientCode = clientCode;
    this.repoPath = repoPath;
    this.projectKey = projectKey;

    this.projectConfig = getProjectConfig(projectKey);

    this.screenshotsDir = this.projectConfig.screenshotsDir(repoPath);
    this.mockupsDir = this.projectConfig.mockupsDir(repoPath);
    this.outputMetadataDir = this.projectConfig.metadataDir(repoPath);

    this.generateIos = this.projectConfig.generateIos;
    this.generateAndroid = this.projectConfig.generateAndroid;
    this.cleanupAfterCopy = this.projectConfig.cleanupAfterCopy;

    this.androidCopier = new ScreenshotAndroidCopier(this.mockupsDir, this.outputMetadataDir);
    this.iosCopier = new ScreenshotIosCopier(this.mockupsDir, this.outputMetadataDir);
  }

  removeDir(dir) {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const dirPath = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        this.removeDir(dirPath);
      } else {
        fs.unlinkSync(dirPath);
      }
    }
    fs.rmdirSync(dir);
  }

  cleanupScreenshotsDir() {
    if (!fs.existsSync(this.screenshotsDir)) {
      return;
    }

    logger.startSpinner('Limpando pasta temporaria de screenshots...');
    try {
      this.removeDir(this.screenshotsDir);
      logger.succeedSpinner('Pasta white_label_app/screenshots/ removida');
    } catch (error) {
      logger.failSpinner(`Erro ao limpar pasta screenshots: ${error.message}`);
    }
  }

  copyAll() {
    logger.section(`Copiando Screenshots para ${this.projectConfig.name}`);

    if (!fs.existsSync(this.mockupsDir)) {
      logger.error(`Diretorio de mockups nao encontrado: ${this.mockupsDir}`);
      logger.info('Execute o pipeline de screenshots primeiro para gerar os mockups');
      return { android: { count: 0 }, ios: {} };
    }

    const results = {
      android: this.generateAndroid ? this.androidCopier.copyToAndroid() : { skipped: true },
      ios: this.generateIos ? this.iosCopier.copyToIos() : { skipped: true },
    };

    logger.blank();
    logger.info('Screenshots copiados:');

    if (this.generateAndroid) {
      for (const [deviceKey, device] of Object.entries(ANDROID_DEVICES)) {
        const count = results.android[deviceKey]?.count || 0;
        logger.keyValue(`  Android ${device.name}`, `${count} arquivos`);
      }
      if (results.android.featureGraphic?.copied) {
        logger.keyValue(`  Android Feature Graphic`, `1 arquivo (1024x500)`);
      }
    } else {
      logger.info('  Android: ignorado (projeto não gera iOS)');
    }

    if (this.generateIos) {
      const iosTotal = Object.values(results.ios).reduce((sum, r) => sum + (r?.count || 0), 0);
      logger.keyValue(`  iOS (pt-BR/)`, `${iosTotal} arquivos`);
      for (const [deviceKey, device] of Object.entries(IOS_DEVICES)) {
        const count = results.ios[deviceKey]?.count || 0;
        if (count > 0) {
          logger.keyValue(`    - ${device.name}`, `${count} arquivos`);
        }
      }
    } else {
      logger.info('  iOS: ignorado (projeto não gera iOS)');
    }

    logger.blank();
    logger.info(`Destino: ${this.outputMetadataDir}`);
    if (this.generateIos) {
      logger.info(`iOS: Screenshots em metadata/ios/pt-BR/ (Fastlane detecta device por resolucao)`);
    }

    if (this.cleanupAfterCopy) {
      this.cleanupScreenshotsDir();
    }

    return results;
  }

  static getDeviceConfigs() {
    return {
      ios: IOS_DEVICES,
      android: ANDROID_DEVICES,
    };
  }
}

module.exports = {
  ScreenshotMetadataCopier,
  IOS_DEVICES,
  ANDROID_DEVICES,
  PROJECT_CONFIGS,
  getProjectConfig,
};
