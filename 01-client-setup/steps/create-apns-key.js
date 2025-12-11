const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

/**
 * APNs Key Creator
 *
 * Creates APNs Authentication Keys (.p8) for iOS push notifications
 * using the Apple Developer Portal API via Ruby/Spaceship.
 *
 * NOTE: This requires interactive authentication (Apple ID + 2FA)
 * The operator will be prompted for password and verification code.
 */
class APNsKeyCreator {
  constructor() {
    this.scriptPath = path.resolve(__dirname, '../../02-build-deploy/scripts/create_apns_key.rb');
    this.wrapperPath = path.resolve(__dirname, '../../02-build-deploy/scripts/run_apns_script.sh');
    // loyalty-credentials is a sibling repo to loyalty-compose, not inside it
    // From: 01-client-setup/steps/ -> ../../../loyalty-credentials
    this.credentialsPath = path.resolve(__dirname, '../../../loyalty-credentials');
    this.apnsDir = path.join(this.credentialsPath, 'shared', 'apns');
  }

  /**
   * Check if an APNs key already exists
   * @returns {Object} { exists: boolean, keyFile?: string, keyId?: string }
   */
  checkExistingKey() {
    if (!fs.existsSync(this.apnsDir)) {
      return { exists: false, reason: 'APNs directory not found' };
    }

    const files = fs.readdirSync(this.apnsDir);
    const p8Files = files.filter((f) => f.endsWith('.p8'));

    if (p8Files.length === 0) {
      return { exists: false, reason: 'No .p8 files found' };
    }

    // Extract Key ID from filename (AuthKey_XXXXXXXX.p8)
    const keyFile = p8Files[0];
    const keyIdMatch = keyFile.match(/AuthKey_([A-Z0-9]+)\.p8/);
    const keyId = keyIdMatch ? keyIdMatch[1] : null;

    return {
      exists: true,
      keyFile: path.join(this.apnsDir, keyFile),
      keyId,
      allKeys: p8Files,
    };
  }

  /**
   * Get Team ID from environment or credentials
   * @returns {string|null} Team ID
   */
  getTeamId() {
    return process.env.APPLE_TEAM_ID || '84LT77P2DM';
  }

  /**
   * Create APNs key interactively
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Function} options.inquirer Inquirer instance for prompts
   * @returns {Promise<Object>} Result with keyId, teamId, keyPath
   */
  async createKey(options = {}) {
    const { logger, inquirer } = options;

    // Check if key already exists
    const existingKey = this.checkExistingKey();
    if (existingKey.exists) {
      if (logger) {
        logger.info(`✅ APNs key already exists: ${existingKey.keyFile}`);
        logger.info(`   Key ID: ${existingKey.keyId}`);
      }
      return {
        success: true,
        skipped: true,
        reason: 'Key already exists',
        keyId: existingKey.keyId,
        keyFile: existingKey.keyFile,
        teamId: this.getTeamId(),
      };
    }

    // Check if Apple Developer Email is configured
    const appleEmail = process.env.APPLE_DEVELOPER_EMAIL;
    if (!appleEmail) {
      if (logger) {
        logger.error('APPLE_DEVELOPER_EMAIL environment variable is required');
        logger.info('Add it to automation/.env file');
      }
      return {
        success: false,
        error: 'APPLE_DEVELOPER_EMAIL not configured',
      };
    }

    // Check if script exists
    if (!fs.existsSync(this.wrapperPath)) {
      if (logger) {
        logger.error(`APNs creation script not found: ${this.wrapperPath}`);
      }
      return {
        success: false,
        error: 'Script not found',
      };
    }

    // Prompt user before starting (requires interaction)
    if (inquirer && logger) {
      logger.blank();
      logger.warn('⚠️  APNs Key Creation requires Apple ID authentication');
      logger.info(`   Email: ${appleEmail}`);
      logger.info('   You will be prompted for password and 2FA code');
      logger.blank();

      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Proceed with APNs key creation?',
          default: true,
        },
      ]);

      if (!proceed) {
        logger.info('APNs key creation skipped by user');
        return {
          success: true,
          skipped: true,
          reason: 'Skipped by user',
        };
      }
    }

    // Execute the script
    if (logger) {
      logger.info('Creating APNs key...');
      logger.info('Please follow the prompts for Apple ID authentication');
      logger.blank();
    }

    return new Promise((resolve) => {
      const child = spawn('bash', [this.wrapperPath], {
        env: {
          ...process.env,
          APPLE_DEVELOPER_EMAIL: appleEmail,
          APNS_OUTPUT_DIR: this.apnsDir,
        },
        stdio: 'inherit', // Allow interactive input/output
        cwd: path.dirname(this.wrapperPath),
      });

      child.on('close', (code) => {
        if (code === 0) {
          // Check for created key
          const newKey = this.checkExistingKey();
          if (newKey.exists) {
            if (logger) {
              logger.blank();
              logger.success('✅ APNs key created successfully!');
              logger.info(`   Key ID: ${newKey.keyId}`);
              logger.info(`   File: ${newKey.keyFile}`);
            }
            resolve({
              success: true,
              keyId: newKey.keyId,
              keyFile: newKey.keyFile,
              teamId: this.getTeamId(),
            });
          } else {
            resolve({
              success: false,
              error: 'Key file not found after creation',
            });
          }
        } else {
          if (logger) {
            logger.error(`APNs key creation failed with exit code: ${code}`);
          }
          resolve({
            success: false,
            error: `Script exited with code ${code}`,
          });
        }
      });

      child.on('error', (err) => {
        if (logger) {
          logger.error(`Failed to execute APNs script: ${err.message}`);
        }
        resolve({
          success: false,
          error: err.message,
        });
      });
    });
  }

  /**
   * Get APNs key info for Firebase upload instructions
   * @returns {Object|null} Key info or null if not found
   */
  getKeyInfo() {
    const existingKey = this.checkExistingKey();
    if (!existingKey.exists) {
      return null;
    }

    return {
      keyId: existingKey.keyId,
      keyFile: existingKey.keyFile,
      teamId: this.getTeamId(),
    };
  }
}

module.exports = APNsKeyCreator;
