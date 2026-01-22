const fs = require("fs").promises;
const path = require("path");
const chalk = require("chalk");
const {
  replaceTemplateVariables,
  getDefaultVersionarte,
  sleep,
} = require("../../shared/utils/remote-config-helpers");

class RemoteConfigSetup {
  constructor(firebaseApp) {
    if (!firebaseApp) {
      throw new Error("Firebase app instance is required");
    }
    this.app = firebaseApp;
  }

  /**
   * Setup Remote Config for a client
   * @param {Object} config - Configuration object
   * @param {Object} config.featureFlags - Feature flags object
   * @param {string} config.clarityProjectId - Clarity project ID
   * @param {string} config.clientCode - Client code for logging
   */
  async setupRemoteConfig(config) {
    const { featureFlags, clarityProjectId, clientCode } = config;

    console.log(chalk.blue("\n📡 Setting up Firebase Remote Config..."));

    try {
      const template = await this.loadTemplate();

      const processedTemplate = replaceTemplateVariables(template, {
        featureFlags,
        clarityProjectId,
      });

      await this.publishTemplate(processedTemplate, clientCode);

      await this.validateRemoteConfig(featureFlags, clarityProjectId);

      console.log(chalk.green("✓ Remote Config setup completed successfully"));

      return {
        featureFlags,
        clarityProjectId,
        versionarte: getDefaultVersionarte(),
      };
    } catch (error) {
      console.error(
        chalk.red("✗ Failed to setup Remote Config:"),
        error.message,
      );
      throw error;
    }
  }

  /**
   * Load the Remote Config template from file
   */
  async loadTemplate() {
    const templatePath = path.join(
      __dirname,
      "../../shared/templates/remote-config-template.json",
    );

    try {
      const templateContent = await fs.readFile(templatePath, "utf-8");
      return JSON.parse(templateContent);
    } catch (error) {
      throw new Error(
        `Failed to load Remote Config template: ${error.message}`,
      );
    }
  }

  /**
   * Publish the Remote Config template to Firebase
   */
  async publishTemplate(template, _clientCode) {
    const admin = require("firebase-admin");

    console.log(chalk.blue("  → Publishing Remote Config template..."));

    try {
      const remoteConfig = admin.remoteConfig(this.app);

      let currentTemplate = await remoteConfig.getTemplate();

      currentTemplate.parameters = template.parameters;
      currentTemplate.conditions = template.conditions || [];

      const publishedTemplate =
        await remoteConfig.publishTemplate(currentTemplate);

      console.log(
        chalk.green(
          `  ✓ Remote Config template published (version: ${publishedTemplate.version.versionNumber})`,
        ),
      );
    } catch (error) {
      throw new Error(
        `Failed to publish Remote Config template: ${error.message}`,
      );
    }
  }

  /**
   * Validate that the Remote Config was published correctly
   * Note: Remote Config may take some time to propagate
   */
  async validateRemoteConfig(expectedFeatureFlags, expectedClarityId) {
    const admin = require("firebase-admin");

    console.log(
      chalk.blue("  → Validating Remote Config (this may take a moment)..."),
    );

    const maxRetries = 5;
    const retryDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const remoteConfig = admin.remoteConfig(this.app);
        const template = await remoteConfig.getTemplate();

        this.validateTemplateParameters(template);

        this.validateFeatureFlags(template, expectedFeatureFlags);

        this.validateClarityProjectId(template, expectedClarityId);

        console.log(chalk.green("  ✓ Remote Config validated successfully"));
        return true;
      } catch (error) {
        if (attempt < maxRetries) {
          console.log(
            chalk.yellow(
              `  ⚠ Validation attempt ${attempt}/${maxRetries} failed, retrying...`,
            ),
          );
          await sleep(retryDelay);
        } else {
          console.log(
            chalk.yellow(
              "  ⚠ Remote Config validation timed out, but template was published",
            ),
          );
          console.log(
            chalk.yellow("    You can verify manually in Firebase Console"),
          );
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Validate required template parameters exist
   */
  validateTemplateParameters(template) {
    if (!template.parameters.featureFlags) {
      throw new Error("featureFlags parameter not found");
    }

    if (!template.parameters.clarityProjectId) {
      throw new Error("clarityProjectId parameter not found");
    }

    if (!template.parameters.versionarte) {
      throw new Error("versionarte parameter not found");
    }
  }

  /**
   * Validate feature flags match expected values
   */
  validateFeatureFlags(template, expectedFeatureFlags) {
    const publishedFeatureFlags = JSON.parse(
      template.parameters.featureFlags.defaultValue.value,
    );

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
  validateClarityProjectId(template, expectedClarityId) {
    const publishedClarityId =
      template.parameters.clarityProjectId.defaultValue.value;
    if (publishedClarityId !== expectedClarityId) {
      throw new Error("Clarity Project ID mismatch");
    }
  }
}

module.exports = RemoteConfigSetup;
