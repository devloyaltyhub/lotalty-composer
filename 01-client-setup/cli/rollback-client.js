#!/usr/bin/env node

const path = require('path');
const inquirer = require('inquirer');
const logger = require('../../shared/utils/logger');
const telegram = require('../../shared/utils/telegram');
const errorHandler = require('../../shared/utils/error-handler');
const clientSelector = require('../../shared/utils/client-selector');
const GitBranchManager = require('../steps/create-git-branch');
const ClientBuilder = require('../../02-build-deploy/build-client');

class ClientRollback {
  constructor() {
    this.repoPath = process.cwd();
    this.clientSelector = clientSelector;
    this.gitManager = new GitBranchManager(this.repoPath);
  }

  // List available tags for client
  async listClientTags(clientName) {
    const pattern = `${clientName}/v*`;
    const tags = await this.gitManager.listTags(pattern);

    if (tags.length === 0) {
      logger.error(`No tags found for client: ${clientName}`);
      process.exit(1);
    }

    return tags.reverse(); // Most recent first
  }

  // Select tag to rollback to
  async selectTag(clientName, tags) {
    const { tag } = await inquirer.prompt([
      {
        type: 'list',
        name: 'tag',
        message: 'Select version to rollback to:',
        choices: tags.map((tag) => ({
          name: tag,
          value: tag,
        })),
        pageSize: 15,
      },
    ]);

    return tag;
  }

  // Confirm rollback
  async confirmRollback(clientName, currentTag, targetTag) {
    logger.blank();
    logger.warn('⚠️  ROLLBACK WARNING');
    logger.warn('This will:');
    logger.warn('1. Checkout the selected Git tag');
    logger.warn('2. Rebuild the apps from that commit');
    logger.warn('3. Redeploy to app stores');
    logger.blank();
    logger.keyValue('Client', clientName);
    logger.keyValue('Current Version', currentTag || 'Unknown');
    logger.keyValue('Rollback To', targetTag);
    logger.blank();

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Are you sure you want to rollback?',
        default: false,
      },
    ]);

    if (!confirmed) {
      logger.warn('Rollback cancelled');
      process.exit(0);
    }
  }

  // Extract version info from tag
  parseTagInfo(tag) {
    // Format: client-name/v1.0.0+1
    const match = tag.match(/^(.+)\/v(.+)\+(\d+)$/);
    if (match) {
      return {
        clientName: match[1],
        version: match[2],
        buildNumber: parseInt(match[3]),
      };
    }
    return null;
  }

  // Main rollback flow
  async run() {
    try {
      logger.section('Rollback Client');

      // Step 1: Select client
      const clientName = await this.clientSelector.selectClient({
        message: 'Select client to rollback:',
      });
      const config = this.clientSelector.loadClientConfig(clientName);

      // Step 2: List available tags
      logger.startSpinner('Loading available versions...');
      const tags = await this.listClientTags(clientName);
      logger.succeedSpinner(`Found ${tags.length} versions`);

      // Step 3: Select tag
      const targetTag = await this.selectTag(clientName, tags);
      const tagInfo = this.parseTagInfo(targetTag);

      // Step 4: Confirm rollback
      const currentTag = tags[0]; // Most recent tag is the current version
      await this.confirmRollback(clientName, currentTag, targetTag);

      // Step 5: Send notification
      await telegram.rollbackStarted(config.clientName, currentTag, targetTag);

      // Step 6: Checkout tag
      logger.section('Rolling Back');
      await this.gitManager.checkoutTag(targetTag);

      // Step 7: Rebuild and redeploy
      logger.section('Rebuilding and Redeploying');

      const builder = new ClientBuilder();
      await builder.buildAndDeploy({
        clientName,
        platforms: ['android', 'ios'],
        deploy: true,
      });

      // Step 8: Create rollback tag
      const rollbackTagName = `${targetTag}-rollback-${Date.now()}`;
      await this.gitManager.createTag(rollbackTagName, `Rollback to ${targetTag}`);
      await this.gitManager.pushTag(rollbackTagName);

      // Step 9: Return to deploy branch
      const deployBranch = `deploy/${config.clientCode}`;
      await this.gitManager.git.checkout(deployBranch);

      // Step 10: Send completion notification
      await telegram.rollbackCompleted(
        config.clientName,
        tagInfo ? `${tagInfo.version}+${tagInfo.buildNumber}` : targetTag,
        targetTag
      );

      logger.success('✅ Rollback completed successfully!');
      logger.blank();
      logger.info('Apps have been restored to the selected version');
      logger.info(`Rollback tag created: ${rollbackTagName}`);
      logger.blank();

      process.exit(0);
    } catch (error) {
      logger.error(`Rollback failed: ${error.message}`);
      logger.error('You may need to manually checkout your branch:');
      logger.error('  git checkout main  (or your working branch)');
      process.exit(1);
    }
  }
}

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Run rollback
const rollback = new ClientRollback();
rollback.run();
