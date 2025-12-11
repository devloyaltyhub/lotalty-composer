#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');

// Use relative path instead of hardcoded absolute path
const credentialsPath = path.resolve(__dirname, '../../credentials/master-firebase-service-account.json');
const serviceAccount = require(credentialsPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'loyalty-hub-1f47c',
});

const db = admin.firestore();
const uid = 'DdbQHEvFMve5Qk8SQgsUtlfkpt72';
const passwordHash = 'b3c77a46d1ddcb84153c520bfe96681438328b04bc7b7502b0e2819503d6abd8';

const userData = {
  email: 'devloyaltyhub@gmail.com',
  password: passwordHash,
  role: 'master',
  permissions: {
    master_access: true,
    admin: true,
  },
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

db.collection('admin_users')
  .doc(uid)
  .set(userData)
  .then(() => {
    console.log('✅ Master user document created successfully!');
    console.log(`   Collection: admin_users`);
    console.log(`   Document ID: ${uid}`);
    console.log(`   Email: devloyaltyhub@gmail.com`);
    console.log(`   Password Hash: ${passwordHash.substring(0, 20)}...`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error creating document:', error);
    process.exit(1);
  });
