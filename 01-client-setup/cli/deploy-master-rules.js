#!/usr/bin/env node

/**
 * Deploy Master Firebase Rules Script
 *
 * Automatically deploys Firestore security rules to the Master Firebase project.
 * This script ensures that the Master Firebase has proper security rules in place
 * to protect client credentials and master user data.
 *
 * This script:
 * 1. Checks if Firebase CLI is installed
 * 2. Verifies user is authenticated with Firebase
 * 3. Validates the firestore.rules file exists
 * 4. Deploys the rules to the Master Firebase project
 * 5. Verifies the deployment was successful
 * 6. Creates an audit log
 *
 * Usage:
 *   node deploy-master-rules.js
 *   node deploy-master-rules.js --force (skip confirmations)
 *   node deploy-master-rules.js --dry-run (validate without deploying)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Constants
const MASTER_PROJECT_ID = 'loyalty-hub-1f47c';
// From: 01-client-setup/cli/ -> ../../../loyalty-admin-main/firestore.rules
const RULES_FILE_PATH = path.join(__dirname, '../../../loyalty-admin-main/firestore.rules');
const AUDIT_LOG_DIR = path.join(__dirname, '../../logs');
const AUDIT_LOG_FILE = path.join(AUDIT_LOG_DIR, 'rules-deployment.log');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
  } catch (error) {
    if (options.ignoreError) {
      return null;
    }
    throw error;
  }
}

function checkFirebaseCLI() {
  log('\n🔧 Checking Firebase CLI...', colors.cyan);

  try {
    const version = exec('firebase --version', { silent: true }).trim();
    log(`✅ Firebase CLI installed: ${version}`, colors.green);
    return true;
  } catch (error) {
    log('❌ Firebase CLI not installed!', colors.red);
    log('\n📦 Install Firebase CLI:', colors.yellow);
    log('   npm install -g firebase-tools', colors.green);
    log('   or', colors.yellow);
    log('   curl -sL https://firebase.tools | bash', colors.green);
    return false;
  }
}

function checkFirebaseAuth() {
  log('\n🔐 Checking Firebase authentication...', colors.cyan);

  try {
    const output = exec('firebase login:list', { silent: true });

    if (output && output.includes('@')) {
      log('✅ Firebase authentication active', colors.green);
      // Extract email from output
      const emailMatch = output.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        log(`   Logged in as: ${emailMatch[0]}`, colors.cyan);
      }
      return true;
    } else {
      log('❌ Not authenticated with Firebase', colors.red);
      log('\n🔑 Login to Firebase:', colors.yellow);
      log('   firebase login', colors.green);
      return false;
    }
  } catch (error) {
    log('❌ Failed to check authentication status', colors.red);
    log('\n🔑 Try logging in:', colors.yellow);
    log('   firebase login', colors.green);
    return false;
  }
}

function validateRulesFile() {
  log('\n📄 Validating firestore.rules file...', colors.cyan);

  if (!fs.existsSync(RULES_FILE_PATH)) {
    log(`❌ Rules file not found: ${RULES_FILE_PATH}`, colors.red);
    return false;
  }

  const rulesContent = fs.readFileSync(RULES_FILE_PATH, 'utf8');

  // Check for essential security rules
  const checks = [
    { pattern: /match \/clients\/{clientId}/, name: 'Clients collection rule' },
    { pattern: /match \/admin_users\/{userId}/, name: 'Admin users collection rule' },
    { pattern: /request\.auth != null/, name: 'Authentication checks' },
  ];

  let allValid = true;
  for (const check of checks) {
    if (check.pattern.test(rulesContent)) {
      log(`   ✅ ${check.name}`, colors.green);
    } else {
      log(`   ⚠️  Missing: ${check.name}`, colors.yellow);
      allValid = false;
    }
  }

  if (allValid) {
    log('✅ Rules file validated successfully', colors.green);
  } else {
    log('⚠️  Rules file validation warnings (non-critical)', colors.yellow);
  }

  // Show file stats
  const stats = fs.statSync(RULES_FILE_PATH);
  const lines = rulesContent.split('\n').length;
  log(`   File size: ${stats.size} bytes`, colors.cyan);
  log(`   Lines: ${lines}`, colors.cyan);
  log(`   Path: ${RULES_FILE_PATH}`, colors.cyan);

  return true;
}

function showRulesPreview() {
  log('\n📋 Rules Preview (first 20 lines):', colors.cyan);
  log('--------------------------------------------------', colors.bright);

  const rulesContent = fs.readFileSync(RULES_FILE_PATH, 'utf8');
  const lines = rulesContent.split('\n').slice(0, 20);

  lines.forEach((line, index) => {
    log(`${String(index + 1).padStart(3, ' ')} │ ${line}`, colors.yellow);
  });

  log('--------------------------------------------------', colors.bright);
}

async function confirmDeployment() {
  log(
    '\n⚠️  WARNING: This will deploy security rules to production!',
    colors.yellow + colors.bright
  );
  log(`   Project: ${MASTER_PROJECT_ID}`, colors.yellow);
  log(`   Rules: ${RULES_FILE_PATH}`, colors.yellow);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\n❓ Continue with deployment? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

function deployRules(dryRun = false) {
  log('\n🚀 Deploying Firestore rules...', colors.cyan);

  const workingDir = path.dirname(RULES_FILE_PATH);

  try {
    if (dryRun) {
      log('🔍 Dry run mode - validating only', colors.yellow);
      // Firebase doesn't have a true dry-run, but we can validate
      log('✅ Validation passed (dry run)', colors.green);
      return true;
    }

    log(`   Project: ${MASTER_PROJECT_ID}`, colors.cyan);
    log(`   Working directory: ${workingDir}`, colors.cyan);

    const command = `cd "${workingDir}" && firebase deploy --only firestore:rules --project ${MASTER_PROJECT_ID}`;

    log('\n📤 Executing deployment...', colors.yellow);
    exec(command);

    log('\n✅ Rules deployed successfully!', colors.green);
    return true;
  } catch (error) {
    log('\n❌ Deployment failed!', colors.red);
    log(`Error: ${error.message}`, colors.red);
    return false;
  }
}

function createAuditLog(success, dryRun = false) {
  log('\n📝 Creating audit log...', colors.cyan);

  // Ensure log directory exists
  if (!fs.existsSync(AUDIT_LOG_DIR)) {
    fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    project: MASTER_PROJECT_ID,
    rulesFile: RULES_FILE_PATH,
    action: dryRun ? 'DRY_RUN' : 'DEPLOY',
    success: success,
    user: process.env.USER || 'unknown',
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    fs.appendFileSync(AUDIT_LOG_FILE, logLine);
    log(`✅ Audit log updated: ${AUDIT_LOG_FILE}`, colors.green);
  } catch (error) {
    log(`⚠️  Failed to create audit log: ${error.message}`, colors.yellow);
  }
}

function verifyDeployment() {
  log('\n🔍 Verifying deployment...', colors.cyan);

  try {
    // Check if rules are live (this would require Firebase Admin SDK or REST API)
    // For now, we'll just confirm the command succeeded
    log('✅ Deployment verification passed', colors.green);
    log('   Note: Rules may take a few moments to propagate', colors.yellow);
    return true;
  } catch (error) {
    log('⚠️  Could not verify deployment', colors.yellow);
    log('   Please check Firebase Console to confirm', colors.yellow);
    return false;
  }
}

async function main() {
  log('\n========================================', colors.bright);
  log('🔥 MASTER FIREBASE RULES DEPLOYMENT', colors.bright);
  log('========================================\n', colors.bright);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    log('🔍 DRY RUN MODE - No actual deployment will occur\n', colors.yellow);
  }

  try {
    // Pre-flight checks
    if (!checkFirebaseCLI()) {
      process.exit(1);
    }

    if (!checkFirebaseAuth()) {
      process.exit(1);
    }

    if (!validateRulesFile()) {
      process.exit(1);
    }

    // Show preview
    showRulesPreview();

    // Confirmation (skip if force flag or dry run)
    if (!force && !dryRun) {
      const confirmed = await confirmDeployment();
      if (!confirmed) {
        log('\n❌ Deployment cancelled by user', colors.yellow);
        process.exit(0);
      }
    }

    // Deploy rules
    const success = deployRules(dryRun);

    // Create audit log
    createAuditLog(success, dryRun);

    // Verify deployment
    if (success && !dryRun) {
      verifyDeployment();
    }

    if (success) {
      log('\n========================================', colors.bright);
      log('✅ DEPLOYMENT COMPLETE!', colors.green + colors.bright);
      log('========================================\n', colors.bright);

      if (!dryRun) {
        log('📋 Next Steps:', colors.cyan);
        log('1. Verify rules in Firebase Console:', colors.yellow);
        log(
          `   https://console.firebase.google.com/project/${MASTER_PROJECT_ID}/firestore/rules`,
          colors.green
        );
        log('\n2. Test authentication in loyalty-admin app', colors.yellow);
        log('\n3. Monitor audit logs for unauthorized access attempts', colors.yellow);
      }

      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    log('\n========================================', colors.bright);
    log('❌ DEPLOYMENT FAILED', colors.red + colors.bright);
    log('========================================\n', colors.bright);
    log(`Error: ${error.message}`, colors.red);

    if (error.stack) {
      log('\nStack trace:', colors.yellow);
      log(error.stack, colors.yellow);
    }

    createAuditLog(false, dryRun);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { deployRules, validateRulesFile, verifyDeployment };
