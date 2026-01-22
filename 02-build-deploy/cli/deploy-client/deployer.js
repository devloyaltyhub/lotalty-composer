/**
 * ClientDeployer class - Orchestrates the full deployment pipeline
 */

const logger = require('../../../shared/utils/logger');
const telegram = require('../../../shared/utils/telegram');
const ClientBuilder = require('../../build-client');
const { LOYALTY_APP_ROOT } = require('../../../shared/utils/paths');
const { promptDeployTargets } = require('./prompts');
const {
  validatePrerequisites,
  setupEnvironment,
  generateScreenshots,
  buildApps,
  uploadAndSubmit,
  finalize,
} = require('./pipeline-phases');
const { deployExistingBuild, promoteExistingAndroidBuild } = require('./existing-build-flows');

const REPO_PATH = LOYALTY_APP_ROOT;

class ClientDeployer extends ClientBuilder {
  constructor(clientCode, options = {}) {
    super(REPO_PATH);
    this.clientCode = clientCode;
    this.options = options;
    this.config = null;
    this.version = null;
    this.buildNumber = null;
    this.manualVersion = options.version || null;
    this.addLogo = options.addLogo !== undefined ? options.addLogo : true;
    this.submitExistingBuild = options.submitExistingBuild || null;
    this.submitExistingVersion = options.submitExistingVersion || null;
    this.promoteAndroidBuild = options.promoteAndroidBuild || null;
    this.promoteAndroidVersion = options.promoteAndroidVersion || null;
    this.deployTargets = {
      android: null,
      ios: null,
    };
  }

  async promptDeployTargets() {
    return promptDeployTargets(this);
  }

  async validatePrerequisites() {
    return validatePrerequisites(this);
  }

  async setupEnvironment() {
    return setupEnvironment(this);
  }

  async generateScreenshots() {
    return generateScreenshots(this);
  }

  async buildApps() {
    return buildApps(this);
  }

  async uploadAndSubmit() {
    return uploadAndSubmit(this);
  }

  async finalize(platforms) {
    return finalize(this, platforms);
  }

  async deployExistingBuild() {
    return deployExistingBuild(this);
  }

  async promoteExistingAndroidBuild() {
    return promoteExistingAndroidBuild(this);
  }

  async deploy() {
    if (this.deployTargets.ios === 'submit_existing') {
      return this.deployExistingBuild();
    }

    if (this.deployTargets.android === 'promote_existing') {
      return this.promoteExistingAndroidBuild();
    }

    this.startTime = Date.now();

    try {
      const platformsToNotify = [];
      if (this.deployTargets.android) platformsToNotify.push('android');
      if (this.deployTargets.ios) platformsToNotify.push('ios');
      await telegram.buildStarted(this.clientCode, platformsToNotify);

      await this.validatePrerequisites();
      await this.setupEnvironment();
      await this.generateScreenshots();
      await this.buildApps();

      const platforms = await this.uploadAndSubmit();
      return await this.finalize(platforms);
    } catch (error) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      logger.error(`Deploy falhou apos ${duration}`);
      logger.error(error.message);

      await telegram.error(this.clientCode, error.message, 'Deploy');

      throw error;
    }
  }
}

module.exports = ClientDeployer;
