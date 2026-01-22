/**
 * Master User Utilities
 *
 * Helper functions for master user setup:
 * - Firebase initialization and user management
 * - Firestore document operations
 * - Credential file generation
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MASTER_PROJECT_ID = 'master-loyalty-hub';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function resolveCredentialPath(relativePath) {
  if (!relativePath) return null;

  let expandedPath = relativePath.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    return process.env[varName] || match;
  });

  const automationRoot = path.resolve(__dirname, '../..');
  return path.isAbsolute(expandedPath) ? expandedPath : path.resolve(automationRoot, expandedPath);
}

async function initializeFirebaseAdmin(admin, logger) {
  logger.section('Initializing Firebase Admin SDK...');

  const credentialPath = resolveCredentialPath(process.env.MASTER_FIREBASE_SERVICE_ACCOUNT);

  if (!credentialPath || !fs.existsSync(credentialPath)) {
    logger.error('Master Firebase service account credential not found!');
    logger.warning(`Expected at: ${credentialPath}`);
    logger.warning('Please ensure MASTER_FIREBASE_SERVICE_ACCOUNT is set in .env');
    return false;
  }

  try {
    const serviceAccount = require(credentialPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: MASTER_PROJECT_ID,
    });

    logger.success('Firebase Admin SDK initialized successfully');
    return true;
  } catch (error) {
    logger.error(`Failed to initialize Firebase Admin: ${error.message}`);
    return false;
  }
}

async function checkExistingUser(admin, email, logger) {
  logger.section('Checking if master user already exists...');

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    logger.success(`User already exists with UID: ${userRecord.uid}`);
    return userRecord;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      logger.warning('User does not exist, will create new user');
      return null;
    }
    throw error;
  }
}

async function createAuthUser(admin, email, password, displayName, logger) {
  logger.section('Creating user in Firebase Authentication...');

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    });

    logger.success('User created successfully!');
    logger.info(`   UID: ${userRecord.uid}`);
    logger.info(`   Email: ${userRecord.email}`);

    return userRecord;
  } catch (error) {
    if (error.code === 'auth/insufficient-permission') {
      logPermissionError(admin, logger);
      return null;
    }
    throw error;
  }
}

function logPermissionError(admin, logger) {
  logger.error('PERMISSION DENIED');
  logger.warning('The service account lacks permissions to create users.');
  logger.section('To fix this, run the following command:');
  console.log('--------------------------------------------------');
  console.log(`gcloud projects add-iam-policy-binding ${MASTER_PROJECT_ID} \\`);
  console.log(
    `  --member="serviceAccount:${admin.app().options.credential.projectId}@${MASTER_PROJECT_ID}.iam.gserviceaccount.com" \\`
  );
  console.log(`  --role="roles/serviceusage.serviceUsageConsumer"`);
  console.log(`\ngcloud projects add-iam-policy-binding ${MASTER_PROJECT_ID} \\`);
  console.log(
    `  --member="serviceAccount:${admin.app().options.credential.projectId}@${MASTER_PROJECT_ID}.iam.gserviceaccount.com" \\`
  );
  console.log(`  --role="roles/iam.serviceAccountTokenCreator"`);
  console.log('--------------------------------------------------');
  logger.warning('After granting permissions, run this script again.');
  logger.info('Alternative: Create user manually in Firebase Console:');
  console.log(
    `   https://console.firebase.google.com/project/${MASTER_PROJECT_ID}/authentication/users\n`
  );
}

async function createFirestoreDocument(admin, uid, email, password, logger) {
  logger.section('Creating Firestore document in admin_users...');

  const hashedPassword = hashPassword(password);

  const userData = {
    email,
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

    logger.success('Firestore document created successfully');
    logger.info(`   Collection: admin_users`);
    logger.info(`   Document ID: ${uid}`);
    logger.info(`   Password Hash: ${hashedPassword.substring(0, 20)}...`);

    return true;
  } catch (error) {
    logger.error(`Failed to create Firestore document: ${error.message}`);
    throw error;
  }
}

async function verifySetup(admin, uid, logger) {
  logger.section('Verifying setup...');

  try {
    await admin.auth().getUser(uid);
    logger.success('Firebase Auth user verified');

    const docSnapshot = await admin.firestore().collection('admin_users').doc(uid).get();

    if (docSnapshot.exists) {
      logger.success('Firestore document verified');
      const data = docSnapshot.data();
      logger.info(`   Role: ${data.role}`);
      logger.info(`   Permissions: ${JSON.stringify(data.permissions)}`);
      return true;
    } else {
      logger.error('Firestore document not found');
      return false;
    }
  } catch (error) {
    logger.error(`Verification failed: ${error.message}`);
    return false;
  }
}

function saveCredentials(uid, email, password, logger) {
  logger.section('Saving credentials...');

  const outputDir = path.join(__dirname, '../../..');
  const credentialsFile = path.join(outputDir, 'MASTER_USER_CREDENTIALS.txt');

  const hashedPassword = hashPassword(password);

  const content = `
========================================
MASTER USER CREDENTIALS
========================================

Created: ${new Date().toISOString()}
Project: ${MASTER_PROJECT_ID}

EMAIL: ${email}
PASSWORD: ${password}
UID: ${uid}

PASSWORD HASH (SHA-256): ${hashedPassword}

========================================
SECURITY NOTICE
========================================

1. CHANGE THE PASSWORD after first login!
2. Store credentials securely (password manager)
3. DO NOT commit this file to version control
4. DELETE this file after saving credentials elsewhere

========================================
USEFUL LINKS
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
  logger.success(`Credentials saved to: ${credentialsFile}`);
  logger.warning('Remember to delete this file after saving credentials elsewhere!');
}

function printNextSteps(password, logger) {
  logger.info('Next Steps:');
  logger.warning('1. Deploy Master Firebase rules:');
  console.log('   cd loyalty-admin-main && firebase deploy --only firestore:rules');
  logger.warning('\n2. Test login in loyalty-admin app:');
  console.log('   - Client Code: demo');
  console.log('   - Admin Email: admin@loyaltyhub.club');
  console.log(`   - Master Password: ${password}`);
  logger.warning('\n3. CHANGE THE PASSWORD after first login!');
}

module.exports = {
  hashPassword,
  resolveCredentialPath,
  initializeFirebaseAdmin,
  checkExistingUser,
  createAuthUser,
  createFirestoreDocument,
  verifySetup,
  saveCredentials,
  printNextSteps,
  MASTER_PROJECT_ID,
};
