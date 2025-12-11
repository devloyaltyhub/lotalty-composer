#!/usr/bin/env node

// Load environment variables FIRST
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');

/**
 * Fix Web API credentials for existing clients in Master Firebase
 * This script re-parses firebase_options.dart and updates the Master Firebase
 * to include webApiKey and webAppId which are required for Windows admin.
 */

class WebCredentialsFixer {
  constructor() {
    this.masterApp = null;
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

  // Parse firebase_options.dart to extract configuration
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

  // Fix credentials for a specific client
  async fixClientCredentials(clientCode) {
    try {
      logger.section(`Fixing credentials for: ${clientCode}`);

      // Check if client folder exists
      const clientFolder = path.join(process.cwd(), 'clients', clientCode);
      if (!fs.existsSync(clientFolder)) {
        logger.error(`❌ Client folder not found: ${clientFolder}`);
        return false;
      }

      // Check if firebase_options.dart exists
      const optionsPath = path.join(clientFolder, 'lib', 'firebase_options.dart');
      if (!fs.existsSync(optionsPath)) {
        logger.error(`❌ firebase_options.dart not found: ${optionsPath}`);
        return false;
      }

      // Parse firebase options
      logger.info('📄 Parsing firebase_options.dart...');
      const firebaseOptions = this.parseFirebaseOptions(optionsPath);

      // Check if web credentials exist
      if (!firebaseOptions.webApiKey || !firebaseOptions.webAppId) {
        logger.error('❌ Web credentials not found in firebase_options.dart');
        logger.info('💡 Make sure the Firebase project has a Web app registered');
        return false;
      }

      logger.info(`✅ Found Web credentials:`);
      logger.keyValue('  webApiKey', firebaseOptions.webApiKey);
      logger.keyValue('  webAppId', firebaseOptions.webAppId);

      // Update Master Firebase
      logger.startSpinner('Updating Master Firebase...');
      const firestore = admin.firestore(this.masterApp);
      const docRef = firestore.collection('clients').doc(clientCode);

      await docRef.update({
        firebase_options: firebaseOptions,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.succeedSpinner(`✅ Credentials updated in Master Firebase for: ${clientCode}`);
      return true;
    } catch (error) {
      logger.error(`❌ Error fixing credentials for ${clientCode}: ${error.message}`);
      return false;
    }
  }

  // Fix all clients
  async fixAllClients() {
    try {
      const clientsDir = path.join(process.cwd(), 'clients');
      const clients = fs.readdirSync(clientsDir).filter((item) => {
        const itemPath = path.join(clientsDir, item);
        return fs.statSync(itemPath).isDirectory();
      });

      logger.section(`Found ${clients.length} clients`);
      logger.blank();

      const results = [];
      for (const client of clients) {
        const success = await this.fixClientCredentials(client);
        results.push({ client, success });
        logger.blank();
      }

      // Summary
      logger.section('Summary');
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      logger.info(`✅ Successful: ${successful}`);
      if (failed > 0) {
        logger.error(`❌ Failed: ${failed}`);
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
  const fixer = new WebCredentialsFixer();

  try {
    // Get client code from command line argument
    const clientCode = process.argv[2];

    logger.section('Web Credentials Fixer');
    logger.info('This script fixes missing Web API credentials for existing clients');
    logger.blank();

    // Initialize Master Firebase
    fixer.initializeMasterFirebase();

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
