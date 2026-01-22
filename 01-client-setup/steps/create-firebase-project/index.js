const { exec, checkAppAlreadyExistsError, isFirebaseNotEnabledError, DEFAULT_TIMEOUT } = require('./exec-utils');
const { addAndroidApp, addIosApp, addMacOsApp, addWebApp } = require('./apps-setup');
const { ADMIN_BUNDLE_ID, addAdminAndroidApp, addAdminWebApp, getAdminAppCredentials } = require('./admin-apps-setup');
const { downloadAndroidConfig, downloadIosConfig, generateFlutterFireOptions } = require('./config-download');
const { parseFirebaseOptions } = require('./firebase-options-parser');
const { grantServiceAccountAccess, grantFirestorePermissions, createClientServiceAccountKey } = require('./iam-setup');
const { enableFirestore } = require('./firestore-setup');

module.exports = {
  exec,
  checkAppAlreadyExistsError,
  isFirebaseNotEnabledError,
  DEFAULT_TIMEOUT,
  addAndroidApp,
  addIosApp,
  addMacOsApp,
  addWebApp,
  ADMIN_BUNDLE_ID,
  addAdminAndroidApp,
  addAdminWebApp,
  getAdminAppCredentials,
  downloadAndroidConfig,
  downloadIosConfig,
  generateFlutterFireOptions,
  parseFirebaseOptions,
  grantServiceAccountAccess,
  grantFirestorePermissions,
  createClientServiceAccountKey,
  enableFirestore,
};
