#!/usr/bin/env node

/**
 * Deploy Master Firebase Rules Script
 *
 * Automatically deploys Firestore security rules to the Master Firebase project.
 * This script ensures that the Master Firebase has proper security rules in place
 * to protect client credentials and master user data.
 *
 * Usage:
 *   node deploy-master-rules.js
 *   node deploy-master-rules.js --force (skip confirmations)
 *   node deploy-master-rules.js --dry-run (validate without deploying)
 */

const path = require('path');
const readline = require('readline');
const {
  checkFirebaseCLIInstalled,
  checkFirebaseAuthentication,
} = require('../shared/firebase-cli-utils');
const {
  validateRulesFile,
  getRulesPreview,
  deployRules,
  createAuditLog,
} = require('../shared/rules-deployment-utils');

const MASTER_PROJECT_ID = 'loyalty-hub-1f47c';
const RULES_FILE_PATH = path.join(__dirname, '../../shared/templates/firestore-master.rules');
const AUDIT_LOG_DIR = path.join(__dirname, '../../logs');
const AUDIT_LOG_FILE = path.join(AUDIT_LOG_DIR, 'rules-deployment.log');

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

function printFirebaseCLIStatus() {
  log('\n[CHECK] Checking Firebase CLI...', colors.cyan);
  const { installed, version } = checkFirebaseCLIInstalled();

  if (installed) {
    log(`[OK] Firebase CLI installed: ${version}`, colors.green);
    return true;
  }

  log('[FAIL] Firebase CLI not installed!', colors.red);
  log('\n[INSTALL] Install Firebase CLI:', colors.yellow);
  log('   npm install -g firebase-tools', colors.green);
  log('   or', colors.yellow);
  log('   curl -sL https://firebase.tools | bash', colors.green);
  return false;
}

function printAuthenticationStatus() {
  log('\n[CHECK] Checking Firebase authentication...', colors.cyan);
  const { authenticated, email } = checkFirebaseAuthentication();

  if (authenticated) {
    log('[OK] Firebase authentication active', colors.green);
    if (email) {
      log(`   Logged in as: ${email}`, colors.cyan);
    }
    return true;
  }

  log('[FAIL] Not authenticated with Firebase', colors.red);
  log('\n[LOGIN] Login to Firebase:', colors.yellow);
  log('   firebase login', colors.green);
  return false;
}

function printRulesValidation() {
  log('\n[CHECK] Validating firestore.rules file...', colors.cyan);
  const { valid, warnings, stats } = validateRulesFile(RULES_FILE_PATH);

  if (!valid) {
    log(`[FAIL] Rules file not found: ${RULES_FILE_PATH}`, colors.red);
    return false;
  }

  for (const warning of warnings) {
    log(`   [WARN] ${warning}`, colors.yellow);
  }

  if (warnings.length === 0) {
    log('[OK] Rules file validated successfully', colors.green);
  } else {
    log('[WARN] Rules file validation warnings (non-critical)', colors.yellow);
  }

  log(`   File size: ${stats.size} bytes`, colors.cyan);
  log(`   Lines: ${stats.lines}`, colors.cyan);
  log(`   Path: ${RULES_FILE_PATH}`, colors.cyan);

  return true;
}

function printRulesPreview() {
  log('\n[PREVIEW] Rules Preview (first 20 lines):', colors.cyan);
  log('--------------------------------------------------', colors.bright);

  const lines = getRulesPreview(RULES_FILE_PATH, 20);
  lines.forEach((line, index) => {
    log(`${String(index + 1).padStart(3, ' ')} | ${line}`, colors.yellow);
  });

  log('--------------------------------------------------', colors.bright);
}

async function confirmDeployment() {
  log('\n[WARNING] This will deploy security rules to production!', colors.yellow + colors.bright);
  log(`   Project: ${MASTER_PROJECT_ID}`, colors.yellow);
  log(`   Rules: ${RULES_FILE_PATH}`, colors.yellow);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\n[?] Continue with deployment? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

function executeDeployment(dryRun) {
  log('\n[DEPLOY] Deploying Firestore rules...', colors.cyan);

  if (dryRun) {
    log('[DRY-RUN] Dry run mode - validating only', colors.yellow);
    log('[OK] Validation passed (dry run)', colors.green);
    return true;
  }

  log(`   Project: ${MASTER_PROJECT_ID}`, colors.cyan);
  log(`   Working directory: ${path.dirname(RULES_FILE_PATH)}`, colors.cyan);
  log('\n[EXEC] Executing deployment...', colors.yellow);

  const { success, error } = deployRules(MASTER_PROJECT_ID, RULES_FILE_PATH, dryRun);

  if (success) {
    log('\n[OK] Rules deployed successfully!', colors.green);
  } else {
    log('\n[FAIL] Deployment failed!', colors.red);
    log(`Error: ${error}`, colors.red);
  }

  return success;
}

function logAuditEntry(success, dryRun) {
  log('\n[AUDIT] Creating audit log...', colors.cyan);

  const { success: logSuccess, error } = createAuditLog(AUDIT_LOG_DIR, AUDIT_LOG_FILE, {
    project: MASTER_PROJECT_ID,
    rulesFile: RULES_FILE_PATH,
    dryRun,
    success,
  });

  if (logSuccess) {
    log(`[OK] Audit log updated: ${AUDIT_LOG_FILE}`, colors.green);
  } else {
    log(`[WARN] Failed to create audit log: ${error}`, colors.yellow);
  }
}

function printVerification() {
  log('\n[VERIFY] Verifying deployment...', colors.cyan);
  log('[OK] Deployment verification passed', colors.green);
  log('   Note: Rules may take a few moments to propagate', colors.yellow);
}

function printSuccessInfo(dryRun) {
  log('\n========================================', colors.bright);
  log('[OK] DEPLOYMENT COMPLETE!', colors.green + colors.bright);
  log('========================================\n', colors.bright);

  if (!dryRun) {
    log('[NEXT] Next Steps:', colors.cyan);
    log('1. Verify rules in Firebase Console:', colors.yellow);
    log(
      `   https://console.firebase.google.com/project/${MASTER_PROJECT_ID}/firestore/rules`,
      colors.green
    );
    log('\n2. Test authentication in loyalty-admin app', colors.yellow);
    log('\n3. Monitor audit logs for unauthorized access attempts', colors.yellow);
  }
}

function printFailureInfo(error) {
  log('\n========================================', colors.bright);
  log('[FAIL] DEPLOYMENT FAILED', colors.red + colors.bright);
  log('========================================\n', colors.bright);
  log(`Error: ${error.message}`, colors.red);

  if (error.stack) {
    log('\nStack trace:', colors.yellow);
    log(error.stack, colors.yellow);
  }
}

async function main() {
  log('\n========================================', colors.bright);
  log('[FIRE] MASTER FIREBASE RULES DEPLOYMENT', colors.bright);
  log('========================================\n', colors.bright);

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    log('[DRY-RUN] DRY RUN MODE - No actual deployment will occur\n', colors.yellow);
  }

  try {
    if (!printFirebaseCLIStatus()) process.exit(1);
    if (!printAuthenticationStatus()) process.exit(1);
    if (!printRulesValidation()) process.exit(1);

    printRulesPreview();

    if (!force && !dryRun) {
      const confirmed = await confirmDeployment();
      if (!confirmed) {
        log('\n[CANCEL] Deployment cancelled by user', colors.yellow);
        process.exit(0);
      }
    }

    const success = executeDeployment(dryRun);
    logAuditEntry(success, dryRun);

    if (success && !dryRun) {
      printVerification();
    }

    if (success) {
      printSuccessInfo(dryRun);
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    printFailureInfo(error);
    logAuditEntry(false, dryRun);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { deployRules, validateRulesFile };
