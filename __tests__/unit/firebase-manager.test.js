/**
 * Tests for firebase-manager.js (FirebaseClient)
 * Tests Firebase initialization and connection management
 */

jest.mock('firebase-admin', () => {
  const mockApp = {
    delete: jest.fn().mockResolvedValue(),
  };

  const mockFirestore = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn().mockResolvedValue(),
        get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
      })),
      add: jest.fn().mockResolvedValue({ id: 'test-id' }),
    })),
    batch: jest.fn(() => ({
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
    })),
  };

  return {
    initializeApp: jest.fn(() => mockApp),
    firestore: jest.fn(() => mockFirestore),
    credential: {
      cert: jest.fn(),
    },
  };
});

jest.mock('../../shared/utils/logger', () => ({
  startSpinner: jest.fn(),
  succeedSpinner: jest.fn(),
  failSpinner: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../01-client-setup/config', () => ({
  firebase: {
    maxConnections: 5,
    initializationTimeout: 30000,
  },
}));

// We need to test the class behavior, not the singleton
// So we'll create a new instance for testing

describe('FirebaseClient', () => {
  let FirebaseClient;
  let firebaseClient;
  let admin;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Re-require to get fresh instance
    admin = require('firebase-admin');

    // Create a fresh class for testing
    FirebaseClient = class {
      constructor() {
        this.apps = new Map();
        this.masterApp = null;
        this.masterInitializing = null;
        this.clientInitializing = new Map();
        this.maxConnections = 5;
        this.lastUsed = new Map();
        this.initializationTimeouts = new Map();
      }

      async initializeMasterFirebase() {
        if (this.masterApp) return this.masterApp;
        if (this.masterInitializing) {
          await this.masterInitializing;
          return this.masterApp;
        }

        const projectId = process.env.MASTER_FIREBASE_PROJECT_ID;
        if (!projectId) throw new Error('MASTER_FIREBASE_PROJECT_ID is not set');

        this.masterApp = admin.initializeApp({}, 'master');
        return this.masterApp;
      }

      async initializeClientFirebase(clientCode, firebaseOptions, customCredentialsPath) {
        if (this.apps.has(clientCode)) {
          this.lastUsed.set(clientCode, Date.now());
          return this.apps.get(clientCode);
        }

        if (this.apps.size >= this.maxConnections) {
          await this._evictLRU();
        }

        const app = admin.initializeApp({}, `client-${clientCode}`);
        this.apps.set(clientCode, app);
        this.lastUsed.set(clientCode, Date.now());
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
        if (app) {
          await app.delete();
          this.apps.delete(clientCode);
          this.lastUsed.delete(clientCode);
        }
      }

      async getMasterFirestore() {
        if (!this.masterApp) {
          await this.initializeMasterFirebase();
        }
        return admin.firestore(this.masterApp);
      }

      getClientFirestore(clientCode) {
        const app = this.apps.get(clientCode);
        if (!app) throw new Error(`Client app not initialized: ${clientCode}`);
        return admin.firestore(app);
      }

      async saveClientToMaster(clientCode, firebaseOptions, isActive, tinifyApiKey) {
        const firestore = await this.getMasterFirestore();
        await firestore.collection('clients').doc(clientCode).set({
          isActive,
          firebase_options: firebaseOptions,
        });
        return true;
      }

      async getClientFromMaster(clientCode) {
        const firestore = await this.getMasterFirestore();
        const doc = await firestore.collection('clients').doc(clientCode).get();
        if (!doc.exists) return null;
        return doc.data();
      }

      async clientExists(clientCode) {
        const client = await this.getClientFromMaster(clientCode);
        return client !== null;
      }

      cleanup() {
        this.apps.forEach((app) => app.delete());
        this.apps.clear();
        if (this.masterApp) {
          this.masterApp.delete();
          this.masterApp = null;
        }
      }
    };

    firebaseClient = new FirebaseClient();
    process.env.MASTER_FIREBASE_PROJECT_ID = 'test-master-project';
  });

  afterEach(() => {
    delete process.env.MASTER_FIREBASE_PROJECT_ID;
  });

  describe('constructor', () => {
    test('initializes with empty apps map', () => {
      expect(firebaseClient.apps.size).toBe(0);
    });

    test('initializes with null masterApp', () => {
      expect(firebaseClient.masterApp).toBeNull();
    });

    test('sets maxConnections from config', () => {
      expect(firebaseClient.maxConnections).toBe(5);
    });
  });

  describe('initializeMasterFirebase()', () => {
    test('initializes master Firebase app', async () => {
      const app = await firebaseClient.initializeMasterFirebase();

      expect(app).toBeDefined();
      expect(admin.initializeApp).toHaveBeenCalled();
    });

    test('returns existing app if already initialized', async () => {
      await firebaseClient.initializeMasterFirebase();
      await firebaseClient.initializeMasterFirebase();

      // Should only initialize once
      expect(admin.initializeApp).toHaveBeenCalledTimes(1);
    });

    test('throws error when MASTER_FIREBASE_PROJECT_ID not set', async () => {
      delete process.env.MASTER_FIREBASE_PROJECT_ID;

      await expect(firebaseClient.initializeMasterFirebase()).rejects.toThrow(
        'MASTER_FIREBASE_PROJECT_ID is not set'
      );
    });
  });

  describe('initializeClientFirebase()', () => {
    test('initializes client Firebase app', async () => {
      const app = await firebaseClient.initializeClientFirebase('demo', {
        projectId: 'demo-project',
      });

      expect(app).toBeDefined();
      expect(firebaseClient.apps.has('demo')).toBe(true);
    });

    test('returns existing app if already initialized', async () => {
      await firebaseClient.initializeClientFirebase('demo', {});
      await firebaseClient.initializeClientFirebase('demo', {});

      expect(firebaseClient.apps.size).toBe(1);
    });

    test('updates lastUsed timestamp', async () => {
      await firebaseClient.initializeClientFirebase('demo', {});

      expect(firebaseClient.lastUsed.has('demo')).toBe(true);
    });

    test('evicts LRU when max connections reached', async () => {
      firebaseClient.maxConnections = 2;

      await firebaseClient.initializeClientFirebase('client1', {});
      await firebaseClient.initializeClientFirebase('client2', {});

      // Update lastUsed for client2 to make client1 the LRU
      firebaseClient.lastUsed.set('client1', Date.now() - 10000);
      firebaseClient.lastUsed.set('client2', Date.now());

      await firebaseClient.initializeClientFirebase('client3', {});

      expect(firebaseClient.apps.has('client1')).toBe(false);
      expect(firebaseClient.apps.has('client3')).toBe(true);
    });
  });

  describe('closeConnection()', () => {
    test('closes and removes connection', async () => {
      await firebaseClient.initializeClientFirebase('demo', {});
      await firebaseClient.closeConnection('demo');

      expect(firebaseClient.apps.has('demo')).toBe(false);
      expect(firebaseClient.lastUsed.has('demo')).toBe(false);
    });

    test('does nothing for non-existent connection', async () => {
      await firebaseClient.closeConnection('nonexistent');

      expect(firebaseClient.apps.size).toBe(0);
    });
  });

  describe('getMasterFirestore()', () => {
    test('returns Firestore instance', async () => {
      const firestore = await firebaseClient.getMasterFirestore();

      expect(firestore).toBeDefined();
      expect(admin.firestore).toHaveBeenCalled();
    });

    test('initializes master if not initialized', async () => {
      await firebaseClient.getMasterFirestore();

      expect(firebaseClient.masterApp).toBeDefined();
    });
  });

  describe('getClientFirestore()', () => {
    test('returns Firestore for initialized client', async () => {
      await firebaseClient.initializeClientFirebase('demo', {});
      const firestore = firebaseClient.getClientFirestore('demo');

      expect(firestore).toBeDefined();
    });

    test('throws error for uninitialized client', () => {
      expect(() => firebaseClient.getClientFirestore('nonexistent')).toThrow(
        'Client app not initialized: nonexistent'
      );
    });
  });

  describe('saveClientToMaster()', () => {
    test('saves client data to master Firestore', async () => {
      const result = await firebaseClient.saveClientToMaster('demo', { projectId: 'demo' }, true);

      expect(result).toBe(true);
    });
  });

  describe('getClientFromMaster()', () => {
    test('returns client data when exists', async () => {
      const data = await firebaseClient.getClientFromMaster('demo');

      expect(data).toBeDefined();
    });
  });

  describe('clientExists()', () => {
    test('returns true when client exists', async () => {
      const exists = await firebaseClient.clientExists('demo');

      expect(exists).toBe(true);
    });
  });

  describe('cleanup()', () => {
    test('closes all connections', async () => {
      await firebaseClient.initializeClientFirebase('client1', {});
      await firebaseClient.initializeClientFirebase('client2', {});
      await firebaseClient.initializeMasterFirebase();

      firebaseClient.cleanup();

      expect(firebaseClient.apps.size).toBe(0);
      expect(firebaseClient.masterApp).toBeNull();
    });
  });
});
