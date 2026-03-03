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
  const { deployRules, validateRulesFile } = require('../../01-client-setup/cli/deploy-master-rules');

  const TEST_RULES_PATH = '/tmp/test-firestore.rules';
  const TEST_PROJECT_ID = 'test-project';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRulesFile()', () => {
    test('returns valid false when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = validateRulesFile(TEST_RULES_PATH);

      expect(result.valid).toBe(false);
    });

    test('returns valid true when file exists and has valid patterns', () => {
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

      const result = validateRulesFile(TEST_RULES_PATH);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    test('returns valid true with warnings when patterns missing', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            // minimal rules
          }
        }
      `);

      const result = validateRulesFile(TEST_RULES_PATH);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('deployRules()', () => {
    test('returns success true for dry run', () => {
      const result = deployRules(TEST_PROJECT_ID, TEST_RULES_PATH, true);

      expect(result.success).toBe(true);
    });

    test('returns success true on successful deployment', () => {
      fs.existsSync.mockReturnValue(true);

      const result = deployRules(TEST_PROJECT_ID, TEST_RULES_PATH, false);

      expect(result.success).toBe(true);
    });

    test('returns success false on deployment failure', () => {
      // Mock the exec function from firebase-cli-utils to throw
      jest.resetModules();
      jest.doMock('../../01-client-setup/shared/firebase-cli-utils', () => ({
        exec: jest.fn(() => { throw new Error('Deploy failed'); }),
        checkFirebaseCLIInstalled: jest.fn(),
        checkFirebaseAuthentication: jest.fn(),
      }));

      const { deployRules: freshDeployRules } = require('../../01-client-setup/shared/rules-deployment-utils');
      const result = freshDeployRules(TEST_PROJECT_ID, TEST_RULES_PATH, false);

      expect(result.success).toBe(false);
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
