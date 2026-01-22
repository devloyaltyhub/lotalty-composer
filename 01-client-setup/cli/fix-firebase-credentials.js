#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');
const firebaseManager = require('../shared/firebase-manager');
const { parseFirebaseOptions } = require('../shared/firebase-options-parser');
const { showCredentialsDiff } = require('../shared/credentials-diff');

/**
 * Fix Firebase credentials for existing clients in Master Firebase.
 * This script re-parses firebase_options.dart with corrected parsing logic
 * and updates platform-specific credentials (iOS, Android, Web) that were
 * incorrectly set due to the fallback bug.
 */

class FirebaseCredentialsFixer {
  constructor(dryRun = false) {
    this.dryRun = dryRun;
  }

  async initialize() {
    await firebaseManager.initializeMasterFirebase();
    logger.info('Master Firebase initialized');
  }

  async getCurrentCredentials(clientCode) {
    const firestore = await firebaseManager.getMasterFirestore();
    const docRef = firestore.collection('clients').doc(clientCode);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    return doc.data().firebase_options || null;
  }

  async fixClientCredentials(clientCode) {
    try {
      logger.section(`Processing: ${clientCode}`);

      const clientFolder = path.join(process.cwd(), 'clients', clientCode);
      if (!fs.existsSync(clientFolder)) {
        logger.error(`Client folder not found: ${clientFolder}`);
        return { success: false, hasChanges: false };
      }

      const optionsPath = path.join(clientFolder, 'lib', 'firebase_options.dart');
      if (!fs.existsSync(optionsPath)) {
        logger.error(`firebase_options.dart not found: ${optionsPath}`);
        return { success: false, hasChanges: false };
      }

      logger.info('Fetching current credentials from Master Firebase...');
      const oldCredentials = await this.getCurrentCredentials(clientCode);

      if (!oldCredentials) {
        logger.warn(`Client "${clientCode}" not found in Master Firebase`);
        return { success: false, hasChanges: false };
      }

      logger.info('Parsing firebase_options.dart with corrected logic...');
      const newCredentials = parseFirebaseOptions(optionsPath);

      const hasChanges = showCredentialsDiff(clientCode, oldCredentials, newCredentials);

      if (!hasChanges) {
        return { success: true, hasChanges: false };
      }

      if (this.dryRun) {
        logger.warn('DRY RUN: Would update Master Firebase with new credentials');
        return { success: true, hasChanges: true, dryRun: true };
      }

      logger.startSpinner('Updating Master Firebase...');
      const firestore = await firebaseManager.getMasterFirestore();
      const docRef = firestore.collection('clients').doc(clientCode);

      await docRef.update({
        firebase_options: newCredentials,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.succeedSpinner(`Credentials updated in Master Firebase for: ${clientCode}`);
      return { success: true, hasChanges: true };
    } catch (error) {
      logger.error(`Error processing ${clientCode}: ${error.message}`);
      return { success: false, hasChanges: false, error: error.message };
    }
  }

  async fixAllClients() {
    const clientsDir = path.join(process.cwd(), 'clients');

    if (!fs.existsSync(clientsDir)) {
      logger.error(`Clients directory not found: ${clientsDir}`);
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

    this.printSummary(results);
    return results;
  }

  printSummary(results) {
    logger.section('='.repeat(60));
    logger.section('SUMMARY');
    logger.section('='.repeat(60));

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const changed = results.filter((r) => r.hasChanges).length;

    logger.info(`Total clients: ${results.length}`);
    logger.success(`Successful: ${successful}`);

    if (changed > 0) {
      if (this.dryRun) {
        logger.warn(`Would change: ${changed} client(s)`);
      } else {
        logger.success(`Updated: ${changed} client(s)`);
      }
    } else {
      logger.success(`All credentials are correct!`);
    }

    if (failed > 0) {
      logger.error(`Failed: ${failed}`);
    }

    logger.blank();

    if (this.dryRun && changed > 0) {
      logger.section('To apply these changes, run:');
      logger.info('  node automation/01-client-setup/cli/fix-firebase-credentials.js --apply');
    }
  }

  cleanup() {
    firebaseManager.cleanup();
  }
}

async function main() {
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
      logger.warn('Running in DRY RUN mode - no changes will be made');
      logger.info('   To apply changes, add --apply flag');
      logger.blank();
    }

    await fixer.initialize();
    logger.blank();

    if (clientCode) {
      await fixer.fixClientCredentials(clientCode);
    } else {
      await fixer.fixAllClients();
    }

    logger.blank();
    logger.success('Done!');
    process.exit(0);
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  } finally {
    fixer.cleanup();
  }
}

main();
