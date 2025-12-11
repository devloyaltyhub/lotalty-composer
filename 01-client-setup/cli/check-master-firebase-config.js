#!/usr/bin/env node

// Load environment variables FIRST
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const admin = require('firebase-admin');
const path = require('path');

/**
 * Check Master Firebase configuration
 * This script verifies that the Master Firebase project is properly configured
 */

async function main() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Check Master Firebase Configuration`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    const projectId = process.env.MASTER_FIREBASE_PROJECT_ID;
    let serviceAccountPath =
      process.env.MASTER_FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!projectId) {
      console.error('❌ MASTER_FIREBASE_PROJECT_ID is not set');
      process.exit(1);
    }

    if (!serviceAccountPath) {
      console.error(
        '❌ MASTER_FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS is not set'
      );
      process.exit(1);
    }

    // Resolve path
    if (!path.isAbsolute(serviceAccountPath)) {
      const automationRoot = path.resolve(__dirname, '../..');
      serviceAccountPath = path.resolve(automationRoot, serviceAccountPath);
    }

    console.log(`📋 Project ID: ${projectId}`);
    console.log(`📋 Service Account: ${serviceAccountPath}\n`);

    const serviceAccount = require(serviceAccountPath);

    // Initialize Firebase Admin
    const app = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId,
      },
      'master-check'
    );

    console.log(`✅ Successfully connected to Master Firebase\n`);

    // Check Firestore
    console.log(`📦 Checking Firestore...`);
    const firestore = admin.firestore(app);
    const clientsSnapshot = await firestore.collection('clients').limit(5).get();
    console.log(`   Found ${clientsSnapshot.size} client(s) in Firestore`);

    if (!clientsSnapshot.empty) {
      console.log(`   Sample clients:`);
      clientsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`   - ${doc.id} (active: ${data.isActive})`);
      });
    }
    console.log();

    // Check Auth
    console.log(`🔐 Checking Firebase Auth...`);
    const auth = admin.auth(app);

    try {
      const masterEmail = 'devloyaltyhub@gmail.com';
      const user = await auth.getUserByEmail(masterEmail);
      console.log(`   ✅ Master user exists: ${user.email}`);
      console.log(`   UID: ${user.uid}`);
      console.log(`   Disabled: ${user.disabled}`);
      console.log(`   Email Verified: ${user.emailVerified}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log(`   ❌ Master user not found: devloyaltyhub@gmail.com`);
        console.log(`   💡 You need to create the master user in Firebase Console`);
      } else {
        throw error;
      }
    }
    console.log();

    // Firebase Console URLs
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  Firebase Console URLs`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`🔗 Project Overview:`);
    console.log(`   https://console.firebase.google.com/project/${projectId}\n`);
    console.log(`🔗 Authentication:`);
    console.log(
      `   https://console.firebase.google.com/project/${projectId}/authentication/users\n`
    );
    console.log(`🔗 Project Settings:`);
    console.log(`   https://console.firebase.google.com/project/${projectId}/settings/general\n`);

    await app.delete();
    console.log('✅ Done!\n');
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
