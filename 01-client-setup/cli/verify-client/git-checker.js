const { execSync } = require('child_process');
const logger = require('../../../shared/utils/logger');

class GitChecker {
  constructor(config, checkResult) {
    this.config = config;
    this.checkResult = checkResult;
  }

  check() {
    logger.info('Checking git branch...');

    if (!this.config || !this.config.clientCode) {
      this.checkResult.warn('Client code not in config, skipping git check');
      return true;
    }

    try {
      try {
        const clientDir = `clients/${this.config.clientCode}`;
        execSync(`git ls-tree -r main --name-only | grep "^${clientDir}/"`, {
          stdio: 'pipe',
        });
        this.checkResult.pass(`Client config exists in main branch`);
      } catch {
        this.checkResult.fail(`Client config not found in main branch`);
        return false;
      }

      return true;
    } catch (error) {
      this.checkResult.fail(`Git check failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = GitChecker;
