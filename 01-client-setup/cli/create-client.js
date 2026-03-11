#!/usr/bin/env node

const inquirer = require("inquirer");
const { getClientDir } = require("../../shared/utils/paths");
const logger = require("../../shared/utils/logger");
const telegram = require("../../shared/utils/telegram");
const preflightCheck = require("../../shared/utils/preflight-check");
const errorHandler = require("../../shared/utils/error-handler");
const ResourceTracker = require("../../shared/utils/resource-tracker");
const CheckpointManager = require("../../shared/utils/checkpoint-manager");
const firebaseClient = require("../shared/firebase-manager");
const ClientHealthCheck = require("./verify-client");

const {
  initializeEnvironment,
  collectClientInfo,
  confirmCreation,
  saveLocalConfig,
  createPackageRenameConfig,
  createFirebaseProject,
  saveToMasterFirebase,
  deployFirestoreRules,
  deployFirestoreIndexes,
  setupAppConfig,
  copyCredentialsToCloudService,
  seedDefaultData,
  createTestUser,
  createAdminUser,
  generateAndroidKeystore,
  commitAndroidKeystores,
  setupIOSCertificates,
  generateAppCheckSetup,
  createShorebirdConfig,
  createAPNsKey,
  generatePushNotificationsSetupInstructions,
  copyBusinessTypeAssets,
  commitClientConfig,
  generateMetadata,
  setupPaymentConfig,
  formatDuration,
  displayFinalSummary,
  displayManualActionsSection,
} = require("./create-client/index");

initializeEnvironment();

class ClientCreationWizard {
  constructor() {
    this.startTime = null;
    this.config = {};
    this.resourceTracker = new ResourceTracker();
    this.checkpointManager = null;
    this.completedSteps = new Set();
    this.seeder = null;
  }

  async executeStep(stepName, stepFunction) {
    if (this.completedSteps.has(stepName)) {
      logger.info(`Skipping ${stepName} (already completed)`);
      return;
    }

    const result = await stepFunction();
    this.completedSteps.add(stepName);

    if (this.checkpointManager) {
      this.checkpointManager.saveCheckpoint(stepName, {
        config: this.config,
        completedSteps: Array.from(this.completedSteps),
      });
    }

    return result;
  }

  async tryResumeFromCheckpoint() {
    if (!this.checkpointManager || !this.checkpointManager.exists()) {
      return false;
    }

    const shouldResume = await this.checkpointManager.promptResume(inquirer);

    if (shouldResume) {
      const checkpoint = this.checkpointManager.getLastCheckpoint();
      this.config = checkpoint.state.config || {};
      this.completedSteps = new Set(checkpoint.state.completedSteps || []);

      if (
        this.config.firebaseProjectId &&
        !this.config.firebaseProjectId.includes("loyalty-hub-club")
      ) {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const newFirebaseProjectId = `${this.config.clientCode}-loyalty-hub-club-${randomSuffix}`;
        logger.warn(`Old Firebase Project ID format detected: ${this.config.firebaseProjectId}`);
        logger.info(`Regenerating with new format: ${newFirebaseProjectId}`);
        this.config.firebaseProjectId = newFirebaseProjectId;
      }

      logger.info(`Resuming from: ${checkpoint.stepName}`);
      logger.info(`Completed steps: ${this.completedSteps.size}`);
      return true;
    }

    return false;
  }

  async run() {
    try {
      this.startTime = Date.now();

      logger.section("LoyaltyHub Client Creation");
      logger.info("This wizard will create a complete white-label client setup");
      logger.blank();

      if (!process.env.SKIP_PREFLIGHT_CHECK) {
        await preflightCheck.runAll();
      }

      this.config = await collectClientInfo(firebaseClient);
      this.checkpointManager = new CheckpointManager("client-creation", this.config.clientCode);

      const resumed = await this.tryResumeFromCheckpoint();
      if (resumed) {
        logger.info("Resuming client creation from checkpoint");
        logger.blank();
      }

      await this.executeStep("confirm_creation", () => confirmCreation(this.config));

      await this.executeStep("create_firebase_project", async () => {
        const result = await createFirebaseProject(this.config, firebaseClient);
        this.config.firebaseOptions = result.firebaseOptions;
        this.config.clientFolder = result.clientFolder;
        this.config.serviceAccountPath = result.serviceAccountPath;
        this.resourceTracker.trackFirebaseProject(this.config.firebaseProjectId);
      });

      await this.executeStep("save_to_master_firebase", async () => {
        await saveToMasterFirebase(this.config, firebaseClient);
        this.resourceTracker.trackMasterFirebaseEntry(this.config.clientCode, firebaseClient);
      });

      await this.executeStep("copy_credentials_to_cloud_service", () =>
        copyCredentialsToCloudService(this.config),
      );

      await this.executeStep("deploy_firestore_rules", () =>
        deployFirestoreRules(this.config, firebaseClient),
      );

      await this.executeStep("deploy_firestore_indexes", () =>
        deployFirestoreIndexes(this.config, firebaseClient),
      );

      await this.executeStep("generate_android_keystore", async () => {
        const result = await generateAndroidKeystore(this.config);
        if (result) {
          this.config.androidSHA256Debug = result.androidSHA256Debug;
          this.config.androidSHA256Release = result.androidSHA256Release;
          this.config.keystoreResults = result.keystoreResults;
        }
      });

      await this.executeStep("commit_android_keystores", () => commitAndroidKeystores(this.config));

      await this.executeStep("save_local_config", () => {
        saveLocalConfig(this.config);
        const clientDir = getClientDir(this.config.folderName);
        this.resourceTracker.trackDirectory(clientDir);
      });

      await this.executeStep("setup_ios_certificates", async () => {
        const result = await setupIOSCertificates(this.config);
        this.config.iosCertificatesResult = result;
      });

      await this.executeStep("generate_app_check_instructions", () =>
        generateAppCheckSetup(this.config),
      );

      await this.executeStep("setup_app_config", async () => {
        const appConfigData = await setupAppConfig(this.config, firebaseClient);
        this.config.appConfig = appConfigData;
      });

      await this.executeStep("seed_default_data", async () => {
        this.seeder = await seedDefaultData(this.config, firebaseClient);
        this.resourceTracker.trackFirestoreCollection(this.config.clientCode, "Categories", firebaseClient);
        this.resourceTracker.trackFirestoreCollection(this.config.clientCode, "Products", firebaseClient);
        this.resourceTracker.trackFirestoreCollection(this.config.clientCode, "Store_Configs", firebaseClient);
      });

      await this.executeStep("setup_payment_config", async () => {
        const paymentConfig = await setupPaymentConfig(this.config, firebaseClient);
        this.config.paymentConfig = paymentConfig;
      });

      await this.executeStep("create_test_user", async () => {
        const credentials = await createTestUser(this.config, firebaseClient, this.seeder);
        this.config.testUserCredentials = credentials;
      });

      await this.executeStep("create_admin_user", async () => {
        const credentials = await createAdminUser(this.config, firebaseClient);
        this.config.adminCredentials = credentials;
      });

      await this.executeStep("commit_client_config", async () => {
        const commitHash = await commitClientConfig(this.config);
        this.config.commitHash = commitHash;
      });

      await this.executeStep("generate_metadata", () => generateMetadata(this.config));
      await this.executeStep("create_package_rename_config", () => createPackageRenameConfig(this.config));
      await this.executeStep("copy_business_type_assets", () => copyBusinessTypeAssets(this.config));
      await this.executeStep("create_shorebird_config", () => createShorebirdConfig(this.config));

      await this.executeStep("create_apns_key", async () => {
        const apnsKeyInfo = await createAPNsKey(this.config);
        this.config.apnsKeyInfo = apnsKeyInfo;
      });

      await this.executeStep("generate_push_notifications_instructions", () => {
        const instructionsPath = generatePushNotificationsSetupInstructions(this.config);
        this.config.pushNotificationsInstructionsPath = instructionsPath;
      });

      this.resourceTracker.clear();
      logger.success("All resources tracked and confirmed successful");

      if (this.checkpointManager) {
        this.checkpointManager.clear();
      }

      logger.blank();
      logger.info("Running health check on newly created client...");
      const healthCheck = new ClientHealthCheck(this.config.clientCode);
      await healthCheck.runAll();

      const duration = formatDuration(Date.now() - this.startTime);
      displayFinalSummary(this.config, duration);
      displayManualActionsSection(this.config);

      process.exit(0);
    } catch (error) {
      await this.handleError(error);
    } finally {
      firebaseClient.cleanup();
    }
  }

  async handleError(error) {
    const duration = formatDuration(Date.now() - this.startTime);
    logger.error(`Client creation failed after ${duration}`);
    logger.error(error.message);

    if (this.resourceTracker.count() > 0) {
      logger.warn("");
      logger.warn("Initiating rollback of created resources...");
      await this.resourceTracker.rollback();
    }

    if (this.checkpointManager && this.checkpointManager.exists()) {
      logger.blank();
      logger.info("Checkpoint saved - you can resume by running the wizard again");
      logger.info("The wizard will ask if you want to continue from where it left off");
      logger.blank();
    }

    if (this.config.clientName) {
      await telegram.error(this.config.clientName, error.message, "Client Creation");
    }

    await errorHandler.handleCLIError(error, {
      sendTelegram: false,
      cleanup: () => firebaseClient.cleanup(),
      exitCode: 1,
    });
  }
}

const wizard = new ClientCreationWizard();
wizard.run().catch((error) => {
  logger.error(`Unhandled error in wizard: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});
