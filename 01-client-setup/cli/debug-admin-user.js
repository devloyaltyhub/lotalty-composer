#!/usr/bin/env node

// Load environment variables FIRST
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Debug admin user in client Firebase
 */

async function main() {
  const clientCode = process.argv[2];

  if (!clientCode) {
    console.error('Usage: node debug-admin-user.js <client-code>');
    process.exit(1);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Debug Admin User: ${clientCode}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    // Load service account for the client
    const serviceAccountPath = path.join(
      process.cwd(),
      'clients',
      clientCode,
      'service-account.json'
    );

    if (!fs.existsSync(serviceAccountPath)) {
      console.error(`❌ Service account not found: ${serviceAccountPath}`);
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

    console.log(`✅ Connected to Firebase project: ${serviceAccount.project_id}\n`);

    // Get admin users collection
    const firestore = admin.firestore(app);
    const adminUsersSnapshot = await firestore.collection('Admin_Users').get();

    if (adminUsersSnapshot.empty) {
      console.log('❌ No admin users found in Admin_Users collection');
      await app.delete();
      process.exit(1);
    }

    console.log(`Found ${adminUsersSnapshot.size} admin user(s):\n`);

    adminUsersSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`User ID: ${doc.id}`);
      console.log(`Email: ${data.email}`);
      console.log(`Name: ${data.name}`);
      console.log(`Role: ${data.role}`);
      console.log(`Active: ${data.isActive}`);
      console.log(`Password Hash: ${data.passwordHash || 'NOT SET'}`);
      console.log(`Created At: ${data.createdAt?.toDate?.() || data.createdAt}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // If we have a temporary password from admin-credentials.txt, check it
      const credentialsPath = path.join(
        process.cwd(),
        'clients',
        clientCode,
        'admin-credentials.txt'
      );
      if (fs.existsSync(credentialsPath)) {
        const credentials = fs.readFileSync(credentialsPath, 'utf8');
        const passwordMatch = credentials.match(/Temporary Password:\s*(\S+)/);

        if (passwordMatch) {
          const password = passwordMatch[1];
          const calculatedHash = crypto.createHash('sha256').update(password).digest('hex');

          console.log(`📋 Password from admin-credentials.txt:`);
          console.log(`   Password: ${password}`);
          console.log(`   Calculated Hash: ${calculatedHash}`);
          console.log(`   Stored Hash: ${data.passwordHash || 'NOT SET'}`);
          console.log(`   Match: ${calculatedHash === data.passwordHash ? '✅ YES' : '❌ NO'}\n`);
        }
      }
    });

    await app.delete();
    console.log('✅ Done!\n');
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
