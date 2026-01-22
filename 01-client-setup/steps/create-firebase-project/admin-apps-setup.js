const logger = require('../../../shared/utils/logger');
const { exec, checkAppAlreadyExistsError, isFirebaseNotEnabledError } = require('./exec-utils');

const ADMIN_BUNDLE_ID = 'club.loyaltyhub.admin';

async function addAdminAndroidApp(projectId) {
  logger.startSpinner(`Adding Admin Android app (${ADMIN_BUNDLE_ID}) to Firebase...`);

  try {
    try {
      const appsJson = exec(`firebase apps:list android --project ${projectId} --json`);
      const apps = JSON.parse(appsJson);

      if (apps.result && apps.result.length > 0) {
        const existingApp = apps.result.find((app) => app.packageName === ADMIN_BUNDLE_ID);
        if (existingApp) {
          logger.succeedSpinner(
            `Admin Android app already exists: ${existingApp.displayName || ADMIN_BUNDLE_ID}`
          );
          return { success: true, appId: existingApp.appId };
        }
      }
    } catch (listError) {
      const errorMsg = listError.message.toLowerCase();
      if (!isFirebaseNotEnabledError(errorMsg)) {
        throw listError;
      }
    }

    exec(
      `firebase apps:create android "Loyalty Admin (Android)" --package-name ${ADMIN_BUNDLE_ID} --project ${projectId}`,
      { timeout: 60000 }
    );

    const appsJson = exec(`firebase apps:list android --project ${projectId} --json`);
    const apps = JSON.parse(appsJson);
    const adminApp = apps.result?.find((app) => app.packageName === ADMIN_BUNDLE_ID);

    logger.succeedSpinner('Admin Android app added to Firebase');
    return { success: true, appId: adminApp?.appId };
  } catch (error) {
    logger.failSpinner('Failed to add Admin Android app');

    const errorMsg = error.message.toLowerCase();
    if (checkAppAlreadyExistsError(errorMsg)) {
      logger.warn('Admin Android app appears to already exist, continuing...');
      return { success: true, appId: null };
    }

    logger.warn('Admin Android app creation failed, but continuing...');
    return { success: false, error: error.message };
  }
}

async function addAdminWebApp(projectId) {
  logger.startSpinner('Adding Admin Web app to Firebase (for Windows/macOS)...');

  try {
    try {
      const appsJson = exec(`firebase apps:list web --project ${projectId} --json`);
      const apps = JSON.parse(appsJson);

      if (apps.result && apps.result.length > 0) {
        const existingApp = apps.result.find(
          (app) => app.displayName && app.displayName.includes('Loyalty Admin')
        );
        if (existingApp) {
          logger.succeedSpinner(`Admin Web app already exists: ${existingApp.displayName}`);
          return { success: true, appId: existingApp.appId };
        }
      }
    } catch (listError) {
      const errorMsg = listError.message.toLowerCase();
      if (!isFirebaseNotEnabledError(errorMsg)) {
        throw listError;
      }
    }

    exec(`firebase apps:create web "Loyalty Admin (Web)" --project ${projectId}`, { timeout: 60000 });

    const appsJson = exec(`firebase apps:list web --project ${projectId} --json`);
    const apps = JSON.parse(appsJson);
    const adminApp = apps.result?.find(
      (app) => app.displayName && app.displayName.includes('Loyalty Admin')
    );

    logger.succeedSpinner('Admin Web app added to Firebase');
    return { success: true, appId: adminApp?.appId };
  } catch (error) {
    logger.failSpinner('Failed to add Admin Web app');

    const errorMsg = error.message.toLowerCase();
    if (checkAppAlreadyExistsError(errorMsg)) {
      logger.warn('Admin Web app appears to already exist, continuing...');
      return { success: true, appId: null };
    }

    logger.warn('Admin Web app creation failed, but continuing...');
    return { success: false, error: error.message };
  }
}

async function getAdminAppCredentials(projectId) {
  logger.startSpinner('Retrieving Admin app credentials...');

  try {
    const adminCredentials = {};

    try {
      const appsJson = exec(`firebase apps:list android --project ${projectId} --json`);
      const apps = JSON.parse(appsJson);
      const adminApp = apps.result?.find((app) => app.packageName === ADMIN_BUNDLE_ID);

      if (adminApp) {
        const configJson = exec(
          `firebase apps:sdkconfig android ${adminApp.appId} --project ${projectId} --json`
        );
        const config = JSON.parse(configJson);
        if (config.result) {
          adminCredentials.adminAndroidAppId = config.result.appId;
          adminCredentials.adminAndroidApiKey = config.result.apiKey;
        }
      }
    } catch (e) {
      logger.warn(`Could not get Admin Android credentials: ${e.message}`);
    }

    try {
      const appsJson = exec(`firebase apps:list web --project ${projectId} --json`);
      const apps = JSON.parse(appsJson);
      const adminApp = apps.result?.find(
        (app) => app.displayName && app.displayName.includes('Loyalty Admin')
      );

      if (adminApp) {
        const configJson = exec(
          `firebase apps:sdkconfig web ${adminApp.appId} --project ${projectId} --json`
        );
        const config = JSON.parse(configJson);
        if (config.result) {
          adminCredentials.adminWebAppId = config.result.appId;
          adminCredentials.adminWebApiKey = config.result.apiKey;
        }
      }
    } catch (e) {
      logger.warn(`Could not get Admin Web credentials: ${e.message}`);
    }

    logger.succeedSpinner('Admin app credentials retrieved');
    return adminCredentials;
  } catch (error) {
    logger.failSpinner('Failed to retrieve Admin app credentials');
    logger.warn(`Error: ${error.message}`);
    return {};
  }
}

module.exports = {
  ADMIN_BUNDLE_ID,
  addAdminAndroidApp,
  addAdminWebApp,
  getAdminAppCredentials,
};
