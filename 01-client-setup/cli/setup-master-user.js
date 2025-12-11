#!/usr/bin/env node

/**
 * Master User Setup Script
 *
 * Automatically creates the master user in the Master Firebase project.
 * The master user is required for the 3-step authentication flow in loyalty-admin.
 *
 * This script:
 * 1. Attempts to create user via Firebase Admin SDK
 * 2. If IAM permissions are insufficient, provides instructions to grant them
 * 3. Creates the user in Firebase Authentication
 * 4. Creates the corresponding document in Firestore admin_users collection
 * 5. Generates a secure credentials file
 *
 * Usage:
 *   node setup-master-user.js
 *   node setup-master-user.js --password "CustomPassword123!"
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Constants
const MASTER_EMAIL = 'devloyaltyhub@gmail.com';
const DEFAULT_PASSWORD = 'LoyaltyHub@2025!Admin53753*';
const MASTER_PROJECT_ID = 'master-loyalty-hub';
const DISPLAY_NAME = 'Master Admin';

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

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function resolveCredentialPath(relativePath) {
  if (!relativePath) return null;

  // Expand environment variables like $HOME, $USER, etc.
  let expandedPath = relativePath.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    return process.env[varName] || match;
  });

  const automationRoot = path.resolve(__dirname, '../..');
  return path.isAbsolute(expandedPath) ? expandedPath : path.resolve(automationRoot, expandedPath);
}

async function initializeFirebaseAdmin() {
  log('\n🔧 Initializing Firebase Admin SDK...', colors.cyan);

  const credentialPath = resolveCredentialPath(process.env.MASTER_FIREBASE_SERVICE_ACCOUNT);

  if (!credentialPath || !fs.existsSync(credentialPath)) {
    log('❌ Master Firebase service account credential not found!', colors.red);
    log(`Expected at: ${credentialPath}`, colors.yellow);
    log('\nPlease ensure MASTER_FIREBASE_SERVICE_ACCOUNT is set in .env', colors.yellow);
    process.exit(1);
  }

  try {
    const serviceAccount = require(credentialPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: MASTER_PROJECT_ID,
    });

    log('✅ Firebase Admin SDK initialized successfully', colors.green);
    return true;
  } catch (error) {
    log(`❌ Failed to initialize Firebase Admin: ${error.message}`, colors.red);
    return false;
  }
}

async function checkExistingUser() {
  log('\n🔍 Checking if master user already exists...', colors.cyan);

  try {
    const userRecord = await admin.auth().getUserByEmail(MASTER_EMAIL);
    log(`✅ User already exists with UID: ${userRecord.uid}`, colors.green);
    return userRecord;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      log('📝 User does not exist, will create new user', colors.yellow);
      return null;
    }
    throw error;
  }
}

async function createAuthUser(password) {
  log('\n👤 Creating user in Firebase Authentication...', colors.cyan);

  try {
    const userRecord = await admin.auth().createUser({
      email: MASTER_EMAIL,
      password: password,
      displayName: DISPLAY_NAME,
      emailVerified: true,
      disabled: false,
    });

    log(`✅ User created successfully!`, colors.green);
    log(`   UID: ${userRecord.uid}`, colors.cyan);
    log(`   Email: ${userRecord.email}`, colors.cyan);

    return userRecord;
  } catch (error) {
    if (error.code === 'auth/insufficient-permission') {
      log('❌ PERMISSION DENIED', colors.red);
      log('\n⚠️  The service account lacks permissions to create users.', colors.yellow);
      log('\n📋 To fix this, run the following command:', colors.cyan);
      log('\n--------------------------------------------------', colors.bright);
      log(`gcloud projects add-iam-policy-binding ${MASTER_PROJECT_ID} \\`, colors.green);
      log(
        `  --member="serviceAccount:${admin.app().options.credential.projectId}@${MASTER_PROJECT_ID}.iam.gserviceaccount.com" \\`,
        colors.green
      );
      log(`  --role="roles/serviceusage.serviceUsageConsumer"`, colors.green);
      log('\ngcloud projects add-iam-policy-binding ${MASTER_PROJECT_ID} \\', colors.green);
      log(
        `  --member="serviceAccount:${admin.app().options.credential.projectId}@${MASTER_PROJECT_ID}.iam.gserviceaccount.com" \\`,
        colors.green
      );
      log(`  --role="roles/iam.serviceAccountTokenCreator"`, colors.green);
      log('--------------------------------------------------\n', colors.bright);
      log('After granting permissions, run this script again.', colors.yellow);
      log('\n💡 Alternative: Create user manually in Firebase Console:', colors.cyan);
      log(
        `   https://console.firebase.google.com/project/${MASTER_PROJECT_ID}/authentication/users\n`,
        colors.cyan
      );
      process.exit(1);
    }
    throw error;
  }
}

async function createFirestoreDocument(uid, password) {
  log('\n📄 Creating Firestore document in admin_users...', colors.cyan);

  const hashedPassword = hashPassword(password);

  const userData = {
    email: MASTER_EMAIL,
    password: hashedPassword,
    role: 'master',
    permissions: {
      master_access: true,
      admin: true,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await admin.firestore().collection('admin_users').doc(uid).set(userData);

    log('✅ Firestore document created successfully', colors.green);
    log(`   Collection: admin_users`, colors.cyan);
    log(`   Document ID: ${uid}`, colors.cyan);
    log(`   Password Hash: ${hashedPassword.substring(0, 20)}...`, colors.cyan);

    return true;
  } catch (error) {
    log(`❌ Failed to create Firestore document: ${error.message}`, colors.red);
    throw error;
  }
}

function saveCredentials(uid, password) {
  log('\n💾 Saving credentials...', colors.cyan);

  const outputDir = path.join(__dirname, '../../../..');
  const credentialsFile = path.join(outputDir, 'MASTER_USER_CREDENTIALS.txt');

  const hashedPassword = hashPassword(password);

  const content = `
========================================
🔐 MASTER USER CREDENTIALS
========================================

Created: ${new Date().toISOString()}
Project: ${MASTER_PROJECT_ID}

EMAIL: ${MASTER_EMAIL}
PASSWORD: ${password}
UID: ${uid}

PASSWORD HASH (SHA-256): ${hashedPassword}

========================================
⚠️  SECURITY NOTICE
========================================

1. CHANGE THE PASSWORD after first login!
2. Store credentials securely (password manager)
3. DO NOT commit this file to version control
4. DELETE this file after saving credentials elsewhere

========================================
🔗 USEFUL LINKS
========================================

Firebase Console:
https://console.firebase.google.com/project/${MASTER_PROJECT_ID}

Authentication Users:
https://console.firebase.google.com/project/${MASTER_PROJECT_ID}/authentication/users

Firestore Database:
https://console.firebase.google.com/project/${MASTER_PROJECT_ID}/firestore

========================================
`;

  fs.writeFileSync(credentialsFile, content.trim());
  log(`✅ Credentials saved to: ${credentialsFile}`, colors.green);
  log('⚠️  Remember to delete this file after saving credentials elsewhere!', colors.yellow);
}

async function verifySetup(uid) {
  log('\n🔍 Verifying setup...', colors.cyan);

  try {
    // Verify auth user exists
    const userRecord = await admin.auth().getUser(uid);
    log('✅ Firebase Auth user verified', colors.green);

    // Verify Firestore document exists
    const docSnapshot = await admin.firestore().collection('admin_users').doc(uid).get();

    if (docSnapshot.exists) {
      log('✅ Firestore document verified', colors.green);
      const data = docSnapshot.data();
      log(`   Role: ${data.role}`, colors.cyan);
      log(`   Permissions: ${JSON.stringify(data.permissions)}`, colors.cyan);
      return true;
    } else {
      log('❌ Firestore document not found', colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ Verification failed: ${error.message}`, colors.red);
    return false;
  }
}

async function main() {
  log('\n========================================', colors.bright);
  log('🔐 MASTER USER SETUP', colors.bright);
  log('========================================\n', colors.bright);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const passwordIndex = args.indexOf('--password');
  const password =
    passwordIndex !== -1 && args[passwordIndex + 1] ? args[passwordIndex + 1] : DEFAULT_PASSWORD;

  log(`Project: ${MASTER_PROJECT_ID}`, colors.cyan);
  log(`Email: ${MASTER_EMAIL}`, colors.cyan);
  log(
    `Password: ${password === DEFAULT_PASSWORD ? 'Using default password' : 'Using custom password'}`,
    colors.cyan
  );

  try {
    // Initialize Firebase Admin SDK
    const initialized = await initializeFirebaseAdmin();
    if (!initialized) {
      process.exit(1);
    }

    // Check if user already exists
    let userRecord = await checkExistingUser();

    if (!userRecord) {
      // Create user in Firebase Authentication
      userRecord = await createAuthUser(password);
    }

    // Create or update Firestore document
    await createFirestoreDocument(userRecord.uid, password);

    // Verify setup
    const verified = await verifySetup(userRecord.uid);

    if (verified) {
      // Save credentials
      saveCredentials(userRecord.uid, password);

      log('\n========================================', colors.bright);
      log('✅ SETUP COMPLETE!', colors.green + colors.bright);
      log('========================================\n', colors.bright);

      log('📋 Next Steps:', colors.cyan);
      log('1. Deploy Master Firebase rules:', colors.yellow);
      log('   cd loyalty-admin-main && firebase deploy --only firestore:rules', colors.green);
      log('\n2. Test login in loyalty-admin app:', colors.yellow);
      log(`   - Client Code: demo`, colors.green);
      log(`   - Admin Email: admin@loyaltyhub.club`, colors.green);
      log(`   - Master Password: ${password}`, colors.green);
      log('\n3. CHANGE THE PASSWORD after first login!', colors.yellow + colors.bright);
    } else {
      log('\n❌ Setup verification failed!', colors.red);
      process.exit(1);
    }
  } catch (error) {
    log('\n========================================', colors.bright);
    log('❌ SETUP FAILED', colors.red + colors.bright);
    log('========================================\n', colors.bright);
    log(`Error: ${error.message}`, colors.red);

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

module.exports = { createAuthUser, createFirestoreDocument, verifySetup };
