const path = require('path');
const logger = require('../../shared/utils/logger');
const { COMPOSE_ROOT } = require('../../shared/utils/paths');

class BuildExecutor {
  constructor(execFn, repoPath) {
    this.exec = execFn;
    this.repoPath = repoPath;
    this.fastlaneDir = path.join(__dirname, '../fastlane');
  }

  validateAssets() {
    logger.startSpinner('Validating assets...');
    try {
      this.exec('npm run validate-assets', { silent: true, cwd: COMPOSE_ROOT });
      logger.succeedSpinner('Assets validated');
      return true;
    } catch (error) {
      logger.failSpinner('Asset validation failed');
      throw error;
    }
  }

  incrementBuildNumber() {
    logger.startSpinner('Incrementing build number...');
    try {
      this.exec('npm run increment-build', { silent: true, cwd: COMPOSE_ROOT });
      logger.succeedSpinner('Build number incremented');
      return true;
    } catch (error) {
      logger.failSpinner('Failed to increment build number');
      throw error;
    }
  }

  runWhiteLabelSetup(clientName, deployMode = false) {
    const modeLabel = deployMode ? 'validation' : 'setup';
    logger.startSpinner(`Running white-label ${modeLabel}...`);
    try {
      const modeFlag = deployMode ? ' --deploy-mode' : '';
      this.exec(`npm run start -- ${clientName}${modeFlag}`, { silent: false, cwd: COMPOSE_ROOT });
      logger.succeedSpinner(`White-label ${modeLabel} completed`);
      return true;
    } catch (error) {
      logger.failSpinner(`White-label ${modeLabel} failed`);
      throw error;
    }
  }

  buildAndroid(clientName) {
    logger.startSpinner('Building Android app...');
    try {
      this.exec(`fastlane android build client:${clientName}`, {
        cwd: this.fastlaneDir,
        silent: false,
      });
      logger.succeedSpinner('Android build completed');
      return true;
    } catch (error) {
      logger.failSpinner('Android build failed');
      throw error;
    }
  }

  buildIos(clientName) {
    if (process.platform !== 'darwin') {
      logger.warn('Skipping iOS build (not on macOS)');
      return false;
    }
    logger.startSpinner('Building iOS app...');
    try {
      this.exec(`fastlane ios build client:${clientName}`, {
        cwd: this.fastlaneDir,
        silent: false,
      });
      logger.succeedSpinner('iOS build completed');
      return true;
    } catch (error) {
      logger.failSpinner('iOS build failed');
      throw error;
    }
  }

  deployAndroid(clientName, track = 'internal') {
    logger.startSpinner(`Deploying Android to ${track}...`);
    try {
      this.exec(`fastlane android deploy_${track} client:${clientName}`, {
        cwd: this.fastlaneDir,
        silent: false,
      });
      logger.succeedSpinner(`Android deployed to ${track}`);
      return true;
    } catch (error) {
      logger.failSpinner('Android deployment failed');
      throw error;
    }
  }

  deployIos(clientName, target = 'testflight') {
    if (process.platform !== 'darwin') {
      logger.warn('Skipping iOS deployment (not on macOS)');
      return false;
    }
    logger.startSpinner(`Deploying iOS to ${target}...`);
    try {
      this.exec(`fastlane ios deploy_${target} client:${clientName}`, {
        cwd: this.fastlaneDir,
        silent: false,
      });
      logger.succeedSpinner(`iOS deployed to ${target}`);
      return true;
    } catch (error) {
      logger.failSpinner('iOS deployment failed');
      throw error;
    }
  }
}

module.exports = BuildExecutor;
