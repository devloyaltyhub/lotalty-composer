#!/usr/bin/env node

/**
 * Create Master User Script
 *
 * This script creates the master authentication user in the Master Firebase project.
 * This user is required to authenticate before accessing client credentials.
 *
 * User: devloyaltyhub@gmail.com
 * Purpose: Authenticate admin app before fetching client configurations
 */

const admin = require('firebase-admin');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const MASTER_EMAIL = 'devloyaltyhub@gmail.com';
const MASTER_FIREBASE_PROJECT_ID = process.env.MASTER_FIREBASE_PROJECT_ID || 'loyalty-hub-1f47c';
const SERVICE_ACCOUNT_PATH = process.env.MASTER_FIREBASE_SERVICE_ACCOUNT;

async function initializeFirebase() {
  console.log('\n🔧 Initializing Master Firebase...');

  if (!SERVICE_ACCOUNT_PATH) {
    throw new Error('MASTER_FIREBASE_SERVICE_ACCOUNT not set in .env file');
  }

  const serviceAccountPath = path.join(__dirname, '../..', SERVICE_ACCOUNT_PATH);

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account file not found: ${serviceAccountPath}`);
  }

  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: MASTER_FIREBASE_PROJECT_ID,
  });

  console.log('✅ Master Firebase initialized');
  return admin.firestore();
}

async function createMasterUser() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('🔐 CREATE MASTER USER');
  console.log('════════════════════════════════════════════════════════\n');

  const firestore = await initializeFirebase();

  // Check if user already exists
  const existingUser = await firestore
    .collection('admin_users')
    .where('email', '==', MASTER_EMAIL)
    .get();

  if (!existingUser.empty) {
    console.log(`⚠️  User ${MASTER_EMAIL} already exists.`);
    const update = await question('Do you want to update the password? (yes/no): ');

    if (update.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled');
      rl.close();
      return;
    }
  }

  // Get password
  console.log(`\nCreating master user: ${MASTER_EMAIL}`);
  const password = await question('Enter password (min 8 characters): ');

  if (password.length < 8) {
    console.log('❌ Password must be at least 8 characters');
    rl.close();
    return;
  }

  const confirmPassword = await question('Confirm password: ');

  if (password !== confirmPassword) {
    console.log('❌ Passwords do not match');
    rl.close();
    return;
  }

  // Hash password with SHA-256
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

  // Prepare user data
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
    if (!existingUser.empty) {
      // Update existing user
      const userId = existingUser.docs[0].id;
      await firestore.collection('admin_users').doc(userId).update({
        password: hashedPassword,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('\n✅ Master user password updated successfully!');
    } else {
      // Create new user
      await firestore.collection('admin_users').add(userData);
      console.log('\n✅ Master user created successfully!');
    }

    console.log('\n📧 Email:', MASTER_EMAIL);
    console.log('🔑 Password: [stored securely]');
    console.log('\n⚠️  IMPORTANT: Save this password securely!');
    console.log('This user is required for admin app authentication.\n');
  } catch (error) {
    console.error('❌ Error creating master user:', error.message);
    throw error;
  } finally {
    rl.close();
  }
}

// Run the script
createMasterUser()
  .then(() => {
    console.log('\n✅ Master user setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed to create master user:', error);
    process.exit(1);
  });
