const path = require('path');
const logger = require('../../shared/utils/logger');
const { exec } = require('./create-firebase-project/exec-utils');
const { addAndroidApp, addIosApp, addWebApp } = require('./create-firebase-project/apps-setup');
const {
  ADMIN_BUNDLE_ID,
  addAdminAndroidApp,
  addAdminWebApp,
  getAdminAppCredentials,
} = require('./create-firebase-project/admin-apps-setup');
const {
  downloadAndroidConfig,
  downloadIosConfig,
  generateFlutterFireOptions,
} = require('./create-firebase-project/config-download');
const { parseFirebaseOptions } = require('./create-firebase-project/firebase-options-parser');
const {
  grantServiceAccountAccess,
  grantFirestorePermissions,
  createClientServiceAccountKey,
} = require('./create-firebase-project/iam-setup');
const { enableFirestore } = require('./create-firebase-project/firestore-setup');
const { enableRealtimeDatabase } = require('./create-firebase-project/rtdb-setup');

class FirebaseProjectCreator {
  constructor() {
    this.projectId = null;
    this.clientFolder = null;
  }

  exec(command, options = {}) {
    return exec(command, options);
  }

  async createProject(projectId, displayName) {
    logger.startSpinner(`Creating Firebase project: ${projectId}...`);

    try {
      this.exec(`firebase projects:create ${projectId} --display-name "${displayName}"`, {
        timeout: 120000,
      });

      logger.succeedSpinner(`Firebase project created: ${projectId}`);
      this.projectId = projectId;
      return projectId;
    } catch (error) {
      logger.failSpinner('Failed to create Firebase project');

      if (
        error.message.includes('already exists') ||
        error.message.includes('already a project with ID')
      ) {
        logger.warn(`Project ${projectId} already exists, continuing...`);
        this.projectId = projectId;
        return projectId;
      }

      throw error;
    }
  }

  async addAndroidApp(bundleId, appNickname) {
    return addAndroidApp(this.projectId, bundleId, appNickname);
  }

  async addIosApp(bundleId, appNickname) {
    return addIosApp(this.projectId, bundleId, appNickname);
  }

  async addWebApp(appNickname) {
    return addWebApp(this.projectId, appNickname);
  }

  static get ADMIN_BUNDLE_ID() {
    return ADMIN_BUNDLE_ID;
  }

  async addAdminAndroidApp() {
    return addAdminAndroidApp(this.projectId);
  }

  async addAdminWebApp() {
    return addAdminWebApp(this.projectId);
  }

  async getAdminAppCredentials() {
    return getAdminAppCredentials(this.projectId);
  }

  async downloadAndroidConfig(outputPath) {
    return downloadAndroidConfig(this.projectId, outputPath);
  }

  async downloadIosConfig(outputPath) {
    return downloadIosConfig(this.projectId, outputPath);
  }

  async generateFlutterFireOptions(clientFolder) {
    return generateFlutterFireOptions(this.projectId, clientFolder);
  }

  parseFirebaseOptions(optionsPath) {
    return parseFirebaseOptions(optionsPath);
  }

  grantServiceAccountAccess() {
    return grantServiceAccountAccess(this.projectId);
  }

  async enableFirestore() {
    return enableFirestore(this.projectId);
  }

  async enableRealtimeDatabase() {
    return enableRealtimeDatabase(this.projectId);
  }

  grantFirestorePermissions() {
    return grantFirestorePermissions(this.projectId);
  }

  async createClientServiceAccountKey(outputPath) {
    return createClientServiceAccountKey(this.projectId, outputPath);
  }

  async setupCompleteProject(config) {
    const { projectId, displayName, bundleIdAndroid, bundleIdIos, appName, clientFolder } = config;

    this.clientFolder = clientFolder;

    try {
      await this.createProject(projectId, displayName);
      await this.addAndroidApp(bundleIdAndroid, `${appName} (Android)`);
      await this.addIosApp(bundleIdIos, `${appName} (iOS)`);

      logger.info('Skipping macOS app creation (uses iOS config in Flutter)');

      await this.addWebApp(`${appName} (Web)`);
      await this.addAdminAndroidApp();
      await this.addAdminWebApp();
      await this.enableFirestore();
      await this.enableRealtimeDatabase();

      this.grantServiceAccountAccess();

      const androidConfigPath = path.join(clientFolder, 'android', 'google-services.json');
      await this.downloadAndroidConfig(androidConfigPath);

      const iosConfigPath = path.join(clientFolder, 'ios', 'GoogleService-Info.plist');
      await this.downloadIosConfig(iosConfigPath);

      const optionsPath = await this.generateFlutterFireOptions(clientFolder);
      const firebaseOptions = this.parseFirebaseOptions(optionsPath);

      const adminCredentials = await this.getAdminAppCredentials();
      Object.assign(firebaseOptions, adminCredentials);

      this.grantFirestorePermissions();

      const serviceAccountPath = path.join(clientFolder, 'service-account.json');
      await this.createClientServiceAccountKey(serviceAccountPath);

      logger.success('Firebase project setup completed successfully!');

      return {
        projectId: this.projectId,
        firebaseOptions,
        serviceAccountPath,
        configFiles: {
          android: androidConfigPath,
          ios: iosConfigPath,
          options: optionsPath,
          serviceAccount: serviceAccountPath,
        },
      };
    } catch (error) {
      logger.error(`Firebase project setup failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = FirebaseProjectCreator;
