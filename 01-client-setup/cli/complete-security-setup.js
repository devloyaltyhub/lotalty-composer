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

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Constants
const SETUP_USER_SCRIPT = path.join(__dirname, 'setup-master-user.js');
const DEPLOY_RULES_SCRIPT = path.join(__dirname, 'deploy-master-rules.js');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function printBanner() {
  log('\n╔════════════════════════════════════════════╗', colors.cyan + colors.bright);
  log('║                                            ║', colors.cyan + colors.bright);
  log('║    🔐 COMPLETE SECURITY SETUP             ║', colors.cyan + colors.bright);
  log('║    Loyalty Hub Master Firebase            ║', colors.cyan + colors.bright);
  log('║                                            ║', colors.cyan + colors.bright);
  log('╚════════════════════════════════════════════╝\n', colors.cyan + colors.bright);
}

function printSeparator() {
  log('\n' + '='.repeat(50) + '\n', colors.bright);
}

async function runScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    log(`\n🚀 Running: ${path.basename(scriptPath)}`, colors.magenta);
    log(`   Path: ${scriptPath}`, colors.cyan);
    if (args.length > 0) {
      log(`   Args: ${args.join(' ')}`, colors.cyan);
    }
    log('', colors.reset);

    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: path.dirname(scriptPath),
    });

    child.on('close', (code) => {
      if (code === 0) {
        log(`\n✅ ${path.basename(scriptPath)} completed successfully`, colors.green);
        resolve(true);
      } else {
        log(`\n❌ ${path.basename(scriptPath)} failed with code ${code}`, colors.red);
        resolve(false);
      }
    });

    child.on('error', (error) => {
      log(`\n❌ Failed to execute ${path.basename(scriptPath)}`, colors.red);
      log(`Error: ${error.message}`, colors.red);
      resolve(false);
    });
  });
}

function validateScripts() {
  log('\n📋 Validating required scripts...', colors.cyan);

  const scripts = [
    { path: SETUP_USER_SCRIPT, name: 'setup-master-user.js' },
    { path: DEPLOY_RULES_SCRIPT, name: 'deploy-master-rules.js' },
  ];

  let allValid = true;
  for (const script of scripts) {
    if (fs.existsSync(script.path)) {
      log(`   ✅ ${script.name}`, colors.green);
    } else {
      log(`   ❌ Missing: ${script.name}`, colors.red);
      log(`      Expected at: ${script.path}`, colors.yellow);
      allValid = false;
    }
  }

  if (!allValid) {
    log('\n❌ Required scripts are missing!', colors.red);
    return false;
  }

  log('✅ All required scripts found', colors.green);
  return true;
}

function parseArguments() {
  const args = process.argv.slice(2);

  return {
    skipUser: args.includes('--skip-user'),
    skipRules: args.includes('--skip-rules'),
    password: (() => {
      const passwordIndex = args.indexOf('--password');
      return passwordIndex !== -1 && args[passwordIndex + 1] ? args[passwordIndex + 1] : null;
    })(),
  };
}

function printConfiguration(config) {
  log('\n⚙️  Configuration:', colors.cyan);
  log(`   Create Master User: ${config.skipUser ? '❌ SKIPPED' : '✅ YES'}`, colors.yellow);
  log(`   Deploy Rules: ${config.skipRules ? '❌ SKIPPED' : '✅ YES'}`, colors.yellow);
  if (config.password) {
    log(`   Custom Password: ✅ YES`, colors.yellow);
  } else {
    log(`   Custom Password: ❌ NO (using default)`, colors.yellow);
  }
}

async function generateFinalReport(results) {
  printSeparator();
  log('📊 FINAL REPORT', colors.cyan + colors.bright);
  printSeparator();

  const allSuccessful = results.every((r) => r.success);

  log('\n📋 Execution Summary:\n', colors.cyan);

  results.forEach((result) => {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? colors.green : colors.red;
    const status = result.success ? 'SUCCESS' : 'FAILED';

    log(`${icon} ${result.name}`, color);
    log(`   Status: ${status}`, color);
    if (result.duration) {
      log(`   Duration: ${result.duration}s`, colors.cyan);
    }
  });

  printSeparator();

  if (allSuccessful) {
    log('🎉 ALL OPERATIONS COMPLETED SUCCESSFULLY!', colors.green + colors.bright);
    log('\n📝 Next Steps:', colors.cyan);
    log('', colors.reset);
    log('1. ✅ Master user is ready', colors.yellow);
    log('   - Email: devloyaltyhub@gmail.com', colors.green);
    log('   - Check MASTER_USER_CREDENTIALS.txt for password', colors.green);
    log('', colors.reset);
    log('2. ✅ Security rules are deployed', colors.yellow);
    log('   - Verify in Firebase Console', colors.green);
    log(
      '   - https://console.firebase.google.com/project/loyalty-hub-1f47c/firestore/rules',
      colors.green
    );
    log('', colors.reset);
    log('3. 🧪 Test the complete flow:', colors.yellow);
    log('   cd loyalty-admin-main && flutter run', colors.green);
    log('', colors.reset);
    log('4. 🔒 Security recommendations:', colors.yellow);
    log('   - Change master password after first login', colors.green);
    log('   - Delete MASTER_USER_CREDENTIALS.txt after saving password', colors.green);
    log('   - Set up App Check for client Firebase projects', colors.green);
    log('', colors.reset);
  } else {
    log('⚠️  SOME OPERATIONS FAILED', colors.yellow + colors.bright);
    log('\n🔍 Review the errors above and:', colors.cyan);
    log('   - Check Firebase CLI authentication', colors.yellow);
    log('   - Verify service account permissions', colors.yellow);
    log('   - Run failed steps individually for detailed errors', colors.yellow);
    log('', colors.reset);
  }

  printSeparator();

  return allSuccessful;
}

async function main() {
  printBanner();

  const startTime = Date.now();
  const config = parseArguments();
  const results = [];

  try {
    // Validate scripts exist
    if (!validateScripts()) {
      process.exit(1);
    }

    // Print configuration
    printConfiguration(config);

    // Check if anything will be executed
    if (config.skipUser && config.skipRules) {
      log('\n⚠️  Both operations are skipped! Nothing to do.', colors.yellow);
      log('   Remove --skip-user or --skip-rules flags to run operations.', colors.yellow);
      process.exit(0);
    }

    printSeparator();

    // Step 1: Create master user
    if (!config.skipUser) {
      log('📍 STEP 1: Create Master User', colors.cyan + colors.bright);
      printSeparator();

      const userStartTime = Date.now();
      const userArgs = config.password ? ['--password', config.password] : [];
      const userSuccess = await runScript(SETUP_USER_SCRIPT, userArgs);
      const userDuration = ((Date.now() - userStartTime) / 1000).toFixed(2);

      results.push({
        name: 'Create Master User',
        success: userSuccess,
        duration: userDuration,
      });

      if (!userSuccess) {
        log('\n⚠️  Master user creation failed!', colors.yellow);
        log('   Continuing with rules deployment...', colors.yellow);
      }

      printSeparator();
    } else {
      log('⏭️  Skipping master user creation', colors.yellow);
      printSeparator();
    }

    // Step 2: Deploy security rules
    if (!config.skipRules) {
      log('📍 STEP 2: Deploy Security Rules', colors.cyan + colors.bright);
      printSeparator();

      const rulesStartTime = Date.now();
      const rulesSuccess = await runScript(DEPLOY_RULES_SCRIPT, ['--force']);
      const rulesDuration = ((Date.now() - rulesStartTime) / 1000).toFixed(2);

      results.push({
        name: 'Deploy Security Rules',
        success: rulesSuccess,
        duration: rulesDuration,
      });

      printSeparator();
    } else {
      log('⏭️  Skipping rules deployment', colors.yellow);
      printSeparator();
    }

    // Generate final report
    const allSuccessful = await generateFinalReport(results);

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`\n⏱️  Total execution time: ${totalDuration}s`, colors.cyan);

    process.exit(allSuccessful ? 0 : 1);
  } catch (error) {
    printSeparator();
    log('❌ CRITICAL ERROR', colors.red + colors.bright);
    printSeparator();
    log(`\nError: ${error.message}`, colors.red);

    if (error.stack) {
      log('\nStack trace:', colors.yellow);
      log(error.stack, colors.yellow);
    }

    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { runScript, validateScripts };
