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
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { CliLogger } = require('../shared/cli-logger');
const {
  initializeFirebaseAdmin,
  checkExistingUser,
  createAuthUser,
  createFirestoreDocument,
  verifySetup,
  saveCredentials,
  printNextSteps,
} = require('../shared/master-user-utils');

const MASTER_EMAIL = 'devloyaltyhub@gmail.com';
const DEFAULT_PASSWORD = 'LoyaltyHub@2025!Admin53753*';
const DISPLAY_NAME = 'Master Admin';

function parsePassword() {
  const args = process.argv.slice(2);
  const passwordIndex = args.indexOf('--password');
  return passwordIndex !== -1 && args[passwordIndex + 1] ? args[passwordIndex + 1] : DEFAULT_PASSWORD;
}

async function main() {
  CliLogger.header('MASTER USER SETUP');

  const password = parsePassword();
  const isDefaultPassword = password === DEFAULT_PASSWORD;

  CliLogger.info(`Project: master-loyalty-hub`);
  CliLogger.info(`Email: ${MASTER_EMAIL}`);
  CliLogger.info(`Password: ${isDefaultPassword ? 'Using default password' : 'Using custom password'}`);

  try {
    const initialized = await initializeFirebaseAdmin(admin, CliLogger);
    if (!initialized) {
      process.exit(1);
    }

    let userRecord = await checkExistingUser(admin, MASTER_EMAIL, CliLogger);

    if (!userRecord) {
      userRecord = await createAuthUser(admin, MASTER_EMAIL, password, DISPLAY_NAME, CliLogger);
      if (!userRecord) {
        process.exit(1);
      }
    }

    await createFirestoreDocument(admin, userRecord.uid, MASTER_EMAIL, password, CliLogger);

    const verified = await verifySetup(admin, userRecord.uid, CliLogger);

    if (verified) {
      saveCredentials(userRecord.uid, MASTER_EMAIL, password, CliLogger);

      CliLogger.successHeader('SETUP COMPLETE!');
      printNextSteps(password, CliLogger);
    } else {
      CliLogger.errorHeader('Setup verification failed!');
      process.exit(1);
    }
  } catch (error) {
    CliLogger.errorHeader('SETUP FAILED');
    CliLogger.error(`Error: ${error.message}`);

    if (error.stack) {
      CliLogger.warning('\nStack trace:');
      console.log(error.stack);
    }

    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createAuthUser: (admin, email, password, displayName, logger) =>
    createAuthUser(admin, email, password, displayName, logger),
  createFirestoreDocument: (admin, uid, email, password, logger) =>
    createFirestoreDocument(admin, uid, email, password, logger),
  verifySetup: (admin, uid, logger) => verifySetup(admin, uid, logger),
};
