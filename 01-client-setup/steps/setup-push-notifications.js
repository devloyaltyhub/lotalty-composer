const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const APNsKeyCreator = require('./create-apns-key');
const { buildInstructionsContent } = require('./push-notifications/instruction-templates');
const {
  displayPushNotificationsManualSteps,
} = require('./push-notifications/console-display');

/**
 * Push Notifications Setup Helper
 *
 * This module provides utilities for configuring push notifications
 * for both iOS (APNs) and Android (FCM).
 *
 * APNs key CREATION is automated via Apple Developer Portal API (Spaceship).
 * APNs key UPLOAD to Firebase CANNOT be automated - Firebase has no API for this.
 * See: https://github.com/firebase/firebase-admin-node/issues/2204
 */

/**
 * Generates instructions file for Push Notifications setup
 * @param {Object} options Configuration options
 * @param {string} options.clientCode Client identifier
 * @param {string} options.projectId Firebase project ID
 * @param {string} options.bundleId App bundle ID
 * @param {string} options.outputDir Output directory for instructions file
 * @param {boolean} options.pushEnabled Whether push notifications feature flag is enabled
 * @param {Object} options.apnsKeyInfo APNs key info (keyId, teamId, keyFile) if created
 * @returns {string} Path to the generated instructions file
 */
function generatePushNotificationsInstructions(options) {
  const { clientCode, outputDir } = options;

  const instructionsPath = path.join(
    outputDir,
    clientCode,
    `PUSH_NOTIFICATIONS_SETUP_${clientCode}.md`
  );

  const content = buildInstructionsContent(options);

  const dirPath = path.dirname(instructionsPath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(instructionsPath, content);
  console.log(
    chalk.green(`   ✅ Push Notifications instructions saved to: ${instructionsPath}`)
  );

  return instructionsPath;
}

/**
 * Checks if APNs key file exists in the credentials repository
 * @param {string} credentialsPath Path to loyalty-credentials repository
 * @returns {Object} Result with exists flag and key info if found
 */
function checkAPNsKeyExists(credentialsPath) {
  const apnsDir = path.join(credentialsPath, 'shared', 'apns');

  if (!fs.existsSync(apnsDir)) {
    return { exists: false, reason: 'APNs directory not found' };
  }

  const files = fs.readdirSync(apnsDir);
  const p8Files = files.filter((f) => f.endsWith('.p8'));

  if (p8Files.length === 0) {
    return { exists: false, reason: 'No .p8 files found in APNs directory' };
  }

  const keyFile = p8Files[0];
  const keyIdMatch = keyFile.match(/AuthKey_([A-Z0-9]+)\.p8/);
  const keyId = keyIdMatch ? keyIdMatch[1] : null;

  return {
    exists: true,
    keyFile: path.join(apnsDir, keyFile),
    keyId,
    allKeys: p8Files,
  };
}

module.exports = {
  generatePushNotificationsInstructions,
  checkAPNsKeyExists,
  displayPushNotificationsManualSteps,
  APNsKeyCreator,
};
