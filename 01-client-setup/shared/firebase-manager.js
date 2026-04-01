const admin = require("firebase-admin");
const logger = require("../../shared/utils/logger");
const config = require("../config");
const {
  resolveServiceAccountPath,
  getMasterServiceAccountPath,
  getMasterProjectId,
} = require("./firebase-path-utils");
const {
  deployFirestoreRules,
  deployFirestoreIndexes,
} = require("./firebase-deploy-utils");
const dataUtils = require("./firebase-data-utils");

class FirebaseClient {
  constructor() {
    this.apps = new Map();
    this.masterApp = null;
    this.clientInitializing = new Map();
    this.maxConnections = config.firebase.maxConnections;
    this.lastUsed = new Map();
    this.initializationTimeouts = new Map();
    this.databaseIds = new Map();
  }

  initializeMasterFirebase() {
    if (!this.masterApp) {
      this._initializeMaster();
    }
    return this.masterApp;
  }

  _initializeMaster() {
    if (this.masterApp) {
      return this.masterApp;
    }

    const projectId = getMasterProjectId();
    const serviceAccountPath = getMasterServiceAccountPath();

    if (!projectId) {
      throw new Error("MASTER_FIREBASE_PROJECT_ID is not set");
    }

    if (!serviceAccountPath) {
      throw new Error(
        "MASTER_FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS is not set",
      );
    }

    const resolvedPath = resolveServiceAccountPath(serviceAccountPath);
    const serviceAccount = require(resolvedPath);

    this.masterApp = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId,
      },
      "master",
    );

    logger.info(`Master Firebase initialized: ${projectId}`);
    return this.masterApp;
  }

  async initializeClientFirebase(
    clientCode,
    firebaseOptions,
    customCredentialsPath = null,
  ) {
    if (this.apps.has(clientCode)) {
      this.lastUsed.set(clientCode, Date.now());
      return this.apps.get(clientCode);
    }

    if (this.clientInitializing.has(clientCode)) {
      await this.clientInitializing.get(clientCode);
      if (this.apps.has(clientCode)) {
        this.lastUsed.set(clientCode, Date.now());
        return this.apps.get(clientCode);
      }
      throw new Error(`Initialization failed for ${clientCode}`);
    }

    const initPromise = this._initializeClient(
      clientCode,
      firebaseOptions,
      customCredentialsPath,
    );
    this.clientInitializing.set(clientCode, initPromise);

    try {
      const timeoutPromise = new Promise((_, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Firebase initialization timeout for ${clientCode} after ${config.firebase.initializationTimeout}ms`,
            ),
          );
        }, config.firebase.initializationTimeout);
        this.initializationTimeouts.set(clientCode, timeout);
      });

      await Promise.race([initPromise, timeoutPromise]);
      this._clearTimeout(clientCode);
      return this.apps.get(clientCode);
    } catch (error) {
      this.apps.delete(clientCode);
      this.lastUsed.delete(clientCode);
      this._clearTimeout(clientCode);
      logger.error(
        `Failed to initialize Firebase for ${clientCode}: ${error.message}`,
      );
      throw error;
    } finally {
      this.clientInitializing.delete(clientCode);
    }
  }

  _clearTimeout(clientCode) {
    const timeout = this.initializationTimeouts.get(clientCode);
    if (timeout) {
      clearTimeout(timeout);
      this.initializationTimeouts.delete(clientCode);
    }
  }

  async _initializeClient(
    clientCode,
    firebaseOptions,
    customCredentialsPath = null,
  ) {
    if (this.apps.has(clientCode)) {
      this.lastUsed.set(clientCode, Date.now());
      return this.apps.get(clientCode);
    }

    if (this.apps.size >= this.maxConnections) {
      await this._evictLRU();
    }

    let serviceAccountPath;

    if (customCredentialsPath) {
      serviceAccountPath = customCredentialsPath;
      logger.info(`Using client-specific service account for ${clientCode}`);
    } else {
      serviceAccountPath = getMasterServiceAccountPath();
      if (!serviceAccountPath) {
        throw new Error(
          "MASTER_FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS is not set",
        );
      }
      logger.warn(
        `Using master service account for ${clientCode} (may cause auth issues)`,
      );
    }

    const resolvedPath = resolveServiceAccountPath(serviceAccountPath);
    const serviceAccount = require(resolvedPath);

    const app = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: firebaseOptions.projectId,
      },
      `client-${clientCode}`,
    );

    this.apps.set(clientCode, app);
    this.lastUsed.set(clientCode, Date.now());
    logger.info(
      `Client Firebase initialized: ${clientCode} (${this.apps.size}/${this.maxConnections} connections)`,
    );
    return app;
  }

  async _evictLRU() {
    if (this.apps.size === 0) return;

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

  async closeConnection(clientCode) {
    const app = this.apps.get(clientCode);
    if (!app) return;

    try {
      await app.delete();
      this.apps.delete(clientCode);
      this.lastUsed.delete(clientCode);
      logger.info(
        `Connection closed: ${clientCode} (${this.apps.size}/${this.maxConnections} connections)`,
      );
    } catch (error) {
      logger.warn(`Failed to close connection ${clientCode}: ${error.message}`);
    }
  }

  getMasterFirestore() {
    if (!this.masterApp) {
      this.initializeMasterFirebase();
    }
    return admin.firestore(this.masterApp);
  }

  getClientFirestore(clientCode) {
    const app = this.apps.get(clientCode);
    if (!app) {
      throw new Error(`Client app not initialized: ${clientCode}`);
    }

    const databaseId = this.databaseIds.get(clientCode);
    if (databaseId) {
      const { getFirestore } = require("firebase-admin/firestore");
      return getFirestore(app, databaseId);
    }

    return admin.firestore(app);
  }

  async saveClientToMaster(
    clientCode,
    firebaseOptions,
    isActive = true,
    tinifyApiKey = null,
    planType = "profissional",
  ) {
    const firestore = this.getMasterFirestore();
    return dataUtils.saveClientToMaster(
      firestore,
      clientCode,
      firebaseOptions,
      isActive,
      tinifyApiKey,
      planType,
    );
  }

  async updateClientPlan(clientCode, newPlanType, previousPlanType = null) {
    const firestore = this.getMasterFirestore();
    return dataUtils.updateClientPlan(
      firestore,
      clientCode,
      newPlanType,
      previousPlanType,
    );
  }

  async getAllClients(activeOnly = true) {
    const firestore = this.getMasterFirestore();
    return dataUtils.getAllClients(firestore, activeOnly);
  }

  async getClientFromMaster(clientCode) {
    const firestore = this.getMasterFirestore();
    return dataUtils.getClientFromMaster(firestore, clientCode);
  }

  async clientExists(clientCode) {
    const firestore = this.getMasterFirestore();
    return dataUtils.clientExists(firestore, clientCode);
  }

  seedClientData(clientCode, data) {
    const firestore = this.getClientFirestore(clientCode);
    return dataUtils.seedClientData(firestore, data);
  }

  createAdminUser(clientCode, adminData) {
    const firestore = this.getClientFirestore(clientCode);
    return dataUtils.createAdminUser(firestore, adminData);
  }

  deployFirestoreRules(projectId, rulesFilePath) {
    return deployFirestoreRules(projectId, rulesFilePath);
  }

  deployFirestoreIndexes(projectId, indexesFilePath) {
    return deployFirestoreIndexes(projectId, indexesFilePath);
  }

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

module.exports = new FirebaseClient();
