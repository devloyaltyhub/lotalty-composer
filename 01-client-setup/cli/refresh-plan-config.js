#!/usr/bin/env node

/**
 * Refresh Plan Config CLI
 * Updates App Config with current plan feature flags
 * Useful when new feature flags are added to the system
 *
 * Usage:
 *   npm run refresh-plan-config
 *   node 01-client-setup/cli/refresh-plan-config.js
 */

require('dotenv').config();
const inquirer = require('inquirer');
const logger = require('../../shared/utils/logger');
const firebaseClient = require('../shared/firebase-manager');
const AppConfigSetup = require('../steps/setup-app-config');
const {
  PLAN_DISPLAY_NAMES,
  getPlanFeatureFlags,
  getPlanLimits,
} = require('../../shared/constants/plans');

async function main() {
  logger.section('Refresh Plan Config');
  logger.info('Update App Config with current plan feature flags\n');

  try {
    firebaseClient.initializeMasterFirebase();

    logger.startSpinner('Loading clients...');
    const clients = await firebaseClient.getAllClients(true);
    logger.succeedSpinner(`Found ${clients.length} active clients`);

    if (clients.length === 0) {
      logger.warn('No active clients found');
      process.exit(0);
    }

    const clientChoices = clients.map((client) => ({
      name: `${client.clientCode} - ${PLAN_DISPLAY_NAMES[client.planType] || client.planType || 'No plan'}`,
      value: client,
    }));

    const { selectedClients } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedClients',
        message: 'Select clients to refresh (space to select, enter to confirm):',
        choices: clientChoices,
        pageSize: 15,
        validate: (answer) => {
          if (answer.length === 0) {
            return 'Select at least one client';
          }
          return true;
        },
      },
    ]);

    logger.blank();
    logger.info(`Selected ${selectedClients.length} client(s) to refresh:`);
    selectedClients.forEach((client) => {
      logger.info(`  - ${client.clientCode} (${PLAN_DISPLAY_NAMES[client.planType] || 'profissional'})`);
    });

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Refresh App Config for ${selectedClients.length} client(s)?`,
        default: false,
      },
    ]);

    if (!confirmed) {
      logger.warn('Refresh cancelled');
      process.exit(0);
    }

    logger.section('Refreshing Configs');

    const results = { success: [], failed: [] };

    for (const client of selectedClients) {
      const planType = client.planType || 'profissional';
      logger.startSpinner(`Refreshing ${client.clientCode}...`);

      try {
        await firebaseClient.initializeClientFirebase(
          client.clientCode,
          client.firebase_options
        );

        const clientApp = firebaseClient.apps.get(client.clientCode);
        const appConfigSetup = new AppConfigSetup(clientApp);

        const featureFlags = getPlanFeatureFlags(planType);
        const limits = getPlanLimits(planType);

        await appConfigSetup.updatePlanConfig({
          planType: planType,
          featureFlags: featureFlags,
          planLimits: limits,
        });

        logger.succeedSpinner(`${client.clientCode} refreshed with ${PLAN_DISPLAY_NAMES[planType]} features`);
        results.success.push(client.clientCode);
      } catch (error) {
        logger.failSpinner(`${client.clientCode} failed: ${error.message}`);
        results.failed.push({ clientCode: client.clientCode, error: error.message });
      }
    }

    logger.blank();
    logger.section('Refresh Complete');
    logger.success(`Successfully refreshed: ${results.success.length} client(s)`);

    if (results.failed.length > 0) {
      logger.error(`Failed: ${results.failed.length} client(s)`);
      results.failed.forEach((f) => {
        logger.info(`  - ${f.clientCode}: ${f.error}`);
      });
    }

  } catch (error) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    await firebaseClient.cleanup();
  }
}

main();
