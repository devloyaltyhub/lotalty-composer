const admin = require('firebase-admin');
const logger = require('../../shared/utils/logger');
const config = require('../config');

class FirebaseClient {
  constructor() {
    this.apps = new Map();
    this.masterApp = null;
    this.masterInitializing = null; // Lock for master initialization
    this.clientInitializing = new Map(); // Locks for client initializations
    this.maxConnections = config.firebase.maxConnections; // Maximum simultaneous connections
    this.lastUsed = new Map(); // Track last access time for LRU eviction
    this.initializationTimeouts = new Map(); // Track initialization timeouts
    this.databaseIds = new Map(); // Store databaseId per client for named databases
  }

  // Initialize Master Firebase (for storing client credentials)
  async initializeMasterFirebase() {
    // If already initialized, return immediately
    if (this.masterApp) {
      return this.masterApp;
    }

    // If currently initializing, wait for that to complete
    if (this.masterInitializing) {
      await this.masterInitializing;
      return this.masterApp;
    }

    // Start initialization and store the promise as a lock
    this.masterInitializing = this._initializeMaster();

    try {
      await this.masterInitializing;
      return this.masterApp;
    } finally {
      this.masterInitializing = null;
    }
  }

  // Internal method to actually initialize master
  _initializeMaster() {
    return new Promise((resolve, reject) => {
      // Double-check in case another thread finished while we were waiting
      if (this.masterApp) {
        resolve(this.masterApp);
        return;
      }

      const projectId = process.env.MASTER_FIREBASE_PROJECT_ID;
      let serviceAccountPath =
        process.env.MASTER_FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;

      if (!projectId) {
        reject(new Error('MASTER_FIREBASE_PROJECT_ID is not set'));
        return;
      }

      if (!serviceAccountPath) {
        reject(
          new Error('MASTER_FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS is not set')
        );
        return;
      }

      try {
        // Resolve path relative to automation root (where .env is located)
        const path = require('path');
        const automationRoot = path.resolve(__dirname, '../..');

        // Expand environment variables like $HOME, $USER, etc.
        serviceAccountPath = serviceAccountPath.replace(
          /\$([A-Z_][A-Z0-9_]*)/g,
          (match, varName) => {
            return process.env[varName] || match;
          }
        );

        // If path is relative, resolve it from automation root
        if (!path.isAbsolute(serviceAccountPath)) {
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

        logger.info(`Master Firebase initialized: ${projectId}`);
        resolve(this.masterApp);
      } catch (error) {
        reject(new Error(`Failed to initialize Master Firebase: ${error.message}`));
      }
    });
  }

  // Initialize a client Firebase app
  // databaseId: optional named database (e.g., 'narede'). If not provided, uses '(default)'
  async initializeClientFirebase(
    clientCode,
    firebaseOptions,
    customCredentialsPath = null,
  ) {
    // CRITICAL FIX: Check and set lock atomically to prevent race condition
    // If already initialized, return immediately
    if (this.apps.has(clientCode)) {
      this.lastUsed.set(clientCode, Date.now()); // Update last used time
      return this.apps.get(clientCode);
    }

    // If currently initializing, wait for that to complete
    if (this.clientInitializing.has(clientCode)) {
      await this.clientInitializing.get(clientCode);
      // Double check if initialization succeeded
      if (this.apps.has(clientCode)) {
        this.lastUsed.set(clientCode, Date.now());
        return this.apps.get(clientCode);
      }
      throw new Error(`Initialization failed for ${clientCode}`);
    }

    // Create initialization promise and set lock IMMEDIATELY (before any await)
    const initPromise = this._initializeClient(clientCode, firebaseOptions, customCredentialsPath);
    this.clientInitializing.set(clientCode, initPromise);

    try {
      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Firebase initialization timeout for ${clientCode} after ${config.firebase.initializationTimeout}ms`
            )
          );
        }, config.firebase.initializationTimeout);
        this.initializationTimeouts.set(clientCode, timeout);
      });

      await Promise.race([initPromise, timeoutPromise]);

      // Clear timeout
      const timeout = this.initializationTimeouts.get(clientCode);
      if (timeout) {
        clearTimeout(timeout);
        this.initializationTimeouts.delete(clientCode);
      }

      return this.apps.get(clientCode);
    } catch (error) {
      // CRITICAL FIX: Cleanup on error to prevent broken connections
      this.apps.delete(clientCode);
      this.lastUsed.delete(clientCode);

      // Clear timeout
      const timeout = this.initializationTimeouts.get(clientCode);
      if (timeout) {
        clearTimeout(timeout);
        this.initializationTimeouts.delete(clientCode);
      }

      logger.error(`Failed to initialize Firebase for ${clientCode}: ${error.message}`);
      throw error;
    } finally {
      this.clientInitializing.delete(clientCode);
    }
  }

  // Internal method to actually initialize client
  async _initializeClient(clientCode, firebaseOptions, customCredentialsPath = null) {
    return new Promise(async (resolve, reject) => {
      // Double-check in case another thread finished while we were waiting
      if (this.apps.has(clientCode)) {
        this.lastUsed.set(clientCode, Date.now()); // Update last used time
        resolve(this.apps.get(clientCode));
        return;
      }

      try {
        // Check if we need to evict a connection to make room
        if (this.apps.size >= this.maxConnections) {
          await this._evictLRU();
        }

        // Determine which service account to use
        let serviceAccountPath;

        if (customCredentialsPath) {
          // Use custom credentials (client-specific service account)
          serviceAccountPath = customCredentialsPath;
          logger.info(`Using client-specific service account for ${clientCode}`);
        } else {
          // Fall back to master service account (old behavior for backward compatibility)
          serviceAccountPath =
            process.env.MASTER_FIREBASE_SERVICE_ACCOUNT ||
            process.env.GOOGLE_APPLICATION_CREDENTIALS;

          if (!serviceAccountPath) {
            reject(
              new Error(
                'MASTER_FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS is not set'
              )
            );
            return;
          }

          logger.warn(`Using master service account for ${clientCode} (may cause auth issues)`);
        }

        // Resolve path relative to automation root
        const path = require('path');
        const automationRoot = path.resolve(__dirname, '../..');

        // Expand environment variables like $HOME, $USER, etc.
        serviceAccountPath = serviceAccountPath.replace(
          /\$([A-Z_][A-Z0-9_]*)/g,
          (match, varName) => {
            return process.env[varName] || match;
          }
        );

        // If path is relative, resolve it from automation root
        if (!path.isAbsolute(serviceAccountPath)) {
          serviceAccountPath = path.resolve(automationRoot, serviceAccountPath);
        }

        const serviceAccount = require(serviceAccountPath);

        const app = admin.initializeApp(
          {
            credential: admin.credential.cert(serviceAccount),
            projectId: firebaseOptions.projectId,
          },
          `client-${clientCode}`
        );

        this.apps.set(clientCode, app);
        this.lastUsed.set(clientCode, Date.now());
        logger.info(
          `Client Firebase initialized: ${clientCode} (${this.apps.size}/${this.maxConnections} connections)`
        );
        resolve(app);
      } catch (error) {
        reject(new Error(`Failed to initialize client Firebase: ${error.message}`));
      }
    });
  }

  // Evict the least recently used connection
  async _evictLRU() {
    if (this.apps.size === 0) {
      return;
    }

    // Find the least recently used connection
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [clientCode, timestamp] of this.lastUsed.entries()) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestKey = clientCode;
      }
    }

    if (oldestKey) {
      await this.closeConnection(oldestKey);
    }
  }

  // Close a specific connection
  async closeConnection(clientCode) {
    const app = this.apps.get(clientCode);

    if (app) {
      try {
        await app.delete();
        this.apps.delete(clientCode);
        this.lastUsed.delete(clientCode);
        logger.info(
          `Connection closed: ${clientCode} (${this.apps.size}/${this.maxConnections} connections)`
        );
      } catch (error) {
        logger.warn(`Failed to close connection ${clientCode}: ${error.message}`);
      }
    }
  }

  // Get Master Firestore
  async getMasterFirestore() {
    if (!this.masterApp) {
      await this.initializeMasterFirebase();
    }
    return admin.firestore(this.masterApp);
  }

  // Get Client Firestore
  // Automatically uses named database if one was configured during initialization
  getClientFirestore(clientCode) {
    const app = this.apps.get(clientCode);
    if (!app) {
      throw new Error(`Client app not initialized: ${clientCode}`);
    }

    // Check if this client uses a named database
    const databaseId = this.databaseIds.get(clientCode);
    if (databaseId) {
      // Use getFirestore with databaseId for named databases
      const { getFirestore } = require('firebase-admin/firestore');
      return getFirestore(app, databaseId);
    }

    return admin.firestore(app);
  }

  // Save client credentials to Master Firebase
  async saveClientToMaster(clientCode, firebaseOptions, isActive = true, tinifyApiKey = null) {
    logger.startSpinner('Saving client to Master Firebase...');

    try {
      const firestore = await this.getMasterFirestore();

      const clientData = {
        isActive: isActive,
        firebase_options: firebaseOptions,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Add tinifyApiKey if provided
      if (tinifyApiKey) {
        clientData.tinifyApiKey = tinifyApiKey;
      }

      await firestore.collection('clients').doc(clientCode).set(clientData);

      logger.succeedSpinner(`Client ${clientCode} saved to Master Firebase`);
      return true;
    } catch (error) {
      logger.failSpinner(`Failed to save client: ${error.message}`);
      throw error;
    }
  }

  // Get client from Master Firebase
  async getClientFromMaster(clientCode) {
    try {
      const firestore = await this.getMasterFirestore();
      const doc = await firestore.collection('clients').doc(clientCode).get();

      if (!doc.exists) {
        return null;
      }

      return doc.data();
    } catch (error) {
      logger.error(`Failed to get client: ${error.message}`);
      throw error;
    }
  }

  // Check if client code exists
  async clientExists(clientCode) {
    const client = await this.getClientFromMaster(clientCode);
    return client !== null;
  }

  // Seed data to client Firestore
  async seedClientData(clientCode, data) {
    logger.startSpinner('Seeding default data to client Firestore...');

    try {
      const firestore = this.getClientFirestore(clientCode);
      const batch = firestore.batch();

      // Add all documents from data
      for (const [collection, documents] of Object.entries(data)) {
        for (const [docId, docData] of Object.entries(documents)) {
          const ref = firestore.collection(collection).doc(docId);
          batch.set(ref, docData);
        }
      }

      await batch.commit();
      logger.succeedSpinner('Default data seeded successfully');
      return true;
    } catch (error) {
      logger.failSpinner(`Failed to seed data: ${error.message}`);
      throw error;
    }
  }

  // Create admin user in client Firestore
  async createAdminUser(clientCode, adminData) {
    logger.startSpinner('Creating admin user...');

    try {
      const firestore = this.getClientFirestore(clientCode);

      await firestore.collection('Admin_Users').add({
        ...adminData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.succeedSpinner('Admin user created successfully');
      return true;
    } catch (error) {
      logger.failSpinner(`Failed to create admin user: ${error.message}`);
      throw error;
    }
  }

  // Deploy Firestore rules
  async deployFirestoreRules(projectId, rulesFilePath) {
    logger.startSpinner('Deploying Firestore security rules...');

    const { execSync } = require('child_process');
    const fs = require('fs');

    try {
      // Check if rules file exists
      if (!fs.existsSync(rulesFilePath)) {
        throw new Error(`Rules file not found: ${rulesFilePath}`);
      }

      // Deploy using Firebase CLI
      execSync(`firebase deploy --only firestore:rules --project ${projectId}`, {
        cwd: require('path').dirname(rulesFilePath),
        stdio: 'pipe',
      });

      logger.succeedSpinner('Firestore rules deployed successfully');
      return true;
    } catch (error) {
      logger.failSpinner(`Failed to deploy rules: ${error.message}`);
      throw error;
    }
  }

  // Cleanup - delete Firebase app instances
  cleanup() {
    this.apps.forEach((app, clientCode) => {
      app.delete().catch((err) => {
        logger.warn(`Failed to cleanup app ${clientCode}: ${err.message}`);
      });
    });
    this.apps.clear();

    if (this.masterApp) {
      this.masterApp.delete().catch((err) => {
        logger.warn(`Failed to cleanup master app: ${err.message}`);
      });
      this.masterApp = null;
    }
  }
}

// Export singleton instance
module.exports = new FirebaseClient();
