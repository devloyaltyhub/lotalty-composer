#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');
const logger = require('../../shared/utils/logger');
const telegram = require('../../shared/utils/telegram');
const errorHandler = require('../../shared/utils/error-handler');
const clientSelector = require('../../shared/utils/client-selector');
const ClientBuilder = require('../../02-build-deploy/build-client');

class ClientUpdater {
  constructor() {
    this.clientSelector = clientSelector;
    this.repoPath = path.resolve(__dirname, '../../..');
  }

  // Get version from pubspec.yaml (single source of truth)
  getVersionInfo() {
    const pubspecPath = path.join(this.repoPath, 'white_label_app', 'pubspec.yaml');
    const pubspec = fs.readFileSync(pubspecPath, 'utf8');
    const versionRegex = /^version:\s*(\d+)\.(\d+)\.(\d+)\+(\d+)/m;
    const match = pubspec.match(versionRegex);
    if (!match) {
      return { version: '0.0.0', buildNumber: 0 };
    }
    return {
      version: `${match[1]}.${match[2]}.${match[3]}`,
      buildNumber: parseInt(match[4], 10),
    };
  }

  // Select platforms
  async selectPlatforms() {
    const { platforms } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'platforms',
        message: 'Select platforms to build:',
        choices: [
          { name: 'Android', value: 'android', checked: true },
          { name: 'iOS', value: 'ios', checked: process.platform === 'darwin' },
        ],
        validate: (input) => input.length > 0 || 'Select at least one platform',
      },
    ]);

    return platforms;
  }

  // Confirm update
  async confirmUpdate(clientName, config) {
    logger.blank();
    logger.subSection('Current Client Information');
    logger.keyValue('Client Name', config.clientName);
    logger.keyValue('Client Code', config.clientCode);
    logger.keyValue('Bundle ID', config.bundleId);
    logger.keyValue('Deploy Branch', `deploy/${config.clientCode}`);
    const versionInfo = this.getVersionInfo();
    logger.keyValue('Current Version', `${versionInfo.version}+${versionInfo.buildNumber}`);
    logger.blank();

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Proceed with update?',
        default: true,
      },
    ]);

    if (!confirmed) {
      logger.warn('Update cancelled');
      process.exit(0);
    }
  }

  // Main update flow
  async run() {
    try {
      logger.section('Update Client');

      // Step 1: Select client
      const clientName = await this.clientSelector.selectClient({
        message: 'Select client to update:',
      });
      const config = this.clientSelector.loadClientConfig(clientName);

      // Step 2: Select platforms
      const platforms = await this.selectPlatforms();

      // Step 3: Confirm update
      await this.confirmUpdate(clientName, config);

      // Step 4: Send notification
      const { version } = this.getVersionInfo();
      await telegram.updateStarted(config.clientName, version);

      // Step 5: Build and deploy
      logger.section('Building and Deploying');

      const builder = new ClientBuilder();
      const result = await builder.buildAndDeploy({
        clientName,
        platforms,
        deploy: true,
      });

      // Step 6: Send completion notification
      await telegram.updateCompleted(
        config.clientName,
        result.version,
        result.buildNumber,
        result.platforms
      );

      logger.success('✅ Client update completed successfully!');
      process.exit(0);
    } catch (error) {
      logger.error(`Update failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Run updater
const updater = new ClientUpdater();
updater.run();
