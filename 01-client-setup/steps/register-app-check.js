const {
  getAndroidAppId,
  addSHA256Fingerprint,
  addSHA256ToFirebaseApp,
} = require("../shared/firebase-sha-utils");
const {
  generateAppCheckInstructions,
} = require("../shared/app-check-instructions");
const logger = require("../../shared/utils/logger");

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
async function registerAppCheckFingerprint(
  projectId,
  sha256Fingerprint,
  packageName,
) {
  logger.section("Registering App Check Configuration");

  try {
    logger.warn("App Check Registration Required:");
    logger.log("\nPlease complete the following steps manually:\n");

    logger.info("1. Open Firebase Console:");
    logger.log(
      `   https://console.firebase.google.com/project/${projectId}/appcheck`,
    );

    logger.info("\n2. Enable App Check for Android App:");
    logger.log(`   - Select the Android app (${packageName})`);
    logger.log('   - Click "Register" under Play Integrity');

    logger.info("\n3. Add SHA-256 Fingerprint:");
    logger.log("   - Go to Project Settings > Your apps");
    logger.log("   - Select the Android app");
    logger.log("   - Add SHA certificate fingerprint:");
    logger.success(`\n   ${sha256Fingerprint}\n`);

    logger.info("4. Enable App Check enforcement (optional):");
    logger.log("   - Go to App Check settings");
    logger.log("   - Enable enforcement for Firestore, Storage, etc.");

    logger.warn("Configuration saved to clipboard (copy the SHA-256):");
    logger.success(sha256Fingerprint);

    try {
      await addSHA256ToFirebaseApp(projectId, sha256Fingerprint, packageName);
    } catch (error) {
      logger.warn("Could not automatically add SHA-256 to Firebase app");
      logger.log(`   ${error.message}`);
    }

    return {
      success: true,
      manualStepsRequired: true,
      consoleUrl: `https://console.firebase.google.com/project/${projectId}/appcheck`,
      sha256: sha256Fingerprint,
    };
  } catch (error) {
    logger.error(`Error during App Check registration: ${error.message}`);
    throw error;
  }
}

/**
 * Register both debug and release SHA-256 fingerprints for App Check
 */
async function registerAppCheckFingerprints(
  projectId,
  packageName,
  keystoreResults,
) {
  logger.section("Registering App Check SHA-256 Fingerprints");

  try {
    logger.info("Getting Android app ID...");
    const appId = await getAndroidAppId(projectId, packageName);
    logger.log(`   App ID: ${appId}`);

    const debugResult = await addSHA256Fingerprint(
      projectId,
      appId,
      keystoreResults.debug.sha256,
      "DEBUG",
    );

    const releaseResult = await addSHA256Fingerprint(
      projectId,
      appId,
      keystoreResults.release.sha256,
      "RELEASE",
    );

    logger.success("SHA-256 fingerprints registered successfully");
    logger.log(
      "   (Proximos passos manuais serao exibidos ao final da execucao)",
    );

    return {
      success: true,
      appId,
      debug: debugResult,
      release: releaseResult,
      manualStepsRequired: true,
      consoleUrl: `https://console.firebase.google.com/project/${projectId}/appcheck`,
    };
  } catch (error) {
    logger.error("Failed to register App Check fingerprints");
    logger.error(error.message);
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
