/**
 * Security Setup Utilities
 *
 * Helper functions for the complete security setup script.
 * Includes banner printing, report generation, and script validation.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { CliLogger, colors } = require('./cli-logger');

function printBanner() {
  CliLogger.log('\n' + '='.repeat(46), colors.cyan + colors.bright);
  CliLogger.log('', colors.cyan + colors.bright);
  CliLogger.log('    COMPLETE SECURITY SETUP', colors.cyan + colors.bright);
  CliLogger.log('    Loyalty Hub Master Firebase', colors.cyan + colors.bright);
  CliLogger.log('', colors.cyan + colors.bright);
  CliLogger.log('='.repeat(46) + '\n', colors.cyan + colors.bright);
}

function printSeparator() {
  CliLogger.log('\n' + '='.repeat(50) + '\n', colors.bright);
}

function runScript(scriptPath, args = []) {
  return new Promise((resolve) => {
    CliLogger.log(`\nRunning: ${path.basename(scriptPath)}`, colors.cyan + colors.bright);
    CliLogger.log(`   Path: ${scriptPath}`, colors.cyan);
    if (args.length > 0) {
      CliLogger.log(`   Args: ${args.join(' ')}`, colors.cyan);
    }
    CliLogger.log('', colors.reset);

    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: path.dirname(scriptPath),
    });

    child.on('close', (code) => {
      if (code === 0) {
        CliLogger.success(`\n${path.basename(scriptPath)} completed successfully`);
        resolve(true);
      } else {
        CliLogger.error(`\n${path.basename(scriptPath)} failed with code ${code}`);
        resolve(false);
      }
    });

    child.on('error', (error) => {
      CliLogger.error(`\nFailed to execute ${path.basename(scriptPath)}`);
      CliLogger.error(`Error: ${error.message}`);
      resolve(false);
    });
  });
}

function validateScripts(scripts) {
  CliLogger.info('\nValidating required scripts...');

  let allValid = true;
  for (const script of scripts) {
    if (fs.existsSync(script.path)) {
      CliLogger.success(`   [OK] ${script.name}`);
    } else {
      CliLogger.error(`   [MISSING] ${script.name}`);
      CliLogger.warning(`      Expected at: ${script.path}`);
      allValid = false;
    }
  }

  if (!allValid) {
    CliLogger.error('\nRequired scripts are missing!');
    return false;
  }

  CliLogger.success('All required scripts found');
  return true;
}

function printConfiguration(config) {
  CliLogger.info('\nConfiguration:');
  CliLogger.warning(`   Create Master User: ${config.skipUser ? '[SKIPPED]' : '[YES]'}`);
  CliLogger.warning(`   Deploy Rules: ${config.skipRules ? '[SKIPPED]' : '[YES]'}`);
  CliLogger.warning(`   Custom Password: ${config.password ? '[YES]' : '[NO] (using default)'}`);
}

function generateFinalReport(results) {
  printSeparator();
  CliLogger.log('FINAL REPORT', colors.cyan + colors.bright);
  printSeparator();

  const allSuccessful = results.every((r) => r.success);

  CliLogger.info('\nExecution Summary:\n');

  results.forEach((result) => {
    const status = result.success ? 'SUCCESS' : 'FAILED';
    const logFn = result.success ? CliLogger.success.bind(CliLogger) : CliLogger.error.bind(CliLogger);

    logFn(`[${status}] ${result.name}`);
    if (result.duration) {
      CliLogger.info(`   Duration: ${result.duration}s`);
    }
  });

  printSeparator();

  if (allSuccessful) {
    CliLogger.log('ALL OPERATIONS COMPLETED SUCCESSFULLY!', colors.green + colors.bright);
    printSuccessNextSteps();
  } else {
    CliLogger.log('SOME OPERATIONS FAILED', colors.yellow + colors.bright);
    printFailureNextSteps();
  }

  printSeparator();
  return allSuccessful;
}

function printSuccessNextSteps() {
  CliLogger.info('\nNext Steps:\n');
  CliLogger.warning('1. Master user is ready');
  CliLogger.success('   - Email: devloyaltyhub@gmail.com');
  CliLogger.success('   - Check MASTER_USER_CREDENTIALS.txt for password\n');
  CliLogger.warning('2. Security rules are deployed');
  CliLogger.success('   - Verify in Firebase Console');
  CliLogger.success('   - https://console.firebase.google.com/project/loyalty-hub-1f47c/firestore/rules\n');
  CliLogger.warning('3. Test the complete flow:');
  CliLogger.success('   cd loyalty-admin-main && flutter run\n');
  CliLogger.warning('4. Security recommendations:');
  CliLogger.success('   - Change master password after first login');
  CliLogger.success('   - Delete MASTER_USER_CREDENTIALS.txt after saving password');
  CliLogger.success('   - Set up App Check for client Firebase projects\n');
}

function printFailureNextSteps() {
  CliLogger.info('\nReview the errors above and:');
  CliLogger.warning('   - Check Firebase CLI authentication');
  CliLogger.warning('   - Verify service account permissions');
  CliLogger.warning('   - Run failed steps individually for detailed errors\n');
}

function parseArguments(argv) {
  const args = argv.slice(2);

  return {
    skipUser: args.includes('--skip-user'),
    skipRules: args.includes('--skip-rules'),
    password: (() => {
      const passwordIndex = args.indexOf('--password');
      return passwordIndex !== -1 && args[passwordIndex + 1] ? args[passwordIndex + 1] : null;
    })(),
  };
}

module.exports = {
  printBanner,
  printSeparator,
  runScript,
  validateScripts,
  printConfiguration,
  generateFinalReport,
  parseArguments,
};
