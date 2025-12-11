#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');
const logger = require('../../shared/utils/logger');
const errorHandler = require('../../shared/utils/error-handler');
const clientSelector = require('../../shared/utils/client-selector');
const MetadataGenerator = require('../steps/generate-metadata');

class MetadataUpdater {
  constructor() {
    this.repoPath = process.cwd();
    this.clientsPath = path.join(this.repoPath, 'clients');
    this.clientSelector = clientSelector;
  }

  // Collect metadata information
  async collectMetadataInfo(existingConfig) {
    logger.blank();
    logger.section('Update App Store Metadata');
    logger.info('Current values are shown as defaults. Press Enter to keep them.');
    logger.blank();

    const metadata = existingConfig.metadata || {};

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'websiteUrl',
        message: 'Website URL:',
        default: metadata.websiteUrl || '',
      },
      {
        type: 'input',
        name: 'supportUrl',
        message: 'Support URL:',
        default: metadata.supportUrl || '',
      },
      {
        type: 'input',
        name: 'privacyUrl',
        message: 'Privacy Policy URL:',
        default: metadata.privacyUrl || '',
      },
    ]);

    return answers;
  }

  // Main execution flow
  async run() {
    try {
      logger.section('Update Client Metadata');

      // Step 1: Select client
      const clientName = await this.clientSelector.selectClient({
        message: 'Select client to update metadata:',
      });
      const config = this.clientSelector.loadClientConfig(clientName);
      const clientFolder = path.join(this.clientsPath, clientName);

      // Step 2: Collect metadata info
      const metadataInfo = await this.collectMetadataInfo(config);

      // Step 3: Confirm update
      logger.blank();
      logger.subSection('Review Changes');
      logger.keyValue('Client', config.clientName);
      logger.keyValue('Website URL', metadataInfo.websiteUrl || '(not set)');
      logger.keyValue('Support URL', metadataInfo.supportUrl || '(not set)');
      logger.keyValue('Privacy URL', metadataInfo.privacyUrl || '(not set)');
      logger.blank();

      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Update metadata?',
          default: true,
        },
      ]);

      if (!confirmed) {
        logger.warn('Update cancelled');
        process.exit(0);
      }

      // Step 4: Regenerate metadata
      logger.section('Regenerating Metadata Files');

      const locale = config.locale || 'pt-BR';
      const generator = new MetadataGenerator(clientFolder, locale);

      await generator.generateAll({
        clientName: config.clientName,
        appDisplayName: config.appName,
        businessType: config.businessType,
        adminEmail: config.adminEmail,
        supportUrl: metadataInfo.supportUrl,
        marketingUrl: metadataInfo.websiteUrl,
        websiteUrl: metadataInfo.websiteUrl,
        privacyUrl: metadataInfo.privacyUrl,
      });

      // Step 5: Update config file
      logger.section('Updating Configuration');

      config.metadata = {
        websiteUrl: metadataInfo.websiteUrl,
        supportUrl: metadataInfo.supportUrl,
        privacyUrl: metadataInfo.privacyUrl,
      };

      const configPath = path.join(clientFolder, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

      logger.success('Config updated');

      // Step 6: Show next steps
      logger.blank();
      logger.summaryBox({
        Client: config.clientName,
        'Metadata Path': `clients/${clientName}/metadata/`,
        'Next Steps': 'Edit text files and add screenshots, then redeploy',
      });

      logger.success('✅ Metadata updated successfully!');
      logger.blank();
      logger.info('Next steps:');
      logger.info('1. Edit metadata text files if needed');
      logger.info('2. Add/update screenshots in metadata folders');
      logger.info('3. Deploy to app stores:');
      logger.info(`   npm run update-client`);
      logger.info('   (Select client and platforms)');
      logger.blank();

      process.exit(0);
    } catch (error) {
      logger.error(`Metadata update failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Run updater
const updater = new MetadataUpdater();
updater.run();
