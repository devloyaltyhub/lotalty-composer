#!/usr/bin/env node

/**
 * Complete Security Setup Script
 *
 * Orchestrates the complete security setup for the Loyalty Hub Master Firebase.
 * This script combines multiple operations into a single automated workflow:
 *
 * 1. Creates the master user in Firebase Authentication
 * 2. Creates the master user document in Firestore
 * 3. Deploys Master Firebase security rules
 * 4. Verifies the complete setup
 * 5. Generates a comprehensive report
 *
 * This is a convenience script that runs both setup-master-user.js and
 * deploy-master-rules.js in the correct sequence.
 *
 * Usage:
 *   node complete-security-setup.js
 *   node complete-security-setup.js --password "CustomPassword123!"
 *   node complete-security-setup.js --skip-user (only deploy rules)
 *   node complete-security-setup.js --skip-rules (only create user)
 */

const path = require('path');
const { CliLogger, colors } = require('../shared/cli-logger');
const {
  printBanner,
  printSeparator,
  runScript,
  validateScripts,
  printConfiguration,
  generateFinalReport,
  parseArguments,
} = require('../shared/security-setup-utils');

const SETUP_USER_SCRIPT = path.join(__dirname, 'setup-master-user.js');
const DEPLOY_RULES_SCRIPT = path.join(__dirname, 'deploy-master-rules.js');

async function executeStep(stepName, scriptPath, args, results) {
  CliLogger.log(`STEP: ${stepName}`, colors.cyan + colors.bright);
  printSeparator();

  const startTime = Date.now();
  const success = await runScript(scriptPath, args);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  results.push({ name: stepName, success, duration });

  if (!success) {
    CliLogger.warning(`\n${stepName} failed!`);
    CliLogger.warning('   Continuing with next step...');
  }

  printSeparator();
  return success;
}

async function main() {
  printBanner();

  const startTime = Date.now();
  const config = parseArguments(process.argv);
  const results = [];

  try {
    const scripts = [
      { path: SETUP_USER_SCRIPT, name: 'setup-master-user.js' },
      { path: DEPLOY_RULES_SCRIPT, name: 'deploy-master-rules.js' },
    ];

    if (!validateScripts(scripts)) {
      process.exit(1);
    }

    printConfiguration(config);

    if (config.skipUser && config.skipRules) {
      CliLogger.warning('\nBoth operations are skipped! Nothing to do.');
      CliLogger.warning('   Remove --skip-user or --skip-rules flags to run operations.');
      process.exit(0);
    }

    printSeparator();

    if (!config.skipUser) {
      const userArgs = config.password ? ['--password', config.password] : [];
      await executeStep('Create Master User', SETUP_USER_SCRIPT, userArgs, results);
    } else {
      CliLogger.warning('Skipping master user creation');
      printSeparator();
    }

    if (!config.skipRules) {
      await executeStep('Deploy Security Rules', DEPLOY_RULES_SCRIPT, ['--force'], results);
    } else {
      CliLogger.warning('Skipping rules deployment');
      printSeparator();
    }

    const allSuccessful = generateFinalReport(results);

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    CliLogger.info(`\nTotal execution time: ${totalDuration}s`);

    process.exit(allSuccessful ? 0 : 1);
  } catch (error) {
    printSeparator();
    CliLogger.log('CRITICAL ERROR', colors.red + colors.bright);
    printSeparator();
    CliLogger.error(`\nError: ${error.message}`);

    if (error.stack) {
      CliLogger.warning('\nStack trace:');
      CliLogger.warning(error.stack);
    }

    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runScript, validateScripts };
