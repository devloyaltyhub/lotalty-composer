#!/usr/bin/env node

// Load environment variables FIRST
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');

/**
 * Fix Firebase credentials for existing clients in Master Firebase
 * This script re-parses firebase_options.dart with the corrected parsing logic
 * and updates platform-specific credentials (iOS, Android, Web) that were
 * incorrectly set due to the fallback bug.
 */

class FirebaseCredentialsFixer {
  constructor(dryRun = false) {
    this.masterApp = null;
    this.dryRun = dryRun;
  }

  // Initialize Master Firebase
  initializeMasterFirebase() {
    const projectId = process.env.MASTER_FIREBASE_PROJECT_ID;
    let serviceAccountPath =
      process.env.MASTER_FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!projectId) {
      throw new Error('MASTER_FIREBASE_PROJECT_ID is not set');
    }

    if (!serviceAccountPath) {
      throw new Error(
        'MASTER_FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS is not set'
      );
    }

    // Resolve path
    if (!path.isAbsolute(serviceAccountPath)) {
      const automationRoot = path.resolve(__dirname, '../..');
      serviceAccountPath = path.resolve(automationRoot, serviceAccountPath);
    }

    const serviceAccount = require(serviceAccountPath);

    this.masterApp = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId,
      },
      'master'
    );

    logger.info(`✅ Master Firebase initialized: ${projectId}`);
    return this.masterApp;
  }

  // Parse firebase_options.dart to extract configuration with CORRECTED logic
  parseFirebaseOptions(optionsPath) {
    const content = fs.readFileSync(optionsPath, 'utf8');

    // Extract platform-specific configuration sections
    const extractPlatformSection = (platform) => {
      const regex = new RegExp(
        `static\\s+const\\s+FirebaseOptions\\s+${platform}\\s*=\\s*FirebaseOptions\\s*\\([^)]+\\)`,
        's'
      );
      const match = content.match(regex);
      return match ? match[0] : null;
    };

    // Extract value from a specific section
    const extractValueFromSection = (section, key) => {
      if (!section) return null;
      const regex = new RegExp(`${key}:\\s*'([^']+)'`);
      const match = section.match(regex);
      return match ? match[1] : null;
    };

    // Extract generic value (first occurrence, typically from shared config)
    const extractValue = (key) => {
      const regex = new RegExp(`${key}:\\s*'([^']+)'`);
      const match = content.match(regex);
      return match ? match[1] : null;
    };

    // Get platform-specific sections
    const androidSection = extractPlatformSection('android');
    const iosSection = extractPlatformSection('ios');
    const webSection = extractPlatformSection('web');

    // Extract platform-specific values
    const androidAppId = extractValueFromSection(androidSection, 'appId');
    const androidApiKey = extractValueFromSection(androidSection, 'apiKey');
    const iosAppId = extractValueFromSection(iosSection, 'appId');
    const iosApiKey = extractValueFromSection(iosSection, 'apiKey');
    const webAppId = extractValueFromSection(webSection, 'appId');
    const webApiKey = extractValueFromSection(webSection, 'apiKey');

    // Extract common values (use generic extraction)
    const projectId = extractValue('projectId');
    const messagingSenderId = extractValue('messagingSenderId');
    const storageBucket = extractValue('storageBucket');
    const authDomain = extractValue('authDomain');
    const measurementId = extractValue('measurementId');
    const genericApiKey = extractValue('apiKey');
    const genericAppId = extractValue('appId');

    return {
      projectId,
      apiKey: genericApiKey,
      appId: genericAppId,
      messagingSenderId,
      storageBucket,
      authDomain,
      measurementId,
      // Platform-specific values with fallback to generic only if not found
      iosApiKey: iosApiKey || genericApiKey,
      iosAppId: iosAppId || genericAppId,
      androidApiKey: androidApiKey || genericApiKey,
      androidAppId: androidAppId || genericAppId,
      webApiKey: webApiKey || genericApiKey,
      webAppId: webAppId || genericAppId,
    };
  }

  // Get current credentials from Master Firebase
  async getCurrentCredentials(clientCode) {
    const firestore = admin.firestore(this.masterApp);
    const docRef = firestore.collection('clients').doc(clientCode);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    return data.firebase_options || null;
  }

  // Show diff between old and new credentials
  showDiff(clientCode, oldCreds, newCreds) {
    logger.section(`Changes for: ${clientCode}`);

    const keysToCheck = [
      'iosAppId',
      'iosApiKey',
      'androidAppId',
      'androidApiKey',
      'webAppId',
      'webApiKey',
    ];
    let hasChanges = false;

    for (const key of keysToCheck) {
      const oldValue = oldCreds?.[key];
      const newValue = newCreds[key];

      if (oldValue !== newValue) {
        hasChanges = true;
        logger.blank();
        logger.info(`📝 ${key}:`);

        if (oldValue) {
          logger.error(`  ❌ Old: ${oldValue}`);
        } else {
          logger.warn(`  ⚠️  Old: (not set)`);
        }

        if (newValue) {
          logger.success(`  ✅ New: ${newValue}`);
        } else {
          logger.warn(`  ⚠️  New: (not set)`);
        }

        // Highlight the critical iOS/Android detection
        if (key === 'iosAppId' || key === 'androidAppId') {
          if (oldValue && oldValue.includes(':android:') && key === 'iosAppId') {
            logger.warn(`  ⚠️  ISSUE: iOS App ID was set to Android value!`);
          }
          if (oldValue && oldValue.includes(':ios:') && key === 'androidAppId') {
            logger.warn(`  ⚠️  ISSUE: Android App ID was set to iOS value!`);
          }
        }
      }
    }

    if (!hasChanges) {
      logger.success('✅ No changes needed - credentials are correct');
    }

    logger.blank();
    return hasChanges;
  }

  // Fix credentials for a specific client
  async fixClientCredentials(clientCode) {
    try {
      logger.section(`Processing: ${clientCode}`);

      // Check if client folder exists
      const clientFolder = path.join(process.cwd(), 'clients', clientCode);
      if (!fs.existsSync(clientFolder)) {
        logger.error(`❌ Client folder not found: ${clientFolder}`);
        return { success: false, hasChanges: false };
      }

      // Check if firebase_options.dart exists
      const optionsPath = path.join(clientFolder, 'lib', 'firebase_options.dart');
      if (!fs.existsSync(optionsPath)) {
        logger.error(`❌ firebase_options.dart not found: ${optionsPath}`);
        return { success: false, hasChanges: false };
      }

      // Get current credentials from Master Firebase
      logger.info('📥 Fetching current credentials from Master Firebase...');
      const oldCredentials = await this.getCurrentCredentials(clientCode);

      if (!oldCredentials) {
        logger.warn(`⚠️  Client "${clientCode}" not found in Master Firebase`);
        return { success: false, hasChanges: false };
      }

      // Parse firebase options with CORRECTED logic
      logger.info('📄 Parsing firebase_options.dart with corrected logic...');
      const newCredentials = this.parseFirebaseOptions(optionsPath);

      // Show diff
      const hasChanges = this.showDiff(clientCode, oldCredentials, newCredentials);

      if (!hasChanges) {
        return { success: true, hasChanges: false };
      }

      // Update Master Firebase (unless dry-run)
      if (this.dryRun) {
        logger.warn('🔍 DRY RUN: Would update Master Firebase with new credentials');
        return { success: true, hasChanges: true, dryRun: true };
      }

      logger.startSpinner('Updating Master Firebase...');
      const firestore = admin.firestore(this.masterApp);
      const docRef = firestore.collection('clients').doc(clientCode);

      await docRef.update({
        firebase_options: newCredentials,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.succeedSpinner(`✅ Credentials updated in Master Firebase for: ${clientCode}`);
      return { success: true, hasChanges: true };
    } catch (error) {
      logger.error(`❌ Error processing ${clientCode}: ${error.message}`);
      return { success: false, hasChanges: false, error: error.message };
    }
  }

  // Fix all clients
  async fixAllClients() {
    try {
      const clientsDir = path.join(process.cwd(), 'clients');

      if (!fs.existsSync(clientsDir)) {
        logger.error(`❌ Clients directory not found: ${clientsDir}`);
        return [];
      }

      const clients = fs.readdirSync(clientsDir).filter((item) => {
        const itemPath = path.join(clientsDir, item);
        return fs.statSync(itemPath).isDirectory();
      });

      logger.section(`Found ${clients.length} client(s)`);
      logger.blank();

      const results = [];
      for (const client of clients) {
        const result = await this.fixClientCredentials(client);
        results.push({ client, ...result });
        logger.blank();
      }

      // Summary
      logger.section('='.repeat(60));
      logger.section('SUMMARY');
      logger.section('='.repeat(60));

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const changed = results.filter((r) => r.hasChanges).length;

      logger.info(`📊 Total clients: ${results.length}`);
      logger.success(`✅ Successful: ${successful}`);

      if (changed > 0) {
        if (this.dryRun) {
          logger.warn(`🔍 Would change: ${changed} client(s)`);
        } else {
          logger.success(`📝 Updated: ${changed} client(s)`);
        }
      } else {
        logger.success(`✨ All credentials are correct!`);
      }

      if (failed > 0) {
        logger.error(`❌ Failed: ${failed}`);
      }

      logger.blank();

      if (this.dryRun && changed > 0) {
        logger.section('To apply these changes, run:');
        logger.info('  node automation/01-client-setup/cli/fix-firebase-credentials.js --apply');
      }

      return results;
    } catch (error) {
      logger.error(`❌ Error: ${error.message}`);
      throw error;
    }
  }

  cleanup() {
    if (this.masterApp) {
      this.masterApp.delete();
    }
  }
}

// Main execution
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const clientCode = args.find((arg) => !arg.startsWith('--'));

  const fixer = new FirebaseCredentialsFixer(dryRun);

  try {
    logger.section('Firebase Credentials Fixer');
    logger.info('This script fixes platform-specific Firebase credentials (iOS/Android/Web)');
    logger.info('that were incorrectly set due to the parsing fallback bug.');
    logger.blank();

    if (dryRun) {
      logger.warn('🔍 Running in DRY RUN mode - no changes will be made');
      logger.info('   To apply changes, add --apply flag');
      logger.blank();
    }

    // Initialize Master Firebase
    fixer.initializeMasterFirebase();
    logger.blank();

    if (clientCode) {
      // Fix specific client
      await fixer.fixClientCredentials(clientCode);
    } else {
      // Fix all clients
      await fixer.fixAllClients();
    }

    logger.blank();
    logger.success('🎉 Done!');
    process.exit(0);
  } catch (error) {
    logger.error(`❌ Error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  } finally {
    fixer.cleanup();
  }
}

main();
