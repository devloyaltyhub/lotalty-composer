#!/usr/bin/env node

// Load environment variables FIRST
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../../shared/utils/logger');

/**
 * Fix admin user password hash in client Firebase
 * This script updates existing admin users with missing or incorrect passwordHash
 */

async function main() {
  const clientCode = process.argv[2];

  if (!clientCode) {
    console.error('Usage: node fix-admin-password.js <client-code>');
    process.exit(1);
  }

  logger.section(`Fix Admin Password: ${clientCode}`);

  try {
    // Load service account for the client
    const serviceAccountPath = path.join(
      process.cwd(),
      'clients',
      clientCode,
      'service-account.json'
    );

    if (!fs.existsSync(serviceAccountPath)) {
      logger.error(`❌ Service account not found: ${serviceAccountPath}`);
      process.exit(1);
    }

    const serviceAccount = require(serviceAccountPath);

    // Initialize Firebase for this client
    const app = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      },
      clientCode
    );

    logger.info(`✅ Connected to Firebase project: ${serviceAccount.project_id}`);

    // Get password from admin-credentials.txt
    const credentialsPath = path.join(
      process.cwd(),
      'clients',
      clientCode,
      'admin-credentials.txt'
    );
    if (!fs.existsSync(credentialsPath)) {
      logger.error(`❌ Credentials file not found: ${credentialsPath}`);
      await app.delete();
      process.exit(1);
    }

    const credentials = fs.readFileSync(credentialsPath, 'utf8');
    const passwordMatch = credentials.match(/Temporary Password:\s*(\S+)/);

    if (!passwordMatch) {
      logger.error('❌ Could not find password in admin-credentials.txt');
      await app.delete();
      process.exit(1);
    }

    const password = passwordMatch[1];
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    logger.info(`📋 Password from admin-credentials.txt: ${password}`);
    logger.info(`📋 Calculated hash: ${passwordHash}`);
    logger.blank();

    // Get admin users collection
    const firestore = admin.firestore(app);
    const adminUsersSnapshot = await firestore.collection('Admin_Users').get();

    if (adminUsersSnapshot.empty) {
      logger.error('❌ No admin users found in Admin_Users collection');
      await app.delete();
      process.exit(1);
    }

    logger.startSpinner('Updating admin user(s)...');

    let updated = 0;
    for (const doc of adminUsersSnapshot.docs) {
      const data = doc.data();

      // Update if passwordHash is missing or wrong
      if (!data.passwordHash || data.passwordHash !== passwordHash) {
        await doc.ref.update({
          passwordHash: passwordHash,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        updated++;
        logger.updateSpinner(`Updated ${data.email}`);
      }
    }

    if (updated > 0) {
      logger.succeedSpinner(`✅ Updated ${updated} admin user(s)`);
    } else {
      logger.succeedSpinner(`✅ All admin users already have correct password hash`);
    }

    await app.delete();
    logger.blank();
    logger.success('🎉 Done!');
    logger.blank();
  } catch (error) {
    logger.error(`❌ Error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

main();
