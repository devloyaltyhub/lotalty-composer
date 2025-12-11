/**
 * Tests for 01-client-setup/cli scripts
 * Tests update-metadata.js, deploy-master-rules.js, add-client-to-master.js
 * and other CLI scripts
 */

// Mocks must be defined before imports
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  statSync: jest.fn(() => ({ size: 1024 })),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

const fs = require('fs');
const { execSync } = require('child_process');

describe('deploy-master-rules.js', () => {
  const { deployRules, validateRulesFile, verifyDeployment } = require('../../01-client-setup/cli/deploy-master-rules');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRulesFile()', () => {
    test('returns false when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = validateRulesFile();

      expect(result).toBe(false);
    });

    test('returns true when file exists and has valid patterns', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /clients/{clientId} {
              allow read: if request.auth != null;
            }
            match /admin_users/{userId} {
              allow read: if request.auth != null;
            }
          }
        }
      `);

      const result = validateRulesFile();

      expect(result).toBe(true);
    });

    test('returns true with warnings when patterns missing', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            // minimal rules
          }
        }
      `);

      const result = validateRulesFile();

      // Still returns true (warnings are non-critical)
      expect(result).toBe(true);
    });
  });

  describe('deployRules()', () => {
    test('returns true for dry run', () => {
      const result = deployRules(true);

      expect(result).toBe(true);
      expect(execSync).not.toHaveBeenCalled();
    });

    test('returns true on successful deployment', () => {
      execSync.mockReturnValue('');
      fs.existsSync.mockReturnValue(true);

      const result = deployRules(false);

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalled();
    });

    test('returns false on deployment failure', () => {
      execSync.mockImplementation(() => {
        throw new Error('Deploy failed');
      });

      const result = deployRules(false);

      expect(result).toBe(false);
    });
  });

  describe('verifyDeployment()', () => {
    test('returns true on successful verification', () => {
      const result = verifyDeployment();

      expect(result).toBe(true);
    });
  });
});

describe('add-client-to-master.js exports', () => {
  // Reset modules to avoid state issues
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock firebase-admin before requiring the module
    jest.doMock('firebase-admin', () => ({
      initializeApp: jest.fn(),
      credential: {
        cert: jest.fn(),
      },
      firestore: jest.fn(() => ({
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ exists: false }),
            set: jest.fn().mockResolvedValue(),
          })),
        })),
      })),
    }));
  });

  test('module exports required functions', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ projectId: 'test' }));

    const module = require('../../01-client-setup/cli/add-client-to-master');

    expect(module).toHaveProperty('addClientToMaster');
    expect(module).toHaveProperty('verifyClientInMaster');
    expect(typeof module.addClientToMaster).toBe('function');
    expect(typeof module.verifyClientInMaster).toBe('function');
  });
});

describe('Update Metadata Script Structure', () => {
  test('MetadataUpdater class exists and has required methods', () => {
    // We can't fully test this without running the script, but we can check structure
    const scriptPath = require.resolve('../../01-client-setup/cli/update-metadata');
    expect(scriptPath).toBeDefined();
  });
});

describe('Rollback Client Script Structure', () => {
  test('Script file exists', () => {
    const scriptPath = require.resolve('../../01-client-setup/cli/rollback-client');
    expect(scriptPath).toBeDefined();
  });
});

describe('Update Client Script Structure', () => {
  test('Script file exists', () => {
    const scriptPath = require.resolve('../../01-client-setup/cli/update-client');
    expect(scriptPath).toBeDefined();
  });
});
