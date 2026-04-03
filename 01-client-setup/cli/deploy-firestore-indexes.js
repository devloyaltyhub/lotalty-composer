#!/usr/bin/env node

/**
 * Deploy Firestore Indexes to a Client Firebase Project
 *
 * Deploys composite indexes required by the loyalty-app and loyalty-admin
 * to a client's Firebase project. These indexes must exist BEFORE the app
 * is used to avoid failed queries on first access.
 *
 * Required indexes (mapped from code):
 *   - CheckIns: (userId, createdAt) — check-in cooldown and daily check
 *   - CheckIns: (userId, tokenWindow) — duplicate check-in prevention
 *   - Consumptions: (userId, createdAt) — consumption history
 *   - Clients_Score: (userId, createdAt) — score history
 *   - Notifications: (userId, creationTime) — notification list
 *   - Users: (cpf, softDeleted) — CPF duplicate validation
 *   - Orders: (status, createdOn) — active/invoiced orders
 *   - Orders: (tripId, status) — trip delivery tracking
 *
 * Usage:
 *   node deploy-firestore-indexes.js <projectId>
 *   node deploy-firestore-indexes.js --all          (deploy to all clients)
 *   node deploy-firestore-indexes.js --dry-run <id> (validate only)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const INDEXES_TEMPLATE = path.join(__dirname, '../../shared/templates/firestore.indexes.json');

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
    if (options.ignoreError) return null;
    throw error;
  }
}

function checkFirebaseCli() {
  try {
    const version = execSync('firebase --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
    log(`  Firebase CLI: ${version}`, colors.green);
    return true;
  } catch {
    log('  Firebase CLI not found. Install with: npm install -g firebase-tools', colors.red);
    return false;
  }
}

function validateIndexesFile() {
  if (!fs.existsSync(INDEXES_TEMPLATE)) {
    log(`  Indexes file not found: ${INDEXES_TEMPLATE}`, colors.red);
    return false;
  }

  try {
    const content = JSON.parse(fs.readFileSync(INDEXES_TEMPLATE, 'utf8'));
    if (!content.indexes || !Array.isArray(content.indexes)) {
      log('  Invalid indexes file: missing "indexes" array', colors.red);
      return false;
    }
    log(`  Indexes file valid: ${content.indexes.length} composite indexes defined`, colors.green);
    return true;
  } catch (error) {
    log(`  Invalid JSON in indexes file: ${error.message}`, colors.red);
    return false;
  }
}

async function deployIndexes(projectId, dryRun = false) {
  log(`\n${'='.repeat(50)}`, colors.bright);
  log(`  Deploying Firestore indexes to: ${projectId}`, colors.cyan + colors.bright);
  log(`${'='.repeat(50)}\n`, colors.bright);

  // Pre-flight checks
  log('Pre-flight checks:', colors.bright);
  if (!checkFirebaseCli()) return false;
  if (!validateIndexesFile()) return false;

  // Create temporary firebase.json for deployment
  const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'firebase-indexes-'));
  const tempFirebaseJson = path.join(tempDir, 'firebase.json');
  const tempIndexesJson = path.join(tempDir, 'firestore.indexes.json');

  try {
    // Copy indexes file
    fs.copyFileSync(INDEXES_TEMPLATE, tempIndexesJson);

    // Create minimal firebase.json that references the indexes
    fs.writeFileSync(
      tempFirebaseJson,
      JSON.stringify(
        {
          firestore: {
            indexes: 'firestore.indexes.json',
          },
        },
        null,
        2
      )
    );

    if (dryRun) {
      log('\n  [DRY RUN] Would deploy the following indexes:', colors.yellow);
      const indexes = JSON.parse(fs.readFileSync(INDEXES_TEMPLATE, 'utf8'));
      indexes.indexes.forEach((idx, i) => {
        const fields = idx.fields.map((f) => `${f.fieldPath} ${f.order}`).join(', ');
        log(`    ${i + 1}. ${idx.collectionGroup}: (${fields})`, colors.cyan);
      });
      log('\n  [DRY RUN] No changes made.', colors.yellow);
      return true;
    }

    // Deploy indexes
    log('\n  Deploying indexes...', colors.cyan);
    exec(`firebase deploy --only firestore:indexes --project ${projectId}`, {
      cwd: tempDir,
    });

    log(`\n  Indexes deployed successfully to ${projectId}`, colors.green + colors.bright);
    log('  Note: Firestore indexes may take a few minutes to build.', colors.yellow);
    log('  Check status: https://console.firebase.google.com/project/' + projectId + '/firestore/indexes\n', colors.cyan);

    return true;
  } catch (error) {
    log(`\n  Failed to deploy indexes: ${error.message}`, colors.red);
    return false;
  } finally {
    // Cleanup temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const projectIds = args.filter((a) => !a.startsWith('--'));

  log('\n  Loyalty Hub — Firestore Indexes Deployment', colors.cyan + colors.bright);
  log('  ==========================================\n', colors.cyan);

  if (projectIds.length === 0) {
    log('  Usage: node deploy-firestore-indexes.js <projectId> [--dry-run]', colors.yellow);
    log('  Example: node deploy-firestore-indexes.js loyalty-hub-1f47c', colors.yellow);
    process.exit(1);
  }

  let allSuccess = true;
  for (const projectId of projectIds) {
    const success = await deployIndexes(projectId, dryRun);
    if (!success) allSuccess = false;
  }

  process.exit(allSuccess ? 0 : 1);
}

main().catch((error) => {
  log(`\n  Unexpected error: ${error.message}`, colors.red);
  process.exit(1);
});
