const { execSync } = require('child_process');
const path = require('path');
const { COMPOSE_ROOT, LOYALTY_APP_ROOT } = require('../shared/utils/paths');

require('dotenv').config({ path: path.join(COMPOSE_ROOT, '.env') });

const { resolveAllCredentials } = require('./utils/credential-resolver');
resolveAllCredentials();

const logger = require('../shared/utils/logger');
const telegram = require('../shared/utils/telegram');
const GitBranchManager = require('../01-client-setup/steps/create-git-branch');
const GitOperations = require('./utils/git-operations');
const VersionManager = require('./utils/version-manager');
const BuildExecutor = require('./utils/build-executor');

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

class ClientBuilder {
  constructor(repoPath) {
    this.repoPath = repoPath || LOYALTY_APP_ROOT;
    this.gitManager = new GitBranchManager(this.repoPath);
    this.gitOps = new GitOperations(this.gitManager);
    this.versionMgr = new VersionManager(this.repoPath);
    this.buildExec = new BuildExecutor(this.exec.bind(this), this.repoPath);
    this.startTime = null;
  }

  exec(command, options = {}) {
    try {
      const rubyPaths = '/usr/local/bin:/usr/local/opt/ruby/bin:/usr/local/lib/ruby/gems/3.4.0/bin';
      const currentPath = process.env.PATH || '/usr/bin:/bin';
      const fullPath = `${rubyPaths}:${currentPath}`;

      const result = execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: options.cwd || this.repoPath,
        env: {
          ...process.env,
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8',
          PATH: fullPath,
          GEM_HOME: '/usr/local/lib/ruby/gems/3.4.0',
          GEM_PATH: '/usr/local/lib/ruby/gems/3.4.0',
        },
        ...options,
      });
      return result ? result.trim() : '';
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  loadClientConfig() { return this.versionMgr.loadClientConfig(); }
  saveClientConfig(config) { this.versionMgr.saveClientConfig(config); }
  async checkoutBranch(branchName) { return this.gitOps.checkoutBranch(branchName); }
  async checkUncommittedChanges() { return this.gitOps.checkUncommittedChanges(); }
  async stashChangesIfNeeded() { return this.gitOps.stashChangesIfNeeded(); }
  async checkoutExistingBranch(branchName) { return this.gitOps.checkoutExistingBranch(branchName); }
  async createNewDeployBranch(branchName) { return this.gitOps.createNewDeployBranch(branchName); }
  async returnToMainBranch(clientCode) { return this.gitOps.returnToMainBranch(clientCode); }
  async createDeployBranch(clientCode) { return this.gitOps.createDeployBranch(clientCode); }
  runWhiteLabelSetup(clientName, deployMode = false) { return this.buildExec.runWhiteLabelSetup(clientName, deployMode); }
  validateAssets() { return this.buildExec.validateAssets(); }
  incrementBuildNumber() { return this.buildExec.incrementBuildNumber(); }
  setVersion(version) { return this.versionMgr.setVersion(version, this.exec.bind(this)); }
  buildAndroid(clientName) { return this.buildExec.buildAndroid(clientName); }
  buildIos(clientName) { return this.buildExec.buildIos(clientName); }
  deployAndroid(clientName, track = 'internal') { return this.buildExec.deployAndroid(clientName, track); }
  deployIos(clientName, target = 'testflight') { return this.buildExec.deployIos(clientName, target); }
  async createDeploymentTag(clientName, version, buildNumber) { return this.gitOps.createDeploymentTag(clientName, version, buildNumber); }
  getVersionInfo() { return this.versionMgr.getVersionInfo(); }

  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / MS_PER_SECOND);
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const remainingSeconds = seconds % SECONDS_PER_MINUTE;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
  }

  async prepareBuildEnvironment(clientName) {
    logger.section(`Building Client: ${clientName}`);
    this.runWhiteLabelSetup(clientName, true);
    const config = this.loadClientConfig();
    logger.info(`Client: ${config.clientName} (${config.clientCode})`);
    logger.info(`Bundle ID: ${config.bundleId}`);
    logger.blank();
    this.validateAssets();
    this.incrementBuildNumber();
    return config;
  }

  async performBuilds(clientName, platforms, config) {
    const builtPlatforms = [];
    if (platforms.includes('android')) {
      this.buildAndroid(clientName);
      builtPlatforms.push('android');
    }
    if (platforms.includes('ios') && process.platform === 'darwin') {
      this.buildIos(clientName);
      builtPlatforms.push('ios');
    }
    const { version, buildNumber } = this.getVersionInfo();
    await telegram.buildCompleted(config.clientName, version, buildNumber, builtPlatforms);
    return { builtPlatforms, version, buildNumber };
  }

  async performDeployments(deployOptions) {
    const { clientName, platforms, androidTrack, iosTarget, config, builtPlatforms } = deployOptions;
    await telegram.deploymentStarted(config.clientName, builtPlatforms);
    if (platforms.includes('android')) this.deployAndroid(clientName, androidTrack);
    if (platforms.includes('ios') && process.platform === 'darwin') this.deployIos(clientName, iosTarget);
  }

  async finalizeBuildProcess(finalizeOptions) {
    const { clientName, config, version, buildNumber, builtPlatforms, deploy } = finalizeOptions;
    const tagName = await this.createDeploymentTag(clientName, version, buildNumber);
    const duration = this.formatDuration(Date.now() - this.startTime);
    if (deploy) {
      await telegram.deploymentCompleted(config.clientName, version, buildNumber, builtPlatforms, tagName, duration);
    }
    logger.blank();
    logger.summaryBox({
      Client: `${config.clientName} (${config.clientCode})`,
      Version: `${version}+${buildNumber}`,
      'Git Tag': tagName,
      Platforms: builtPlatforms,
      Deployed: deploy ? 'Yes' : 'No (build only)',
      Duration: duration,
    });
    return { success: true, clientName, version, buildNumber, gitTag: tagName, platforms: builtPlatforms, duration };
  }

  async buildAndDeploy(options) {
    this.startTime = Date.now();
    const { clientName, platforms = ['android', 'ios'], deploy = true, androidTrack = 'internal', iosTarget = 'testflight' } = options;

    try {
      await telegram.buildStarted(clientName, platforms);
      const config = await this.prepareBuildEnvironment(clientName);
      const { builtPlatforms, version, buildNumber } = await this.performBuilds(clientName, platforms, config);

      if (deploy) {
        await this.performDeployments({ clientName, platforms, androidTrack, iosTarget, config, builtPlatforms });
      }

      return await this.finalizeBuildProcess({ clientName, config, version, buildNumber, builtPlatforms, deploy });
    } catch (error) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      logger.error(`Build failed after ${duration}`);
      logger.error(error.message);
      await telegram.error(clientName, error.message, 'Build & Deploy');
      throw error;
    }
  }
}

module.exports = ClientBuilder;

if (require.main === module) {
  (async () => {
    try {
      require('dotenv').config({ path: path.join(__dirname, '../../.env') });
      const args = process.argv.slice(2);
      const clientName = args.find((arg) => arg.startsWith('--client='))?.split('=')[1];
      const platforms = args.find((arg) => arg.startsWith('--platforms='))?.split('=')[1]?.split(',') || ['android', 'ios'];
      const noDeploy = args.includes('--no-deploy');
      if (!clientName) {
        logger.error('Usage: node build-client.js --client=<name> [--platforms=android,ios] [--no-deploy]');
        process.exit(1);
      }
      const builder = new ClientBuilder();
      await builder.buildAndDeploy({ clientName, platforms, deploy: !noDeploy });
      process.exit(0);
    } catch (error) {
      logger.error(`Build failed: ${error.message}`);
      process.exit(1);
    }
  })();
}
