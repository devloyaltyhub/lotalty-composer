/**
 * Update Versionarte in Firebase Remote Config
 *
 * This module updates the versionarte parameter in Remote Config
 * after a successful deployment to stores.
 *
 * It updates:
 * - latest version for the deployed platform(s)
 * - Optionally disables maintenance mode (status.active = false)
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const logger = require('../shared/utils/logger');

class VersionarteUpdater {
  constructor() {
    this.app = null;
  }

  /**
   * Initialize Firebase Admin for the client project
   * @param {string} clientCode - The client code
   * @param {Object} config - Client config with firebaseOptions
   */
  initializeFirebase(clientCode, config) {
    // Check if already initialized
    const appName = `versionarte-${clientCode}`;
    try {
      this.app = admin.app(appName);
      return this.app;
    } catch {
      // App not initialized, continue
    }

    // Find the service account for this client
    const repoPath = path.resolve(__dirname, '../..');
    const possiblePaths = [
      path.join(repoPath, 'clients', clientCode, 'service-account.json'),
      path.join(repoPath, '..', 'loyalty-credentials', clientCode, 'service-account.json'),
    ];

    const serviceAccountPath = possiblePaths.find((filePath) => fs.existsSync(filePath));

    if (!serviceAccountPath) {
      const pathsList = possiblePaths.map((filePath) => `  - ${filePath}`).join('\n');
      throw new Error(`Service account not found for ${clientCode}. Looked in:\n${pathsList}`);
    }

    const serviceAccount = require(serviceAccountPath);

    this.app = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: config.firebaseOptions?.projectId || serviceAccount.project_id,
      },
      appName
    );

    logger.info(`Firebase initialized for ${clientCode}`);
    return this.app;
  }

  /**
   * Get default versionarte structure
   */
  getDefaultVersionarte() {
    return {
      android: {
        version: { minimum: '1.0.0', latest: '0.0.1' },
        download_url: '',
        status: {
          active: true,
          message: { pt: 'O Aplicativo está em manutenção. Por favor, tente mais tarde.' },
        },
      },
      ios: {
        version: { minimum: '1.0.0', latest: '0.0.1' },
        download_url: '',
        status: {
          active: true,
          message: { pt: 'O Aplicativo está em manutenção. Por favor, tente mais tarde.' },
        },
      },
    };
  }

  /**
   * Update a single platform's versionarte data
   * @param {Object} params - Parameters object
   * @param {Object} params.versionarte - The versionarte object to update
   * @param {string} params.platform - Platform to update
   * @param {Object} params.options - Update options (version, downloadUrls, disableMaintenance)
   */
  updatePlatformVersionarte(params) {
    const { versionarte, platform, options } = params;
    const { version, downloadUrls = {}, disableMaintenance } = options;

    if (!versionarte[platform]) {
      return;
    }

    versionarte[platform].version.latest = version;

    if (downloadUrls[platform]) {
      versionarte[platform].download_url = downloadUrls[platform];
    }

    if (disableMaintenance) {
      versionarte[platform].status.active = false;
    }

    logger.info(`  ${platform}: latest=${version}, maintenance=${!disableMaintenance}`);
  }

  /**
   * Update versionarte in Remote Config
   * @param {Object} options - Update options
   * @param {string} options.version - New version (e.g., "1.2.0")
   * @param {string[]} options.platforms - Platforms to update ("android", "ios")
   * @param {boolean} options.disableMaintenance - Whether to disable maintenance mode
   * @param {Object} options.downloadUrls - Download URLs per platform (optional)
   */
  async updateVersionarte(options) {
    const { version, platforms, disableMaintenance = true, downloadUrls = {} } = options;

    logger.startSpinner('Updating versionarte in Remote Config...');

    try {
      const remoteConfig = admin.remoteConfig(this.app);
      const template = await remoteConfig.getTemplate();

      // Get current versionarte or create default
      const currentValue = template.parameters.versionarte?.defaultValue?.value;
      const versionarte = currentValue ? JSON.parse(currentValue) : this.getDefaultVersionarte();

      // Update each platform
      for (const platform of platforms) {
        this.updatePlatformVersionarte({
          versionarte,
          platform,
          options: { version, downloadUrls, disableMaintenance },
        });
      }

      // Update template
      template.parameters.versionarte = {
        defaultValue: { value: JSON.stringify(versionarte) },
        valueType: 'STRING',
        description: 'Version control and maintenance status for Android and iOS platforms',
      };

      await remoteConfig.publishTemplate(template);
      logger.succeedSpinner('Versionarte updated successfully');

      return versionarte;
    } catch (error) {
      logger.failSpinner('Failed to update versionarte');
      throw error;
    }
  }

  /**
   * Cleanup Firebase app
   */
  async cleanup() {
    if (this.app) {
      try {
        await this.app.delete();
        this.app = null;
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Update versionarte after successful deployment
 * @param {Object} params - Parameters object
 * @param {string} params.clientCode - The client code
 * @param {Object} params.config - Client configuration
 * @param {string} params.version - The deployed version
 * @param {string[]} params.platforms - Deployed platforms
 * @param {boolean} params.disableMaintenance - Whether to disable maintenance mode
 */
async function updateVersionarteAfterDeploy(params) {
  const { clientCode, config, version, platforms, disableMaintenance = true } = params;
  const updater = new VersionarteUpdater();

  try {
    updater.initializeFirebase(clientCode, config);

    await updater.updateVersionarte({
      version,
      platforms,
      disableMaintenance,
    });

    return true;
  } catch (error) {
    logger.error(`Failed to update versionarte: ${error.message}`);
    // Don't throw - this is not critical for deployment success
    return false;
  } finally {
    await updater.cleanup();
  }
}

module.exports = {
  VersionarteUpdater,
  updateVersionarteAfterDeploy,
};
