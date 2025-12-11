/**
 * Client Setup Module - Barrel Export
 * Phase 01: Firebase, Firestore, admin user, Git
 */

// Configuration
const config = require('./config');

// Shared utilities
const firebaseManager = require('./shared/firebase-manager');
const businessTypeManager = require('./shared/business-type-manager');
const envLoader = require('./shared/env-loader');
const inputValidator = require('./shared/input-validator');

// CLI Scripts
const cli = {
  createClient: './cli/create-client.js',
  updateClient: './cli/update-client.js',
  verifyClient: './cli/verify-client.js',
  rollbackClient: './cli/rollback-client.js',
  updateMetadata: './cli/update-metadata.js',
  addClientToMaster: './cli/add-client-to-master.js',
  checkMasterFirebaseConfig: './cli/check-master-firebase-config.js',
  completeSecurity: './cli/complete-security-setup.js',
  createMasterUser: './cli/create-master-user.js',
  deployMasterRules: './cli/deploy-master-rules.js',
  fixFirebaseCredentials: './cli/fix-firebase-credentials.js',
  fixWebCredentials: './cli/fix-web-credentials.js',
  setupMasterUser: './cli/setup-master-user.js',
};

// Steps
const steps = {
  createAdminUser: require('./steps/create-admin-user'),
  createFirebaseProject: require('./steps/create-firebase-project'),
  createGitBranch: require('./steps/create-git-branch'),
  generateMetadata: require('./steps/generate-metadata'),
  seedFirestoreData: require('./steps/seed-firestore-data'),
  setupIosCertificates: require('./steps/setup-ios-certificates'),
  setupAndroidCredentials: require('./steps/setup-android-credentials'),
  setupRemoteConfig: require('./steps/setup-remote-config'),
  setupWhiteLabel: './steps/setup-white-label.js',
  gitCredentialsManager: require('./steps/git-credentials-manager'),
  generateAndroidKeystore: require('./steps/generate-android-keystore'), // Legacy - use setupAndroidCredentials
  registerAppCheck: require('./steps/register-app-check'),
};

// Step modules
const modules = {
  assetOperations: require('./steps/modules/asset-operations'),
  iosOperations: require('./steps/modules/ios-operations'),
  keystoreOperations: require('./steps/modules/keystore-operations'),
  templateGenerator: require('./steps/modules/template-generator'),
};

module.exports = {
  config,
  firebaseManager,
  businessTypeManager,
  envLoader,
  inputValidator,
  cli,
  steps,
  modules,
};
