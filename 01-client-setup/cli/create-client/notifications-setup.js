const inquirer = require("inquirer");
const logger = require("../../../shared/utils/logger");
const { CLIENTS_DIR } = require("../../../shared/utils/paths");
const {
  generatePushNotificationsInstructions,
  APNsKeyCreator,
} = require("../../steps/setup-push-notifications");

async function createAPNsKey(config) {
  logger.section("Creating APNs Key for iOS Push Notifications");

  const pushEnabled = config.featureFlags?.pushNotifications || false;

  if (!pushEnabled) {
    logger.warn("Push Notifications: DISABLED (feature flag = false)");
    logger.info("Skipping APNs key creation");
    return null;
  }

  const apnsCreator = new APNsKeyCreator();

  const existingKey = apnsCreator.checkExistingKey();
  if (existingKey.exists) {
    logger.info(`APNs key already exists: ${existingKey.keyFile}`);
    logger.info(`   Key ID: ${existingKey.keyId}`);
    return {
      keyId: existingKey.keyId,
      keyFile: existingKey.keyFile,
      teamId: apnsCreator.getTeamId(),
    };
  }

  const result = await apnsCreator.createKey({ logger, inquirer });

  if (result.success && !result.skipped) {
    logger.success("APNs key created successfully");
    return {
      keyId: result.keyId,
      keyFile: result.keyFile,
      teamId: result.teamId,
    };
  } else if (result.skipped) {
    logger.info(`APNs key creation skipped: ${result.reason}`);
    if (result.keyId) {
      return {
        keyId: result.keyId,
        keyFile: result.keyFile,
        teamId: result.teamId,
      };
    }
  } else {
    logger.warn(`APNs key creation failed: ${result.error}`);
    logger.info("You can create the key manually later");
  }

  return null;
}

function generatePushNotificationsSetupInstructions(config) {
  logger.section("Generating Push Notifications Instructions");

  const pushEnabled = config.featureFlags?.pushNotifications || false;

  const instructionsPath = generatePushNotificationsInstructions({
    clientCode: config.clientCode,
    projectId: config.firebaseProjectId,
    bundleId: config.bundleId,
    outputDir: CLIENTS_DIR,
    pushEnabled,
    apnsKeyInfo: config.apnsKeyInfo,
  });

  if (pushEnabled) {
    logger.success("Push Notifications instructions generated");
    logger.info(`  ${instructionsPath}`);
  } else {
    logger.warn("Push Notifications: DISABLED (feature flag = false)");
    logger.info("  Instructions generated for future reference");
  }

  return instructionsPath;
}

module.exports = {
  createAPNsKey,
  generatePushNotificationsSetupInstructions,
};
