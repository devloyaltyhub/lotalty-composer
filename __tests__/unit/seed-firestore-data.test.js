/**
 * Tests for seed-firestore-data.js (DataSeeder)
 * Tests Firestore data seeding operations
 */

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

jest.mock('firebase-admin', () => {
  const mockBatch = {
    set: jest.fn(),
    commit: jest.fn().mockResolvedValue(),
  };

  const mockCollection = {
    doc: jest.fn(() => ({ id: 'mock-doc-id' })),
  };

  const mockFirestore = {
    collection: jest.fn(() => mockCollection),
    batch: jest.fn(() => mockBatch),
  };

  return {
    firestore: jest.fn(() => mockFirestore),
    credential: {
      cert: jest.fn(),
    },
    initializeApp: jest.fn(),
  };
});

jest.mock('../../shared/utils/logger', () => ({
  startSpinner: jest.fn(),
  updateSpinner: jest.fn(),
  succeedSpinner: jest.fn(),
  failSpinner: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
}));

const fs = require('fs');
const admin = require('firebase-admin');
const DataSeeder = require('../../01-client-setup/steps/seed-firestore-data');
const logger = require('../../shared/utils/logger');

describe('DataSeeder', () => {
  let seeder;
  let mockFirebaseApp;
  let mockFirestore;
  let mockBatch;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBatch = {
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
    };

    mockFirestore = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ id: 'mock-doc-id' })),
      })),
      batch: jest.fn(() => mockBatch),
    };

    admin.firestore.mockReturnValue(mockFirestore);
    admin.firestore.FieldValue = {
      serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
    };

    mockFirebaseApp = { name: 'test-app' };
    seeder = new DataSeeder(mockFirebaseApp);
  });

  describe('constructor', () => {
    test('initializes with Firebase app', () => {
      expect(seeder.app).toBe(mockFirebaseApp);
      expect(seeder.firestore).toBeDefined();
    });

    test('calls admin.firestore with app', () => {
      expect(admin.firestore).toHaveBeenCalledWith(mockFirebaseApp);
    });
  });

  describe('loadTemplate()', () => {
    test('loads template from shared/templates directory', () => {
      const mockTemplate = { users: { admin: { name: 'Admin' } } };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));

      const result = seeder.loadTemplate();

      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('default-data.json'),
        'utf8'
      );
      expect(result).toEqual(mockTemplate);
    });

    test('throws error when template not found', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => seeder.loadTemplate()).toThrow('File not found');
    });

    test('throws error when template is invalid JSON', () => {
      fs.readFileSync.mockReturnValue('invalid json');

      expect(() => seeder.loadTemplate()).toThrow();
    });
  });

  describe('replaceVariables()', () => {
    test('replaces single variable', () => {
      const data = { name: '{{CLIENT_NAME}}' };
      const variables = { CLIENT_NAME: 'Demo Client' };

      const result = seeder.replaceVariables(data, variables);

      expect(result.name).toBe('Demo Client');
    });

    test('replaces multiple variables', () => {
      const data = {
        name: '{{CLIENT_NAME}}',
        type: '{{BUSINESS_TYPE}}',
      };
      const variables = {
        CLIENT_NAME: 'Demo',
        BUSINESS_TYPE: 'coffee',
      };

      const result = seeder.replaceVariables(data, variables);

      expect(result.name).toBe('Demo');
      expect(result.type).toBe('coffee');
    });

    test('replaces nested variables', () => {
      const data = {
        config: {
          app: {
            name: '{{CLIENT_NAME}}',
          },
        },
      };
      const variables = { CLIENT_NAME: 'Nested Demo' };

      const result = seeder.replaceVariables(data, variables);

      expect(result.config.app.name).toBe('Nested Demo');
    });

    test('replaces variables in arrays', () => {
      const data = {
        items: ['{{CLIENT_NAME}}', '{{BUSINESS_TYPE}}'],
      };
      const variables = {
        CLIENT_NAME: 'Demo',
        BUSINESS_TYPE: 'restaurant',
      };

      const result = seeder.replaceVariables(data, variables);

      expect(result.items).toEqual(['Demo', 'restaurant']);
    });

    test('handles missing variables by keeping placeholder', () => {
      const data = { name: '{{MISSING_VAR}}' };
      const variables = {};

      const result = seeder.replaceVariables(data, variables);

      expect(result.name).toBe('{{MISSING_VAR}}');
    });
  });

  describe('processTimestamps()', () => {
    test('converts {{TIMESTAMP}} to server timestamp', () => {
      const obj = { createdAt: '{{TIMESTAMP}}' };

      const result = seeder.processTimestamps(obj);

      expect(result.createdAt).toEqual({ _serverTimestamp: true });
      expect(admin.firestore.FieldValue.serverTimestamp).toHaveBeenCalled();
    });

    test('processes nested timestamps', () => {
      const obj = {
        metadata: {
          createdAt: '{{TIMESTAMP}}',
        },
      };

      const result = seeder.processTimestamps(obj);

      expect(result.metadata.createdAt).toEqual({ _serverTimestamp: true });
    });

    test('processes timestamps in arrays', () => {
      const obj = {
        items: [
          { createdAt: '{{TIMESTAMP}}' },
          { createdAt: '{{TIMESTAMP}}' },
        ],
      };

      const result = seeder.processTimestamps(obj);

      expect(result.items[0].createdAt).toEqual({ _serverTimestamp: true });
      expect(result.items[1].createdAt).toEqual({ _serverTimestamp: true });
    });

    test('returns primitive values unchanged', () => {
      expect(seeder.processTimestamps('string')).toBe('string');
      expect(seeder.processTimestamps(123)).toBe(123);
      expect(seeder.processTimestamps(true)).toBe(true);
      expect(seeder.processTimestamps(null)).toBe(null);
    });

    test('preserves non-timestamp values', () => {
      const obj = {
        name: 'Test',
        count: 5,
        active: true,
      };

      const result = seeder.processTimestamps(obj);

      expect(result.name).toBe('Test');
      expect(result.count).toBe(5);
      expect(result.active).toBe(true);
    });
  });

  describe('seedData()', () => {
    const mockTemplate = {
      users: {
        admin: { name: '{{CLIENT_NAME}}', createdAt: '{{TIMESTAMP}}' },
      },
      settings: {
        config: { type: '{{BUSINESS_TYPE}}' },
      },
    };

    const variables = {
      CLIENT_NAME: 'Demo Client',
      BUSINESS_TYPE: 'coffee',
    };

    beforeEach(() => {
      fs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
    });

    test('seeds data successfully', async () => {
      const result = await seeder.seedData(variables);

      expect(result.success).toBe(true);
      expect(result.collections).toBe(2);
      expect(result.documents).toBe(2);
    });

    test('calls batch.set for each document', async () => {
      await seeder.seedData(variables);

      expect(mockBatch.set).toHaveBeenCalledTimes(2);
    });

    test('commits batch', async () => {
      await seeder.seedData(variables);

      expect(mockBatch.commit).toHaveBeenCalled();
    });

    test('shows spinner progress', async () => {
      await seeder.seedData(variables);

      expect(logger.startSpinner).toHaveBeenCalled();
      expect(logger.updateSpinner).toHaveBeenCalled();
      expect(logger.succeedSpinner).toHaveBeenCalled();
    });

    test('throws error on batch commit failure', async () => {
      mockBatch.commit.mockRejectedValue(new Error('Commit failed'));

      await expect(seeder.seedData(variables)).rejects.toThrow('Commit failed');
      expect(logger.failSpinner).toHaveBeenCalled();
    });

    test('throws error on template load failure', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Template not found');
      });

      await expect(seeder.seedData(variables)).rejects.toThrow('Template not found');
    });
  });

  describe('seedWithDefaults()', () => {
    const mockTemplate = {
      config: {
        main: { name: '{{CLIENT_NAME}}', type: '{{BUSINESS_TYPE}}' },
      },
    };

    beforeEach(() => {
      fs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
    });

    test('seeds with default variables', async () => {
      const result = await seeder.seedWithDefaults('Test Client');

      expect(result.success).toBe(true);
    });

    test('uses provided businessType', async () => {
      await seeder.seedWithDefaults('Test', 'beer');

      expect(mockBatch.set).toHaveBeenCalled();
    });

    test('uses provided primaryColor', async () => {
      await seeder.seedWithDefaults('Test', 'coffee', '#123456');

      expect(mockBatch.set).toHaveBeenCalled();
    });

    test('uses default businessType when not provided', async () => {
      await seeder.seedWithDefaults('Test');

      // businessType defaults to 'restaurant'
      expect(mockBatch.set).toHaveBeenCalled();
    });

    test('uses default primaryColor when not provided', async () => {
      await seeder.seedWithDefaults('Test', 'coffee');

      // primaryColor defaults to '#FF5733'
      expect(mockBatch.set).toHaveBeenCalled();
    });
  });
});
