const fs = require('fs-extra');
const path = require('path');
const logger = require('../../shared/utils/logger');

class AdminWebPrerequisites {
  constructor(adminRoot, webRepo, execFn) {
    this.adminRoot = adminRoot;
    this.webRepo = webRepo;
    this.exec = execFn;
  }

  check() {
    const errors = [];

    try {
      const flutterVersion = this.exec('flutter --version', { silent: true });
      logger.info(`Flutter: ${flutterVersion.split('\n')[0]}`);
    } catch {
      errors.push('Flutter not installed or not in PATH');
    }

    try {
      this.exec('git --version', { silent: true });
    } catch {
      errors.push('Git not installed or not in PATH');
    }

    if (!fs.existsSync(this.adminRoot)) {
      errors.push(`loyalty-admin-main not found at ${this.adminRoot}`);
    }

    if (!fs.existsSync(this.webRepo)) {
      errors.push(`devloyaltyhub.github.io repo not found at ${this.webRepo}`);
    }

    if (!fs.existsSync(path.join(this.webRepo, '.git'))) {
      errors.push(`${this.webRepo} is not a git repository`);
    }

    if (errors.length > 0) {
      errors.forEach((e) => logger.error(e));
      throw new Error('Prerequisites check failed');
    }

    logger.success('Prerequisites validated');
    return true;
  }
}

module.exports = AdminWebPrerequisites;
