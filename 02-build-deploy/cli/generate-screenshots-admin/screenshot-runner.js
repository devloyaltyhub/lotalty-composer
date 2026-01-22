const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const logger = require('../../../shared/utils/logger');

class ScreenshotRunner {
  constructor(adminRoot, screenshotsDir) {
    this.adminRoot = adminRoot;
    this.screenshotsDir = screenshotsDir;
  }

  exec(command, options = {}) {
    try {
      return execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: options.cwd || this.adminRoot,
        ...options,
      }).trim();
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  checkIntegrationTests() {
    const testFile = path.join(this.adminRoot, 'integration_test', 'all_screenshots_test.dart');
    const testDriver = path.join(this.adminRoot, 'test_driver', 'integration_test.dart');

    if (!fs.existsSync(testFile)) {
      throw new Error(`Integration test nao encontrado: ${testFile}`);
    }

    if (!fs.existsSync(testDriver)) {
      throw new Error(`Test driver nao encontrado: ${testDriver}`);
    }

    return true;
  }

  runIntegrationTest(deviceId, deviceType = 'phone') {
    logger.section(`Capturando Screenshots: ${deviceType.toUpperCase()}`);

    logger.info(`Dispositivo: ${deviceId}`);
    logger.blank();

    const screenshotsPattern = path.join(this.screenshotsDir, '*.png');
    try {
      this.exec(`rm -f ${screenshotsPattern}`, { silent: true });
    } catch {
      // Ignore if no files to delete
    }

    logger.startSpinner('Executando integration tests no Android...');

    try {
      this.exec(
        `flutter drive \
          --driver=test_driver/integration_test.dart \
          --target=integration_test/all_screenshots_test.dart \
          -d ${deviceId}`,
        { cwd: this.adminRoot }
      );

      logger.succeedSpinner('Integration tests concluidos');

      const screenshots = fs.readdirSync(this.screenshotsDir).filter((f) => f.endsWith('.png'));

      if (screenshots.length === 0) {
        logger.warn('Nenhum screenshot capturado. Verifique os logs do teste.');
        return false;
      }

      logger.success(`${screenshots.length} screenshots capturados com sucesso`);
      return true;
    } catch (error) {
      logger.failSpinner('Integration tests falharam');
      throw error;
    }
  }
}

module.exports = ScreenshotRunner;
