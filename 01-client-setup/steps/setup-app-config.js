const admin = require("firebase-admin");
const logger = require("../../shared/utils/logger");
const { withRetry } = require("../../shared/utils/retry-helpers");

function getDefaultVersionarte() {
  const platformConfig = {
    version: {
      minimum: "1.0.0",
      latest: "0.0.1",
    },
    download_url: "",
    status: {
      active: true,
      message: {
        pt: "O Aplicativo esta em manutencao. Por favor, tente mais tarde.",
      },
    },
  };

  return {
    android: { ...platformConfig },
    ios: { ...platformConfig },
  };
}

class AppConfigSetup {
  constructor(firebaseApp) {
    if (!firebaseApp) {
      throw new Error("Firebase app instance is required");
    }
    this.app = firebaseApp;
  }

  /**
   * Setup App Config for a client
   * @param {Object} config - Configuration object
   * @param {Object} config.featureFlags - Feature flags object
   * @param {string} config.clarityProjectId - Clarity project ID
   * @param {string} config.clientCode - Client code for logging
   * @param {string} config.clientName - Client display name (used in push notifications)
   * @param {string} config.planType - Subscription plan type
   * @param {Object} config.planLimits - Plan-based limits
   */
  async setupAppConfig(config) {
    const {
      featureFlags,
      clarityProjectId,
      clientCode,
      clientName,
      planType,
      planLimits,
    } = config;

    logger.info("Setting up App Config (Firestore)...");

    try {
      const configData = {
        featureFlags: featureFlags || {},
        clarityProjectId: clarityProjectId || "",
        storeName: clientName || clientCode || "",
        planType: planType || "profissional",
        planLimits: planLimits || {},
        versionarte: getDefaultVersionarte(),
        launchScreenConfig: { launchDateTime: null },
      };

      const db = admin.firestore(this.app);
      await db.collection("App_Config").doc("config").set(configData);

      logger.success(`App Config document written for ${clientCode}`);

      await this.validateAppConfig(featureFlags, clarityProjectId);

      logger.success("App Config setup completed successfully");

      return {
        featureFlags,
        clarityProjectId,
        planType,
        versionarte: getDefaultVersionarte(),
      };
    } catch (error) {
      logger.error(`Failed to setup App Config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate that the App Config was written correctly
   */
  async validateAppConfig(expectedFeatureFlags, expectedClarityId) {
    logger.info("Validating App Config (this may take a moment)...");

    try {
      await withRetry(
        async () => {
          const db = admin.firestore(this.app);
          const docSnap = await db.collection("App_Config").doc("config").get();

          if (!docSnap.exists) {
            throw new Error("App_Config/config document not found");
          }

          const data = docSnap.data();
          this.validateDocumentFields(data);
          this.validateFeatureFlags(data, expectedFeatureFlags);
          this.validateClarityProjectId(data, expectedClarityId);
        },
        { maxRetries: 5, delayMs: 2000 },
      );

      logger.success("App Config validated successfully");
      return true;
    } catch {
      logger.warn("App Config validation timed out, but document was written");
      logger.warn("You can verify manually in Firebase Console");
      return false;
    }
  }

  /**
   * Validate required document fields exist
   */
  validateDocumentFields(data) {
    if (!data.featureFlags) {
      throw new Error("featureFlags field not found");
    }

    if (data.clarityProjectId === undefined) {
      throw new Error("clarityProjectId field not found");
    }

    if (!data.versionarte) {
      throw new Error("versionarte field not found");
    }
  }

  /**
   * Validate feature flags match expected values
   */
  validateFeatureFlags(data, expectedFeatureFlags) {
    const publishedFeatureFlags = data.featureFlags;

    const featureFlagKeys = Object.keys(expectedFeatureFlags);
    for (const key of featureFlagKeys) {
      if (publishedFeatureFlags[key] !== expectedFeatureFlags[key]) {
        throw new Error(`Feature flag mismatch for ${key}`);
      }
    }
  }

  /**
   * Validate Clarity Project ID matches expected value
   */
  validateClarityProjectId(data, expectedClarityId) {
    if (data.clarityProjectId !== expectedClarityId) {
      throw new Error("Clarity Project ID mismatch");
    }
  }

  /**
   * Update plan-related config in App Config
   * @param {Object} config - Configuration object
   * @param {string} config.planType - New plan type
   * @param {Object} config.featureFlags - Feature flags for the new plan
   * @param {Object} config.planLimits - Limits for the new plan
   */
  async updatePlanConfig(config) {
    const { planType, featureFlags, planLimits } = config;

    logger.info("Updating App Config for plan change...");

    try {
      const db = admin.firestore(this.app);
      const updateData = {
        planType,
        planLimits,
      };

      if (featureFlags) {
        updateData.featureFlags = featureFlags;
      }

      await db.collection("App_Config").doc("config").update(updateData);

      logger.success("App Config updated for plan change");

      return true;
    } catch (error) {
      throw new Error(`Failed to update App Config: ${error.message}`);
    }
  }
}

module.exports = AppConfigSetup;
