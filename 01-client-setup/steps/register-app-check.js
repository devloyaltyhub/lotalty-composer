const chalk = require('chalk');
const {
  getAndroidAppId,
  addSHA256Fingerprint,
  addSHA256ToFirebaseApp,
} = require('../shared/firebase-sha-utils');
const { generateAppCheckInstructions } = require('../shared/app-check-instructions');

/**
 * Register App Check SHA-256 Fingerprint
 *
 * This step registers the Android app's SHA-256 fingerprint in Firebase
 * for App Check Play Integrity API validation.
 *
 * NOTE: This requires the Firebase CLI and proper authentication.
 */

/**
 * Registers SHA-256 fingerprint for App Check
 * Currently this provides instructions as Firebase CLI doesn't have direct App Check API
 */
async function registerAppCheckFingerprint(projectId, sha256Fingerprint, packageName) {
  console.log(chalk.blue('\n🔐 Registering App Check Configuration...'));
  console.log(chalk.gray('─'.repeat(50)));

  try {
    console.log(chalk.yellow('\n⚠️  App Check Registration Required:'));
    console.log(chalk.white('\nPlease complete the following steps manually:\n'));

    console.log(chalk.cyan('1. Open Firebase Console:'));
    console.log(
      chalk.white(`   https://console.firebase.google.com/project/${projectId}/appcheck`)
    );

    console.log(chalk.cyan('\n2. Enable App Check for Android App:'));
    console.log(chalk.white(`   - Select the Android app (${packageName})`));
    console.log(chalk.white('   - Click "Register" under Play Integrity'));

    console.log(chalk.cyan('\n3. Add SHA-256 Fingerprint:'));
    console.log(chalk.white('   - Go to Project Settings > Your apps'));
    console.log(chalk.white('   - Select the Android app'));
    console.log(chalk.white('   - Add SHA certificate fingerprint:'));
    console.log(chalk.green(`\n   ${sha256Fingerprint}\n`));

    console.log(chalk.cyan('4. Enable App Check enforcement (optional):'));
    console.log(chalk.white('   - Go to App Check settings'));
    console.log(chalk.white('   - Enable enforcement for Firestore, Storage, etc.'));

    console.log(chalk.yellow('\n📋 Configuration saved to clipboard (copy the SHA-256):'));
    console.log(chalk.green(`${sha256Fingerprint}`));

    try {
      await addSHA256ToFirebaseApp(projectId, sha256Fingerprint, packageName);
    } catch (error) {
      console.log(chalk.yellow('\n⚠️  Could not automatically add SHA-256 to Firebase app'));
      console.log(chalk.gray(`   ${error.message}`));
    }

    return {
      success: true,
      manualStepsRequired: true,
      consoleUrl: `https://console.firebase.google.com/project/${projectId}/appcheck`,
      sha256: sha256Fingerprint,
    };
  } catch (error) {
    console.error(chalk.red('\n❌ Error during App Check registration:'), error.message);
    throw error;
  }
}

/**
 * Register both debug and release SHA-256 fingerprints for App Check
 */
async function registerAppCheckFingerprints(projectId, packageName, keystoreResults) {
  console.log(chalk.blue('\n🔐 Registering App Check SHA-256 Fingerprints...'));
  console.log(chalk.gray('─'.repeat(50)));

  try {
    console.log(chalk.cyan('\n   Getting Android app ID...'));
    const appId = await getAndroidAppId(projectId, packageName);
    console.log(chalk.gray(`   App ID: ${appId}`));

    const debugResult = await addSHA256Fingerprint(
      projectId,
      appId,
      keystoreResults.debug.sha256,
      'DEBUG'
    );

    const releaseResult = await addSHA256Fingerprint(
      projectId,
      appId,
      keystoreResults.release.sha256,
      'RELEASE'
    );

    console.log(chalk.green('\n✅ SHA-256 fingerprints registered successfully'));
    console.log(chalk.gray('   (Próximos passos manuais serão exibidos ao final da execução)'));

    return {
      success: true,
      appId,
      debug: debugResult,
      release: releaseResult,
      manualStepsRequired: true,
      consoleUrl: `https://console.firebase.google.com/project/${projectId}/appcheck`,
    };
  } catch (error) {
    console.error(chalk.red('\n❌ Failed to register App Check fingerprints'));
    console.error(chalk.red(`   ${error.message}`));
    throw error;
  }
}

module.exports = {
  registerAppCheckFingerprint,
  registerAppCheckFingerprints,
  addSHA256Fingerprint,
  getAndroidAppId,
  addSHA256ToFirebaseApp,
  generateAppCheckInstructions,
};
