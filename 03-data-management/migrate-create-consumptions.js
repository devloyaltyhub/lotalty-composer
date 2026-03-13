#!/usr/bin/env node

/**
 * Migration: Replace createConsumptions with useClubCoins
 *
 * This script updates all Users_Admin documents across client Firebase projects,
 * replacing the removed `createConsumptions` permission with `useClubCoins`.
 *
 * Usage: node migrate-create-consumptions.js
 */

const path = require('path');
const admin = require('firebase-admin');

// Load env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PROJECTS = [
  { name: 'demo', projectId: 'loyalty-hub-1f47c' },
  { name: 'na-rede', projectId: 'na-rede-loyalty-hub-club-4948' },
];

function getServiceAccountPath() {
  let credPath =
    process.env.MASTER_FIREBASE_SERVICE_ACCOUNT ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credPath) {
    throw new Error('No service account configured in .env');
  }

  // Expand $HOME and similar env vars
  credPath = credPath.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, varName) => {
    return process.env[varName] || _;
  });

  return credPath;
}

async function migrateProject(projectId, projectName, serviceAccount) {
  console.log(`\n--- ${projectName} (${projectId}) ---`);

  const appName = `migration-${projectName}`;
  let app;

  try {
    app = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId,
      },
      appName,
    );
  } catch (e) {
    if (e.code === 'app/duplicate-app') {
      app = admin.app(appName);
    } else {
      throw e;
    }
  }

  const firestore = admin.firestore(app);
  const snapshot = await firestore.collection('Users_Admin').get();

  console.log(`Found ${snapshot.size} admin user(s)`);

  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const permissions = data.permissions || [];

    const hasCreate = permissions.includes('createConsumptions');
    const hasUseClubCoins = permissions.includes('useClubCoins');

    if (!hasCreate && hasUseClubCoins) {
      console.log(`  [OK] ${data.email} - already has useClubCoins`);
      continue;
    }

    if (!hasCreate && !hasUseClubCoins) {
      // Add useClubCoins for all admin users (they should be able to redeem)
      const newPermissions = [...permissions, 'useClubCoins'];
      await doc.ref.update({ permissions: newPermissions });
      console.log(`  [ADD] ${data.email} - added useClubCoins`);
      updated++;
      continue;
    }

    // Has createConsumptions - replace with useClubCoins
    const newPermissions = permissions
      .filter((p) => p !== 'createConsumptions')
      .concat(hasUseClubCoins ? [] : ['useClubCoins']);

    await doc.ref.update({ permissions: newPermissions });
    console.log(
      `  [MIGRATED] ${data.email} - replaced createConsumptions with useClubCoins`,
    );
    updated++;
  }

  console.log(`Updated ${updated}/${snapshot.size} user(s)`);

  await app.delete();
}

async function main() {
  console.log('=== Migration: createConsumptions → useClubCoins ===\n');

  const serviceAccount = require(getServiceAccountPath());

  for (const project of PROJECTS) {
    try {
      await migrateProject(project.projectId, project.name, serviceAccount);
    } catch (error) {
      console.error(`ERROR on ${project.name}: ${error.message}`);
    }
  }

  console.log('\n=== Migration complete ===');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
