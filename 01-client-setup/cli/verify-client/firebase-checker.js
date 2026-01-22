const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../../../shared/utils/logger');
const firebaseClient = require('../../shared/firebase-manager');
const clientSelector = require('../../../shared/utils/client-selector');

class FirebaseChecker {
  constructor(clientName, config, checkResult) {
    this.clientName = clientName;
    this.clientDir = clientSelector.getClientDir(clientName);
    this.config = config;
    this.checkResult = checkResult;
  }

  async checkProject() {
    logger.info('Checking Firebase project...');

    if (!this.config) {
      this.checkResult.fail('Cannot check Firebase: config not loaded');
      return false;
    }

    try {
      const projects = execSync('firebase projects:list --json', {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const projectList = JSON.parse(projects);
      const exists = projectList.result?.some((p) => p.projectId === this.config.firebaseProjectId);

      if (!exists) {
        this.checkResult.fail(`Firebase project not found: ${this.config.firebaseProjectId}`);
        return false;
      }

      this.checkResult.pass(`Firebase project exists: ${this.config.firebaseProjectId}`);
      return true;
    } catch (error) {
      this.checkResult.fail(`Firebase check failed: ${error.message}`);
      return false;
    }
  }

  async checkFirestoreData() {
    logger.info('Checking Firestore data...');

    if (!this.config || !this.config.firebaseOptions) {
      this.checkResult.warn('Cannot check Firestore data: Firebase not configured');
      return true;
    }

    try {
      const serviceAccountPath = path.join(this.clientDir, 'service-account.json');

      if (!fs.existsSync(serviceAccountPath)) {
        this.checkResult.warn('Service account not found, skipping Firestore check');
        return true;
      }

      await firebaseClient.initializeClientFirebase(
        this.config.clientCode,
        this.config.firebaseOptions,
        serviceAccountPath
      );

      const firestore = firebaseClient.getClientFirestore(this.config.clientCode);

      const collectionsToCheck = ['Categories', 'Products', 'Store_Configs'];
      let foundCollections = 0;

      for (const collection of collectionsToCheck) {
        const snapshot = await firestore.collection(collection).limit(1).get();
        if (!snapshot.empty) {
          foundCollections++;
        }
      }

      if (foundCollections === 0) {
        this.checkResult.fail('No seed data found in Firestore');
        return false;
      }

      if (foundCollections < collectionsToCheck.length) {
        this.checkResult.warn(
          `Some seed collections missing (found ${foundCollections}/${collectionsToCheck.length})`
        );
      } else {
        this.checkResult.pass('Firestore seed data present');
      }

      return true;
    } catch (error) {
      this.checkResult.fail(`Firestore data check failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = FirebaseChecker;
