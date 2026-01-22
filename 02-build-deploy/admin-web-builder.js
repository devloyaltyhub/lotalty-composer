const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const COMPOSE_ROOT = path.resolve(__dirname, '..');
const ADMIN_ROOT = path.resolve(COMPOSE_ROOT, '../loyalty-admin-main');
const WEB_REPO = path.resolve(COMPOSE_ROOT, '../devloyaltyhub.github.io');
const BUILD_OUTPUT = path.join(ADMIN_ROOT, 'build', 'web');

const logger = require('../shared/utils/logger');
const telegram = require('../shared/utils/telegram');
const AdminWebBuildOperations = require('./utils/admin-web-build-operations');
const AdminWebGitOperations = require('./utils/admin-web-git-operations');
const AdminWebPrerequisites = require('./utils/admin-web-prerequisites');

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

class AdminWebBuilder {
  constructor() {
    this.adminRoot = ADMIN_ROOT;
    this.webRepo = WEB_REPO;
    this.buildOutput = BUILD_OUTPUT;
    this.startTime = null;

    this.prerequisites = new AdminWebPrerequisites(this.adminRoot, this.webRepo, this.exec.bind(this));
    this.buildOps = new AdminWebBuildOperations(this.adminRoot, this.buildOutput, this.exec.bind(this));
    this.gitOps = new AdminWebGitOperations(
      this.adminRoot,
      this.webRepo,
      this.buildOutput,
      this.exec.bind(this)
    );
  }

  exec(command, options = {}) {
    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: options.cwd || this.adminRoot,
        env: {
          ...process.env,
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8',
        },
        ...options,
      });
      return result ? result.trim() : '';
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  checkPrerequisites() {
    return this.prerequisites.check();
  }

  getVersionInfo() {
    return this.buildOps.getVersionInfo();
  }

  incrementBuildNumber() {
    return this.buildOps.incrementBuildNumber();
  }

  createGitTag(versionInfo) {
    return this.gitOps.createGitTag(versionInfo);
  }

  commitVersionBump(versionInfo) {
    return this.gitOps.commitVersionBump(versionInfo);
  }

  getDartDefines() {
    return this.buildOps.getDartDefines();
  }

  buildWeb() {
    return this.buildOps.buildWeb();
  }

  injectCacheBusting(indexPath) {
    return this.buildOps.injectCacheBusting(indexPath);
  }

  copyBuildToRepo() {
    return this.gitOps.copyBuildToRepo();
  }

  getGitRemote() {
    return this.gitOps.getGitRemote();
  }

  commitAndPush(message) {
    const versionInfo = this.getVersionInfo();
    return this.gitOps.commitAndPush(message, versionInfo);
  }

  getGitStatus() {
    return this.gitOps.getGitStatus();
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / MS_PER_SECOND);
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const remainingSeconds = seconds % SECONDS_PER_MINUTE;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
  }

  async buildAndDeploy(options = {}) {
    const { skipBuild = false, message = null } = options;
    this.startTime = Date.now();

    try {
      logger.section('Admin Web Deploy Pipeline');

      this.checkPrerequisites();

      if (!skipBuild) {
        this.incrementBuildNumber();
      }

      const versionInfo = this.getVersionInfo();
      logger.keyValue('Version', versionInfo.full);

      if (!skipBuild) {
        this.commitVersionBump(versionInfo);
      }

      if (!skipBuild) {
        await telegram.buildStarted('admin-web', ['web']);
        this.buildWeb();
      } else {
        logger.info('Skipping build (using existing build)');

        if (!fs.existsSync(this.buildOutput)) {
          throw new Error(
            `No existing build found at ${this.buildOutput}. Run without --skip-build first.`
          );
        }

        const indexPath = path.join(this.buildOutput, 'index.html');
        this.injectCacheBusting(indexPath);
      }

      this.copyBuildToRepo();

      const pushed = this.commitAndPush(message);

      let tagName = null;
      if (pushed) {
        tagName = this.createGitTag(versionInfo);
      }

      const duration = this.formatDuration(Date.now() - this.startTime);

      if (pushed) {
        await telegram.deploymentCompleted(
          'Loyalty Hub Admin Web',
          versionInfo.version,
          versionInfo.buildNumber,
          ['web'],
          'https://devloyaltyhub.github.io',
          duration
        );
      }

      logger.blank();
      logger.summaryBox({
        App: 'Loyalty Hub Admin Web',
        Version: versionInfo.full,
        URL: 'https://devloyaltyhub.github.io',
        Duration: duration,
        Status: pushed ? 'Deployed' : 'No changes',
        Tag: tagName || 'N/A',
      });

      return { success: true, version: versionInfo.full, duration, pushed, tagName };
    } catch (error) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      logger.error(`Deploy failed after ${duration}: ${error.message}`);
      await telegram.error('admin-web', error.message, 'Admin Web Deploy');
      throw error;
    }
  }

  async buildOnly() {
    this.startTime = Date.now();

    try {
      logger.section('Admin Web Build');

      this.checkPrerequisites();

      const versionInfo = this.getVersionInfo();
      logger.keyValue('Version', versionInfo.full);

      this.buildWeb();

      const duration = this.formatDuration(Date.now() - this.startTime);

      logger.blank();
      logger.summaryBox({
        App: 'Loyalty Hub Admin Web',
        Version: versionInfo.full,
        'Build Path': this.buildOutput,
        Duration: duration,
      });

      return { success: true, version: versionInfo.full, duration, buildPath: this.buildOutput };
    } catch (error) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      logger.error(`Build failed after ${duration}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AdminWebBuilder;
