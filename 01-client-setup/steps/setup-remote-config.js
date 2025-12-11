const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class RemoteConfigSetup {
  constructor(firebaseApp) {
    if (!firebaseApp) {
      throw new Error('Firebase app instance is required');
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

    console.log(chalk.blue('\n📡 Setting up Firebase Remote Config...'));

    try {
      // Load the Remote Config template
      const template = await this.loadTemplate();

      // Replace variables in the template
      const processedTemplate = this.replaceVariables(template, {
        featureFlags,
        clarityProjectId,
      });

      // Publish the Remote Config template
      await this.publishTemplate(processedTemplate, clientCode);

      // Validate the published configuration
      await this.validateRemoteConfig(featureFlags, clarityProjectId);

      console.log(chalk.green('✓ Remote Config setup completed successfully'));

      return {
        featureFlags,
        clarityProjectId,
        versionarte: this.getDefaultVersionarte(),
      };
    } catch (error) {
      console.error(chalk.red('✗ Failed to setup Remote Config:'), error.message);
      throw error;
    }
  }

  /**
   * Load the Remote Config template from file
   */
  async loadTemplate() {
    const templatePath = path.join(__dirname, '../../shared/templates/remote-config-template.json');

    try {
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      return JSON.parse(templateContent);
    } catch (error) {
      throw new Error(`Failed to load Remote Config template: ${error.message}`);
    }
  }

  /**
   * Replace variables in the template
   */
  replaceVariables(template, config) {
    const { featureFlags, clarityProjectId } = config;

    // Convert template to string for replacement
    let templateStr = JSON.stringify(template, null, 2);

    // Replace feature flags
    templateStr = templateStr.replace('{{DELIVERY}}', featureFlags.delivery ? 'true' : 'false');
    templateStr = templateStr.replace('{{CLUB}}', featureFlags.club ? 'true' : 'false');
    templateStr = templateStr.replace('{{HAPPY_HOUR}}', featureFlags.happyHour ? 'true' : 'false');
    templateStr = templateStr.replace('{{CAMPAIGNS}}', featureFlags.campaigns ? 'true' : 'false');
    templateStr = templateStr.replace(
      '{{STORE_HOURS}}',
      featureFlags.storeHours ? 'true' : 'false'
    );
    templateStr = templateStr.replace(
      '{{PUSH_NOTIFICATIONS}}',
      featureFlags.pushNotifications ? 'true' : 'false'
    );
    templateStr = templateStr.replace(
      '{{SUGGESTION_BOX}}',
      featureFlags.suggestionBox ? 'true' : 'false'
    );
    templateStr = templateStr.replace('{{CLARITY}}', featureFlags.clarity ? 'true' : 'false');
    templateStr = templateStr.replace('{{OUR_STORY}}', featureFlags.ourStory ? 'true' : 'false');

    // Replace Clarity Project ID
    templateStr = templateStr.replace('{{CLARITY_PROJECT_ID}}', clarityProjectId);

    return JSON.parse(templateStr);
  }

  /**
   * Publish the Remote Config template to Firebase
   */
  async publishTemplate(template, clientCode) {
    const admin = require('firebase-admin');

    console.log(chalk.blue('  → Publishing Remote Config template...'));

    try {
      const remoteConfig = admin.remoteConfig(this.app);

      // Always get the current template (Firebase creates a blank one if it doesn't exist)
      let currentTemplate = await remoteConfig.getTemplate();

      // Update the template with our parameters and conditions
      currentTemplate.parameters = template.parameters;
      currentTemplate.conditions = template.conditions || [];

      // Don't set version - Firebase manages this automatically
      // The version field in our template file is just for documentation

      // Publish the template
      const publishedTemplate = await remoteConfig.publishTemplate(currentTemplate);

      console.log(
        chalk.green(
          `  ✓ Remote Config template published (version: ${publishedTemplate.version.versionNumber})`
        )
      );
    } catch (error) {
      throw new Error(`Failed to publish Remote Config template: ${error.message}`);
    }
  }

  /**
   * Validate that the Remote Config was published correctly
   * Note: Remote Config may take some time to propagate
   */
  async validateRemoteConfig(expectedFeatureFlags, expectedClarityId) {
    const admin = require('firebase-admin');

    console.log(chalk.blue('  → Validating Remote Config (this may take a moment)...'));

    const maxRetries = 5;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const remoteConfig = admin.remoteConfig(this.app);
        const template = await remoteConfig.getTemplate();

        // Check if feature flags parameter exists
        if (!template.parameters.featureFlags) {
          throw new Error('featureFlags parameter not found');
        }

        // Check if clarityProjectId parameter exists
        if (!template.parameters.clarityProjectId) {
          throw new Error('clarityProjectId parameter not found');
        }

        // Check if versionarte parameter exists
        if (!template.parameters.versionarte) {
          throw new Error('versionarte parameter not found');
        }

        // Parse and validate feature flags
        const publishedFeatureFlags = JSON.parse(
          template.parameters.featureFlags.defaultValue.value
        );

        // Validate each feature flag
        const featureFlagKeys = Object.keys(expectedFeatureFlags);
        for (const key of featureFlagKeys) {
          if (publishedFeatureFlags[key] !== expectedFeatureFlags[key]) {
            throw new Error(`Feature flag mismatch for ${key}`);
          }
        }

        // Validate Clarity Project ID
        const publishedClarityId = template.parameters.clarityProjectId.defaultValue.value;
        if (publishedClarityId !== expectedClarityId) {
          throw new Error('Clarity Project ID mismatch');
        }

        console.log(chalk.green('  ✓ Remote Config validated successfully'));
        return true;
      } catch (error) {
        if (attempt < maxRetries) {
          console.log(
            chalk.yellow(`  ⚠ Validation attempt ${attempt}/${maxRetries} failed, retrying...`)
          );
          await this.sleep(retryDelay);
        } else {
          console.log(
            chalk.yellow('  ⚠ Remote Config validation timed out, but template was published')
          );
          console.log(chalk.yellow('    You can verify manually in Firebase Console'));
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Get default versionarte configuration
   */
  getDefaultVersionarte() {
    return {
      android: {
        version: {
          minimum: '1.0.0',
          latest: '0.0.1',
        },
        download_url: '',
        status: {
          active: true,
          message: {
            pt: 'O Aplicativo está em manutenção. Por favor, tente mais tarde.',
          },
        },
      },
      ios: {
        version: {
          minimum: '1.0.0',
          latest: '0.0.1',
        },
        download_url: '',
        status: {
          active: true,
          message: {
            pt: 'O Aplicativo está em manutenção. Por favor, tente mais tarde.',
          },
        },
      },
    };
  }

  /**
   * Sleep utility for retries
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = RemoteConfigSetup;
