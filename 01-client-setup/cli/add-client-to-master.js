#!/usr/bin/env node

/**
 * Add Client to Master Firebase
 *
 * This script adds or updates a client entry in the Master Firebase
 * clients collection. Useful when a client was created but not properly
 * registered in the master database.
 *
 * Usage:
 *   node add-client-to-master.js <client-code>
 *   node add-client-to-master.js na-rede
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

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
      projectId: process.env.MASTER_FIREBASE_PROJECT_ID,
    });

    log('✅ Firebase Admin SDK initialized successfully', colors.green);
    return true;
  } catch (error) {
    log(`❌ Failed to initialize Firebase Admin: ${error.message}`, colors.red);
    return false;
  }
}

async function loadClientConfig(clientCode) {
  log(`\n🔍 Loading client config for: ${clientCode}`, colors.cyan);

  const configPath = path.join(__dirname, '../../../clients', clientCode, 'config.json');

  if (!fs.existsSync(configPath)) {
    log(`❌ Client config not found at: ${configPath}`, colors.red);
    return null;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    log('✅ Client config loaded successfully', colors.green);
    return config;
  } catch (error) {
    log(`❌ Failed to load client config: ${error.message}`, colors.red);
    return null;
  }
}

async function checkExistingClient(clientCode) {
  log(`\n🔍 Checking if client already exists in master...`, colors.cyan);

  try {
    const firestore = admin.firestore();
    const doc = await firestore.collection('clients').doc(clientCode).get();

    if (doc.exists) {
      log(`⚠️  Client already exists in master database`, colors.yellow);
      const data = doc.data();
      log(`   Current data:`, colors.cyan);
      log(`   - isActive: ${data.isActive}`, colors.cyan);
      log(`   - Project ID: ${data.firebase_options?.projectId || 'N/A'}`, colors.cyan);
      return data;
    } else {
      log('📝 Client does not exist in master, will create new entry', colors.yellow);
      return null;
    }
  } catch (error) {
    log(`❌ Failed to check existing client: ${error.message}`, colors.red);
    throw error;
  }
}

async function addClientToMaster(clientCode, firebaseOptions, isActive = true) {
  log(`\n💾 Adding client to Master Firebase...`, colors.cyan);

  try {
    const firestore = admin.firestore();

    const clientData = {
      isActive: isActive,
      firebase_options: firebaseOptions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Add createdAt only if it's a new document
    const existingDoc = await firestore.collection('clients').doc(clientCode).get();
    if (!existingDoc.exists) {
      clientData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await firestore.collection('clients').doc(clientCode).set(clientData, { merge: true });

    log('✅ Client added to Master Firebase successfully!', colors.green);
    log(`   Collection: clients`, colors.cyan);
    log(`   Document ID: ${clientCode}`, colors.cyan);
    log(`   Project ID: ${firebaseOptions.projectId}`, colors.cyan);
    log(`   Active: ${isActive}`, colors.cyan);

    return true;
  } catch (error) {
    log(`❌ Failed to add client to master: ${error.message}`, colors.red);
    throw error;
  }
}

async function verifyClientInMaster(clientCode) {
  log(`\n🔍 Verifying client in master...`, colors.cyan);

  try {
    const firestore = admin.firestore();
    const doc = await firestore.collection('clients').doc(clientCode).get();

    if (doc.exists) {
      log('✅ Client verified in Master Firebase', colors.green);
      const data = doc.data();
      log(`   Data:`, colors.cyan);
      log(`   - isActive: ${data.isActive}`, colors.cyan);
      log(`   - Project ID: ${data.firebase_options?.projectId}`, colors.cyan);
      log(`   - API Key: ${data.firebase_options?.apiKey?.substring(0, 20)}...`, colors.cyan);
      log(`   - Storage Bucket: ${data.firebase_options?.storageBucket}`, colors.cyan);
      return true;
    } else {
      log('❌ Client not found in Master Firebase', colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ Verification failed: ${error.message}`, colors.red);
    return false;
  }
}

async function main() {
  log('\n========================================', colors.bright);
  log('🔥 ADD CLIENT TO MASTER FIREBASE', colors.bright);
  log('========================================\n', colors.bright);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const clientCode = args[0];

  if (!clientCode) {
    log('❌ Missing required argument: client-code', colors.red);
    log('\nUsage: node add-client-to-master.js <client-code>', colors.yellow);
    log('Example: node add-client-to-master.js na-rede', colors.yellow);
    process.exit(1);
  }

  log(`Client Code: ${clientCode}`, colors.cyan);

  try {
    // Initialize Firebase Admin SDK
    const initialized = await initializeFirebaseAdmin();
    if (!initialized) {
      process.exit(1);
    }

    // Load client config
    const config = await loadClientConfig(clientCode);
    if (!config) {
      process.exit(1);
    }

    // Check if client already exists
    const existingClient = await checkExistingClient(clientCode);

    // Add/update client in master
    await addClientToMaster(clientCode, config.firebaseOptions, true);

    // Verify client in master
    const verified = await verifyClientInMaster(clientCode);

    if (verified) {
      log('\n========================================', colors.bright);
      log('✅ CLIENT ADDED SUCCESSFULLY!', colors.green + colors.bright);
      log('========================================\n', colors.bright);

      if (existingClient) {
        log('📝 Client entry was updated in master database', colors.yellow);
      } else {
        log('🎉 New client entry created in master database', colors.green);
      }

      log('\n📋 Next Steps:', colors.cyan);
      log('1. Verify the client appears in loyalty-admin app', colors.yellow);
      log('2. Test login with the client code:', colors.yellow);
      log(`   - Client Code: ${clientCode}`, colors.green);
      log(`   - Admin Email: ${config.adminEmail || 'Check admin-credentials.txt'}`, colors.green);
    } else {
      log('\n❌ Verification failed!', colors.red);
      process.exit(1);
    }
  } catch (error) {
    log('\n========================================', colors.bright);
    log('❌ OPERATION FAILED', colors.red + colors.bright);
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

module.exports = { addClientToMaster, verifyClientInMaster };
