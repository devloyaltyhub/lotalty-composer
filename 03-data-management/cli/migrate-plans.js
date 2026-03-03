#!/usr/bin/env node

/**
 * Migrate Plans CLI
 * Sets planType to 'profissional' for all existing clients without a plan
 *
 * Usage:
 *   npm run migrate-plans
 *   npm run migrate-plans -- --yes
 *   node 03-data-management/cli/migrate-plans.js --yes
 */

require('dotenv').config();
const inquirer = require('inquirer');

const args = process.argv.slice(2);
const autoConfirm = args.includes('--yes') || args.includes('-y');
const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');
const firebaseClient = require('../../01-client-setup/shared/firebase-manager');
const AppConfigSetup = require('../../01-client-setup/steps/setup-app-config');
const {
  PLAN_TYPES,
  PLAN_DISPLAY_NAMES,
  getPlanFeatureFlags,
  getPlanLimits,
} = require('../../shared/constants/plans');

const DEFAULT_PLAN = PLAN_TYPES.PROFISSIONAL;

async function main() {
  logger.section('Plan Migration Tool');
  logger.info('Migrate existing clients to the plan system\n');
  logger.info(`Default plan for migration: ${PLAN_DISPLAY_NAMES[DEFAULT_PLAN]}\n`);

  try {
    firebaseClient.initializeMasterFirebase();

    logger.startSpinner('Loading all clients...');
    const allClients = await firebaseClient.getAllClients(false);
    logger.succeedSpinner(`Found ${allClients.length} total clients`);

    const clientsWithoutPlan = allClients.filter(
      (client) => !client.planType && client.isActive !== false
    );
    const clientsWithPlan = allClients.filter((client) => client.planType);

    logger.blank();
    logger.subSection('Migration Analysis');
    logger.keyValue('Total clients', allClients.length);
    logger.keyValue('Clients with plan', clientsWithPlan.length);
    logger.keyValue('Clients needing migration', clientsWithoutPlan.length);

    if (clientsWithPlan.length > 0) {
      logger.blank();
      logger.info('Clients already with plans:');
      clientsWithPlan.forEach((client) => {
        logger.info(`  - ${client.clientCode}: ${PLAN_DISPLAY_NAMES[client.planType] || client.planType}`);
      });
    }

    if (clientsWithoutPlan.length === 0) {
      logger.blank();
      logger.success('All clients already have a planType assigned!');
      generateReport(allClients, [], []);
      process.exit(0);
    }

    logger.blank();
    logger.info('Clients to be migrated:');
    clientsWithoutPlan.forEach((client) => {
      logger.info(`  - ${client.clientCode} → ${PLAN_DISPLAY_NAMES[DEFAULT_PLAN]}`);
    });

    logger.blank();

    let updateAppConfig = true;
    let confirmed = false;

    if (autoConfirm) {
      logger.info('Auto-confirm mode enabled (--yes flag)');
      confirmed = true;
    } else {
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'updateAppConfig',
          message: 'Also update App Config for each client?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'confirmed',
          message: `Migrate ${clientsWithoutPlan.length} clients to ${PLAN_DISPLAY_NAMES[DEFAULT_PLAN]}?`,
          default: false,
        },
      ]);
      updateAppConfig = answers.updateAppConfig;
      confirmed = answers.confirmed;
    }

    if (!confirmed) {
      logger.warn('Migration cancelled');
      process.exit(0);
    }

    logger.section('Starting Migration');

    const successfulMigrations = [];
    const failedMigrations = [];

    for (const client of clientsWithoutPlan) {
      logger.startSpinner(`Migrating ${client.clientCode}...`);

      try {
        await firebaseClient.updateClientPlan(client.clientCode, DEFAULT_PLAN, null);

        if (updateAppConfig && client.firebase_options) {
          try {
            await firebaseClient.initializeClientFirebase(
              client.clientCode,
              client.firebase_options
            );

            const clientApp = firebaseClient.apps.get(client.clientCode);
            const appConfigSetup = new AppConfigSetup(clientApp);

            const featureFlags = getPlanFeatureFlags(DEFAULT_PLAN);
            const limits = getPlanLimits(DEFAULT_PLAN);

            await appConfigSetup.updatePlanConfig({
              planType: DEFAULT_PLAN,
              featureFlags: featureFlags,
              planLimits: limits,
            });
          } catch (rcError) {
            logger.warn(`  App Config update failed: ${rcError.message}`);
          }
        }

        logger.succeedSpinner(`${client.clientCode} migrated to ${PLAN_DISPLAY_NAMES[DEFAULT_PLAN]}`);
        successfulMigrations.push(client.clientCode);

      } catch (error) {
        logger.failSpinner(`${client.clientCode} failed: ${error.message}`);
        failedMigrations.push({ clientCode: client.clientCode, error: error.message });
      }
    }

    logger.blank();
    logger.section('Migration Complete');
    logger.success(`Successfully migrated: ${successfulMigrations.length} clients`);

    if (failedMigrations.length > 0) {
      logger.error(`Failed migrations: ${failedMigrations.length} clients`);
      failedMigrations.forEach((f) => {
        logger.info(`  - ${f.clientCode}: ${f.error}`);
      });
    }

    generateReport(allClients, successfulMigrations, failedMigrations);

  } catch (error) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    await firebaseClient.cleanup();
  }
}

function generateReport(allClients, successfulMigrations, failedMigrations) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.join(__dirname, '../../logs');
  const reportPath = path.join(reportDir, `plan-migration-${timestamp}.json`);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    defaultPlan: DEFAULT_PLAN,
    summary: {
      totalClients: allClients.length,
      successfulMigrations: successfulMigrations.length,
      failedMigrations: failedMigrations.length,
    },
    clients: allClients.map((client) => ({
      clientCode: client.clientCode,
      planType: client.planType || DEFAULT_PLAN,
      wasActive: client.isActive !== false,
      migrated: successfulMigrations.includes(client.clientCode),
    })),
    failures: failedMigrations,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  logger.blank();
  logger.info(`Report saved to: ${reportPath}`);
}

main();
