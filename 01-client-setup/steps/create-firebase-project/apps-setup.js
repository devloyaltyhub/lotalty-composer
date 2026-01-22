const logger = require('../../../shared/utils/logger');
const { exec, checkAppAlreadyExistsError, isFirebaseNotEnabledError } = require('./exec-utils');

async function addAndroidApp(projectId, bundleId, appNickname) {
  logger.startSpinner('Adding Android app to Firebase...');

  try {
    try {
      const appsJson = exec(`firebase apps:list android --project ${projectId} --json`);
      const apps = JSON.parse(appsJson);

      if (apps.result && apps.result.length > 0) {
        const existingApp = apps.result.find((app) => app.packageName === bundleId);
        if (existingApp) {
          logger.succeedSpinner(`Android app already exists: ${existingApp.displayName || bundleId}`);
          return true;
        }
      }
    } catch (listError) {
      const errorMsg = listError.message.toLowerCase();
      if (isFirebaseNotEnabledError(errorMsg)) {
        logger.info('Firebase not yet enabled on project, will enable it by creating app...');
      } else {
        throw listError;
      }
    }

    exec(
      `firebase apps:create android "${appNickname}" --package-name ${bundleId} --project ${projectId}`,
      { timeout: 60000 }
    );

    logger.succeedSpinner('Android app added to Firebase');
    return true;
  } catch (error) {
    logger.failSpinner('Failed to add Android app');

    const errorMsg = error.message.toLowerCase();
    if (checkAppAlreadyExistsError(errorMsg)) {
      logger.warn(`Android app appears to already exist in project ${projectId}, continuing...`);
      return true;
    }

    throw error;
  }
}

async function addIosApp(projectId, bundleId, appNickname) {
  logger.startSpinner('Adding iOS app to Firebase...');

  try {
    try {
      const appsJson = exec(`firebase apps:list ios --project ${projectId} --json`);
      const apps = JSON.parse(appsJson);

      if (apps.result && apps.result.length > 0) {
        const existingApp = apps.result.find((app) => app.bundleId === bundleId);
        if (existingApp) {
          logger.succeedSpinner(`iOS app already exists: ${existingApp.displayName || bundleId}`);
          return true;
        }
      }
    } catch (listError) {
      const errorMsg = listError.message.toLowerCase();
      if (isFirebaseNotEnabledError(errorMsg)) {
        logger.info('Firebase not yet enabled on project, will enable it by creating app...');
      } else {
        throw listError;
      }
    }

    exec(
      `firebase apps:create ios "${appNickname}" --bundle-id ${bundleId} --project ${projectId}`,
      { timeout: 60000 }
    );

    logger.succeedSpinner('iOS app added to Firebase');
    return true;
  } catch (error) {
    logger.failSpinner('Failed to add iOS app');

    const errorMsg = error.message.toLowerCase();
    if (checkAppAlreadyExistsError(errorMsg)) {
      logger.warn(`iOS app appears to already exist in project ${projectId}, continuing...`);
      return true;
    }

    logger.warn('iOS app creation failed, but continuing...');
    return false;
  }
}

async function addMacOsApp(projectId, bundleId, appNickname) {
  logger.startSpinner('Adding macOS app to Firebase...');

  try {
    try {
      const appsJson = exec(`firebase apps:list macos --project ${projectId} --json`);
      const apps = JSON.parse(appsJson);

      if (apps.result && apps.result.length > 0) {
        const existingApp = apps.result.find((app) => app.bundleId === bundleId);
        if (existingApp) {
          logger.succeedSpinner(`macOS app already exists: ${existingApp.displayName || bundleId}`);
          return true;
        }
      }
    } catch (listError) {
      const errorMsg = listError.message.toLowerCase();
      if (isFirebaseNotEnabledError(errorMsg)) {
        logger.info('Firebase not yet enabled on project, will enable it by creating app...');
      } else {
        throw listError;
      }
    }

    exec(
      `firebase apps:create macos "${appNickname}" --bundle-id ${bundleId} --project ${projectId}`,
      { timeout: 60000 }
    );

    logger.succeedSpinner('macOS app added to Firebase');
    return true;
  } catch (error) {
    logger.failSpinner('Failed to add macOS app');

    const errorMsg = error.message.toLowerCase();
    if (
      errorMsg.includes('platform') ||
      errorMsg.includes('invalid') ||
      errorMsg.includes('unsupported') ||
      errorMsg.includes('macos')
    ) {
      logger.warn('Firebase CLI does not support macOS platform yet');
      logger.info('For macOS support, configure manually in Firebase Console or use iOS config');
      return false;
    }

    if (checkAppAlreadyExistsError(errorMsg)) {
      logger.warn(`macOS app appears to already exist in project ${projectId}, continuing...`);
      return true;
    }

    logger.warn('macOS app creation failed, but continuing...');
    logger.info(`Error details: ${error.message}`);
    return false;
  }
}

async function addWebApp(projectId, appNickname) {
  logger.startSpinner('Adding Web app to Firebase (for Web and Windows)...');

  try {
    try {
      const appsJson = exec(`firebase apps:list web --project ${projectId} --json`);
      const apps = JSON.parse(appsJson);

      if (apps.result && apps.result.length > 0) {
        const existingApp = apps.result.find(
          (app) => app.displayName && app.displayName.includes(appNickname.split(' ')[0])
        );
        if (existingApp) {
          logger.succeedSpinner(`Web app already exists: ${existingApp.displayName}`);
          return true;
        }
      }
    } catch (listError) {
      const errorMsg = listError.message.toLowerCase();
      if (isFirebaseNotEnabledError(errorMsg)) {
        logger.info('Firebase not yet enabled on project, will enable it by creating app...');
      } else {
        throw listError;
      }
    }

    exec(`firebase apps:create web "${appNickname}" --project ${projectId}`, {
      timeout: 60000,
    });

    logger.succeedSpinner('Web app added to Firebase');
    return true;
  } catch (error) {
    logger.failSpinner('Failed to add Web app');

    const errorMsg = error.message.toLowerCase();
    if (checkAppAlreadyExistsError(errorMsg)) {
      logger.warn(`Web app appears to already exist in project ${projectId}, continuing...`);
      return true;
    }

    logger.warn('Web app creation failed, but continuing...');
    return false;
  }
}

module.exports = {
  addAndroidApp,
  addIosApp,
  addMacOsApp,
  addWebApp,
};
