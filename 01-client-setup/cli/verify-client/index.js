#!/usr/bin/env node

const path = require('path');
const logger = require('../../../shared/utils/logger');
const clientSelector = require('../../../shared/utils/client-selector');
const firebaseClient = require('../../shared/firebase-manager');
const { COMPOSE_ROOT } = require('../../../shared/utils/paths');

require('dotenv').config({ path: path.join(COMPOSE_ROOT, '.env') });

const CheckResult = require('./check-result');
const ConfigChecker = require('./config-checker');
const FirebaseChecker = require('./firebase-checker');
const AssetChecker = require('./asset-checker');
const GitChecker = require('./git-checker');
const MetadataChecker = require('./metadata-checker');
const CertificateChecker = require('./certificate-checker');

class ClientHealthCheck {
  constructor(clientName) {
    this.clientName = clientName;
    this.config = null;
    this.checkResult = new CheckResult();
  }

  async runAll() {
    logger.section(`Health Check: ${this.clientName}`);
    logger.blank();

    const configChecker = new ConfigChecker(this.clientName, this.checkResult);
    this.config = configChecker.check();

    if (this.config) {
      const firebaseChecker = new FirebaseChecker(this.clientName, this.config, this.checkResult);
      await firebaseChecker.checkProject();

      const assetChecker = new AssetChecker(this.clientName, this.checkResult);
      assetChecker.check();

      const gitChecker = new GitChecker(this.config, this.checkResult);
      gitChecker.check();

      const metadataChecker = new MetadataChecker(this.clientName, this.config, this.checkResult);
      metadataChecker.check();
      metadataChecker.checkScreenshots();

      const certificateChecker = new CertificateChecker(this.config, this.checkResult);
      certificateChecker.checkAndroid();
      certificateChecker.checkIos();
      certificateChecker.checkDeployment();

      await firebaseChecker.checkFirestoreData();
    }

    this.checkResult.printSummary();

    if (this.checkResult.isHealthy()) {
      logger.success('Client is healthy!');
      return true;
    } else {
      logger.error('Client has issues that need attention');
      return false;
    }
  }
}

async function main() {
  try {
    const clientName = await clientSelector.selectClientOrPrompt(process.argv[2], {
      message: 'Select client to verify:',
    });

    const healthCheck = new ClientHealthCheck(clientName);
    const healthy = await healthCheck.runAll();

    process.exit(healthy ? 0 : 1);
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    process.exit(1);
  } finally {
    firebaseClient.cleanup();
  }
}

module.exports = ClientHealthCheck;

if (require.main === module) {
  main();
}
