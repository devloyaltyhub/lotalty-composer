const fs = require("fs");
const path = require("path");
const logger = require("../../../shared/utils/logger");
const telegram = require("../../../shared/utils/telegram");
const { getClientDir } = require("../../../shared/utils/paths");
const FirebaseProjectCreator = require("../../steps/create-firebase-project");
const RemoteConfigSetup = require("../../steps/setup-remote-config");

async function createFirebaseProject(config, _firebaseClient) {
  logger.section("Firebase Project Setup");

  await telegram.clientCreationStarted(config.clientName, config.clientCode);

  const clientFolder = getClientDir(config.folderName);
  const creator = new FirebaseProjectCreator();

  const result = await creator.setupCompleteProject({
    projectId: config.firebaseProjectId,
    displayName: config.clientName,
    bundleIdAndroid: config.bundleId,
    bundleIdIos: config.bundleId,
    appName: config.appName,
    clientFolder,
  });

  await telegram.firebaseProjectCreated(config.clientName, config.firebaseProjectId);

  return {
    firebaseOptions: result.firebaseOptions,
    clientFolder,
    serviceAccountPath: result.serviceAccountPath,
  };
}

async function saveToMasterFirebase(config, firebaseClient) {
  logger.section("Saving to Master Firebase");

  firebaseClient.initializeMasterFirebase();

  await firebaseClient.saveClientToMaster(
    config.clientCode,
    config.firebaseOptions,
    true,
    config.tinifyApiKey || null,
  );

  logger.success("Client saved to Master Firebase");
}

async function deployFirestoreRules(config, firebaseClient) {
  logger.section("Deploying Firestore Security Rules");

  const rulesPath = path.join(__dirname, "../../../shared/templates/firestore.rules");
  const tempRulesPath = path.join(config.clientFolder, "firestore.rules");

  fs.copyFileSync(rulesPath, tempRulesPath);

  const firebaseJsonPath = path.join(config.clientFolder, "firebase.json");
  if (!fs.existsSync(firebaseJsonPath)) {
    const firebaseJson = { firestore: { rules: "firestore.rules" } };
    fs.writeFileSync(firebaseJsonPath, JSON.stringify(firebaseJson, null, 2));
  }

  await firebaseClient.deployFirestoreRules(config.firebaseProjectId, tempRulesPath);

  logger.success("Firestore rules deployed");
}

async function deployFirestoreIndexes(config, firebaseClient) {
  logger.section("Deploying Firestore Indexes");

  const indexesPath = path.join(__dirname, "../../../shared/templates/firestore.indexes.json");
  const tempIndexesPath = path.join(config.clientFolder, "firestore.indexes.json");

  fs.copyFileSync(indexesPath, tempIndexesPath);

  const firebaseJsonPath = path.join(config.clientFolder, "firebase.json");
  const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, "utf8"));
  firebaseJson.firestore.indexes = "firestore.indexes.json";
  fs.writeFileSync(firebaseJsonPath, JSON.stringify(firebaseJson, null, 2));

  await firebaseClient.deployFirestoreIndexes(config.firebaseProjectId, tempIndexesPath);

  logger.success("Firestore indexes deployed");
}

async function setupRemoteConfig(config, firebaseClient) {
  logger.section("Setting up Firebase Remote Config");

  if (!firebaseClient.apps.has(config.clientCode)) {
    await firebaseClient.initializeClientFirebase(
      config.clientCode,
      config.firebaseOptions,
      config.serviceAccountPath,
    );
  }

  const remoteConfigSetup = new RemoteConfigSetup(firebaseClient.apps.get(config.clientCode));

  const remoteConfigData = await remoteConfigSetup.setupRemoteConfig({
    featureFlags: config.featureFlags,
    clarityProjectId: config.clarityProjectId,
    clientCode: config.clientCode,
  });

  logger.success("Remote Config setup completed");
  return remoteConfigData;
}

async function copyCredentialsToCloudService(config) {
  logger.section("Copying Firebase Credentials to Cloud Service");

  const serviceAccountPath = config.serviceAccountPath;
  if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
    logger.warn("Service account file not found, skipping cloud service credentials copy");
    return;
  }

  const cloudServiceCredentialsDir = path.resolve(__dirname, "../../../../loyalty-cloud-service/credentials");

  if (!fs.existsSync(cloudServiceCredentialsDir)) {
    fs.mkdirSync(cloudServiceCredentialsDir, { recursive: true });
    logger.info(`Created credentials directory: ${cloudServiceCredentialsDir}`);
  }

  const destinationPath = path.join(cloudServiceCredentialsDir, `${config.clientCode}.json`);
  fs.copyFileSync(serviceAccountPath, destinationPath);

  logger.success(`Firebase credentials copied to: ${destinationPath}`);
  logger.info("Cloud Service will auto-detect this credential on next restart");
}

module.exports = {
  createFirebaseProject,
  saveToMasterFirebase,
  deployFirestoreRules,
  deployFirestoreIndexes,
  setupRemoteConfig,
  copyCredentialsToCloudService,
};
