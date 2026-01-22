const { execSync } = require('child_process');
const chalk = require('chalk');

/**
 * Firebase SHA Fingerprint Utilities
 *
 * Handles SHA-256 fingerprint registration for Firebase Android apps.
 */

/**
 * Get Android App ID from Firebase project
 */
async function getAndroidAppId(projectId, packageName) {
  try {
    const appsListCommand = `firebase apps:list ANDROID --project=${projectId} --json`;
    const appsListOutput = execSync(appsListCommand, { encoding: 'utf-8', stdio: 'pipe' });
    const appsListResult = JSON.parse(appsListOutput);

    const appsList = appsListResult.result || appsListResult;

    if (!appsList || !Array.isArray(appsList) || appsList.length === 0) {
      throw new Error('No Android apps found in project');
    }

    const app = appsList.find((a) => a.packageName === packageName);
    if (!app) {
      throw new Error(
        `Android app with package ${packageName} not found. Available packages: ${appsList.map((a) => a.packageName).join(', ')}`
      );
    }

    return app.appId;
  } catch (error) {
    throw new Error(`Failed to get Android app ID: ${error.message}`);
  }
}

/**
 * Add SHA-256 fingerprint to Android app using Firebase CLI
 */
async function addSHA256Fingerprint(projectId, appId, sha256, type = 'release') {
  console.log(chalk.cyan(`\n   Adding ${type} SHA-256 fingerprint...`));

  try {
    const command = `firebase apps:android:sha:create ${appId} ${sha256} --project=${projectId}`;
    execSync(command, { encoding: 'utf-8', stdio: 'pipe' });

    console.log(chalk.green(`   ✅ ${type} SHA-256 added successfully`));
    return { success: true, sha256, type };
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('ALREADY_EXISTS')) {
      console.log(chalk.yellow(`   ⚠️  ${type} SHA-256 already registered`));
      return { success: true, sha256, type, alreadyExists: true };
    }

    throw new Error(`Failed to add ${type} SHA-256: ${error.message}`);
  }
}

/**
 * Adds SHA-256 fingerprint to Firebase Android app (Legacy function for backward compatibility)
 * @deprecated Use registerAppCheckFingerprints instead
 */
async function addSHA256ToFirebaseApp(projectId, sha256Fingerprint, packageName) {
  console.log(chalk.cyan('\n   Adding SHA-256 to Firebase app...'));

  try {
    const appId = await getAndroidAppId(projectId, packageName);
    console.log(chalk.gray(`   Found Android app: ${appId}`));

    await addSHA256Fingerprint(projectId, appId, sha256Fingerprint, 'RELEASE');

    return { appId, packageName };
  } catch (error) {
    throw new Error(`Failed to add SHA-256: ${error.message}`);
  }
}

module.exports = {
  getAndroidAppId,
  addSHA256Fingerprint,
  addSHA256ToFirebaseApp,
};
