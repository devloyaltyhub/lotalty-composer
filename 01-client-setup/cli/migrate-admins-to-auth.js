#!/usr/bin/env node

/**
 * Migration Script: Migrate existing admins to Firebase Auth
 *
 * This script migrates existing admin users from Firestore-only authentication
 * to Firebase Auth + Firestore. It creates Firebase Auth users and updates
 * the Firestore documents with the new uid.
 *
 * Usage:
 *   node migrate-admins-to-auth.js <projectId>
 *
 * Example:
 *   node migrate-admins-to-auth.js demo-loyaltyhub
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { CLIENTS_DIR, WHITE_LABEL_APP_ROOT } = require('../../shared/utils/paths');

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function findServiceAccount(projectId) {
  // Search in clients directory for service-account.json files
  if (fs.existsSync(CLIENTS_DIR)) {
    const clientDirs = fs.readdirSync(CLIENTS_DIR);
    for (const clientDir of clientDirs) {
      const saPath = path.join(CLIENTS_DIR, clientDir, 'service-account.json');
      if (fs.existsSync(saPath)) {
        const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
        if (sa.project_id === projectId) {
          return sa;
        }
      }
    }
  }

  // Also check white_label_app
  const wlPath = path.join(WHITE_LABEL_APP_ROOT, 'service-account.json');
  if (fs.existsSync(wlPath)) {
    const sa = JSON.parse(fs.readFileSync(wlPath, 'utf8'));
    if (sa.project_id === projectId) {
      return sa;
    }
  }

  return null;
}

async function initializeFirebase(projectId) {
  const serviceAccount = findServiceAccount(projectId);

  if (!serviceAccount) {
    throw new Error(`Service account not found for project: ${projectId}`);
  }

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: projectId,
  }, projectId);

  return {
    app,
    auth: admin.auth(app),
    firestore: admin.firestore(app),
  };
}

async function promptConfirmation(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

async function migrateAdmins(projectId, autoConfirm = false) {
  console.log('\n🔐 Firebase Admin Migration Script');
  console.log('================================\n');
  console.log(`Project: ${projectId}\n`);

  const { auth, firestore } = await initializeFirebase(projectId);

  // Get all admin users
  const adminsSnapshot = await firestore.collection('Users_Admin').get();

  if (adminsSnapshot.empty) {
    console.log('❌ No admin users found in Users_Admin collection.');
    return;
  }

  console.log(`📋 Found ${adminsSnapshot.size} admin user(s):\n`);

  const adminsToMigrate = [];
  const alreadyMigrated = [];

  for (const doc of adminsSnapshot.docs) {
    const data = doc.data();
    const email = data.email;
    const docId = doc.id;

    // Check if user already exists in Firebase Auth
    try {
      const existingUser = await auth.getUserByEmail(email);

      if (existingUser.uid === docId) {
        console.log(`  ✅ ${email} - Already migrated (uid matches)`);
        alreadyMigrated.push({ email, uid: existingUser.uid });
      } else {
        console.log(`  ⚠️  ${email} - Exists in Auth but uid mismatch (Auth: ${existingUser.uid}, Doc: ${docId})`);
        adminsToMigrate.push({ doc, data, existingAuthUser: existingUser });
      }
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log(`  🔄 ${email} - Needs migration (not in Firebase Auth)`);
        adminsToMigrate.push({ doc, data, existingAuthUser: null });
      } else {
        console.log(`  ❌ ${email} - Error checking: ${error.message}`);
      }
    }
  }

  console.log('\n================================');
  console.log(`Already migrated: ${alreadyMigrated.length}`);
  console.log(`Needs migration: ${adminsToMigrate.length}`);
  console.log('================================\n');

  if (adminsToMigrate.length === 0) {
    console.log('✅ All admins are already migrated!');
    return;
  }

  const confirmed = autoConfirm || await promptConfirmation(
    `Do you want to migrate ${adminsToMigrate.length} admin(s)?`
  );

  if (!confirmed) {
    console.log('❌ Migration cancelled.');
    return;
  }

  console.log('\n🚀 Starting migration...\n');

  const results = {
    success: [],
    failed: [],
  };

  for (const { doc, data, existingAuthUser } of adminsToMigrate) {
    const email = data.email;
    const name = data.name || 'Administrador';
    const oldDocId = doc.id;

    try {
      let newUid;
      let tempPassword = null;

      if (existingAuthUser) {
        // User exists in Auth with different uid - use existing Auth uid
        newUid = existingAuthUser.uid;
        console.log(`  📝 ${email} - Using existing Auth uid: ${newUid}`);
      } else {
        // Create new user in Firebase Auth
        tempPassword = generateTempPassword();
        const userRecord = await auth.createUser({
          email: email,
          password: tempPassword,
          displayName: name,
        });
        newUid = userRecord.uid;
        console.log(`  ✨ ${email} - Created in Auth with uid: ${newUid}`);
      }

      // Create new document with Auth uid
      const newData = {
        ...data,
        id: newUid,
      };
      delete newData.passwordHash; // Remove old password hash

      await firestore.collection('Users_Admin').doc(newUid).set(newData);
      console.log(`  📄 ${email} - Created new doc with uid: ${newUid}`);

      // Delete old document if different
      if (oldDocId !== newUid) {
        await firestore.collection('Users_Admin').doc(oldDocId).delete();
        console.log(`  🗑️  ${email} - Deleted old doc: ${oldDocId}`);
      }

      results.success.push({
        email,
        oldDocId,
        newUid,
        tempPassword,
      });

      console.log(`  ✅ ${email} - Migration complete!\n`);

    } catch (error) {
      console.log(`  ❌ ${email} - Migration failed: ${error.message}\n`);
      results.failed.push({ email, error: error.message });
    }
  }

  // Summary
  console.log('\n================================');
  console.log('📊 MIGRATION SUMMARY');
  console.log('================================\n');

  console.log(`✅ Success: ${results.success.length}`);
  console.log(`❌ Failed: ${results.failed.length}\n`);

  if (results.success.length > 0) {
    console.log('Migrated users (SAVE THESE PASSWORDS!):\n');
    for (const { email, tempPassword } of results.success) {
      if (tempPassword) {
        console.log(`  📧 ${email}`);
        console.log(`     Password: ${tempPassword}`);
        console.log(`     ⚠️  User should reset password on first login\n`);
      } else {
        console.log(`  📧 ${email} - Using existing Auth credentials\n`);
      }
    }
  }

  if (results.failed.length > 0) {
    console.log('\nFailed migrations:\n');
    for (const { email, error } of results.failed) {
      console.log(`  ❌ ${email}: ${error}`);
    }
  }

  console.log('\n✅ Migration script completed!');
}

// Main
const args = process.argv.slice(2);
const autoConfirm = args.includes('--yes') || args.includes('-y');
const projectId = args.find(arg => !arg.startsWith('-'));

if (!projectId) {
  console.error('Usage: node migrate-admins-to-auth.js <projectId> [--yes]');
  console.error('Example: node migrate-admins-to-auth.js na-rede-loyalty-hub-club-4948 --yes');
  process.exit(1);
}

migrateAdmins(projectId, autoConfirm)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
