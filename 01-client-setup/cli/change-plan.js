#!/usr/bin/env node

/**
 * Change Client Plan CLI
 * Upgrade or downgrade a client's subscription plan
 *
 * Usage:
 *   npm run change-plan
 *   node 01-client-setup/cli/change-plan.js
 */

require('dotenv').config();
const inquirer = require('inquirer');
const logger = require('../../shared/utils/logger');
const firebaseClient = require('../shared/firebase-manager');
const AppConfigSetup = require('../steps/setup-app-config');
const {
  PLANS,
  PLAN_TYPES,
  PLAN_DISPLAY_NAMES,
  getPlanById,
  getPlanFeatureFlags,
  getPlanLimits,
} = require('../../shared/constants/plans');

async function main() {
  logger.section('Change Client Plan');
  logger.info('Upgrade or downgrade a client subscription plan\n');

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

    const { selectedClient } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedClient',
        message: 'Select client to change plan:',
        choices: clientChoices,
        pageSize: 15,
      },
    ]);

    const currentPlan = selectedClient.planType || 'profissional';
    const currentPlanInfo = getPlanById(currentPlan);

    logger.blank();
    logger.subSection('Current Plan Information');
    logger.keyValue('Client', selectedClient.clientCode);
    logger.keyValue('Current Plan', PLAN_DISPLAY_NAMES[currentPlan] || currentPlan);

    if (currentPlanInfo) {
      logger.keyValue('Monthly Price', `R$${currentPlanInfo.pricing.monthly}`);
      logger.keyValue('Max Clients', currentPlanInfo.limits.maxClients === -1 ? 'Unlimited' : currentPlanInfo.limits.maxClients);
    }

    logger.blank();

    const planChoices = PLANS.filter((p) => p.id !== currentPlan).map((plan) => ({
      name: `${plan.name} - R$${plan.pricing.monthly}/mês (${plan.description})`,
      value: plan.id,
    }));

    if (planChoices.length === 0) {
      logger.warn('No other plans available');
      process.exit(0);
    }

    const { newPlanType, updateFeatureFlags, confirmed } = await inquirer.prompt([
      {
        type: 'list',
        name: 'newPlanType',
        message: 'Select new plan:',
        choices: planChoices,
      },
      {
        type: 'confirm',
        name: 'updateFeatureFlags',
        message: 'Update feature flags to match new plan defaults?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'confirmed',
        message: (answers) => {
          const isUpgrade = getPlanPriority(answers.newPlanType) > getPlanPriority(currentPlan);
          const action = isUpgrade ? 'UPGRADE' : 'DOWNGRADE';
          return `Confirm ${action} from ${PLAN_DISPLAY_NAMES[currentPlan]} to ${PLAN_DISPLAY_NAMES[answers.newPlanType]}?`;
        },
        default: false,
      },
    ]);

    if (!confirmed) {
      logger.warn('Plan change cancelled');
      process.exit(0);
    }

    logger.section('Updating Plan');

    logger.startSpinner('Updating Master Firebase...');
    await firebaseClient.updateClientPlan(selectedClient.clientCode, newPlanType, currentPlan);
    logger.succeedSpinner('Master Firebase updated');

    if (updateFeatureFlags) {
      logger.startSpinner('Updating App Config...');

      try {
        await firebaseClient.initializeClientFirebase(
          selectedClient.clientCode,
          selectedClient.firebase_options
        );

        const clientApp = firebaseClient.apps.get(selectedClient.clientCode);
        const appConfigSetup = new AppConfigSetup(clientApp);

        const newFeatureFlags = getPlanFeatureFlags(newPlanType);
        const newLimits = getPlanLimits(newPlanType);

        await appConfigSetup.updatePlanConfig({
          planType: newPlanType,
          featureFlags: newFeatureFlags,
          planLimits: newLimits,
        });

        logger.succeedSpinner('App Config updated');
      } catch (error) {
        logger.failSpinner(`Failed to update App Config: ${error.message}`);
        logger.warn('You may need to update App Config manually');
      }
    }

    logger.blank();
    logger.section('Plan Change Complete');
    logger.success(`${selectedClient.clientCode}: ${PLAN_DISPLAY_NAMES[currentPlan]} → ${PLAN_DISPLAY_NAMES[newPlanType]}`);

    const newPlanInfo = getPlanById(newPlanType);
    if (newPlanInfo) {
      logger.blank();
      logger.subSection('New Plan Details');
      logger.keyValue('Max Clients', newPlanInfo.limits.maxClients === -1 ? 'Unlimited' : newPlanInfo.limits.maxClients);
      logger.keyValue('Show Branding', newPlanInfo.limits.showBranding ? 'Yes' : 'No');
      logger.keyValue('Report Level', newPlanInfo.limits.reportLevel);
    }

  } catch (error) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    await firebaseClient.cleanup();
  }
}

function getPlanPriority(planType) {
  const priorities = {
    [PLAN_TYPES.ESSENCIAL]: 1,
    [PLAN_TYPES.PROFISSIONAL]: 2,
    [PLAN_TYPES.ILIMITADO]: 3,
  };
  return priorities[planType] || 0;
}

main();
