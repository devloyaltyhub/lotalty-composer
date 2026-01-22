const logger = require('../../../shared/utils/logger');

class CheckResult {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
    };
  }

  pass(message) {
    this.results.passed.push(message);
    logger.success(`${message}`);
  }

  fail(message) {
    this.results.failed.push(message);
    logger.error(`${message}`);
  }

  warn(message) {
    this.results.warnings.push(message);
    logger.warn(`${message}`);
  }

  info(message) {
    logger.info(`${message}`);
  }

  getResults() {
    return this.results;
  }

  printSummary() {
    logger.blank();
    logger.section('Health Check Summary');

    if (this.results.passed.length > 0) {
      logger.success(`\nPassed: ${this.results.passed.length}`);
      this.results.passed.forEach((msg) => logger.info(`  ${msg}`));
    }

    if (this.results.warnings.length > 0) {
      logger.warn(`\nWarnings: ${this.results.warnings.length}`);
      this.results.warnings.forEach((msg) => logger.warn(`  ${msg}`));
    }

    if (this.results.failed.length > 0) {
      logger.error(`\nFailed: ${this.results.failed.length}`);
      this.results.failed.forEach((msg) => logger.error(`  ${msg}`));
    }

    logger.blank();
  }

  isHealthy() {
    return this.results.failed.length === 0;
  }
}

module.exports = CheckResult;
