/**
 * Tests for 01-client-setup/index.js (barrel export)
 * Tests module exports structure
 */

// Mock all the modules before requiring the index
jest.mock('../../01-client-setup/config', () => ({
  firebase: { maxConnections: 5 },
  git: { timeout: 30000 },
}));

jest.mock('../../01-client-setup/shared/firebase-manager', () => ({
  apps: new Map(),
  masterApp: null,
}));

jest.mock('../../01-client-setup/shared/business-type-manager', () => ({
  BusinessTypeRepository: {
    getExistingTypes: jest.fn(() => []),
  },
}));

jest.mock('../../01-client-setup/shared/env-loader', () => ({
  resolveCredentialPath: jest.fn(),
  loadEnvWithExpansion: jest.fn(),
}));

jest.mock('../../01-client-setup/shared/input-validator', () => ({
  validateClientCode: jest.fn(),
  validateEmail: jest.fn(),
}));

jest.mock('../../01-client-setup/steps/create-admin-user', () => jest.fn());
jest.mock('../../01-client-setup/steps/create-firebase-project', () => jest.fn());
jest.mock('../../01-client-setup/steps/create-git-branch', () => jest.fn());
jest.mock('../../01-client-setup/steps/generate-metadata', () => jest.fn());
jest.mock('../../01-client-setup/steps/seed-firestore-data', () => jest.fn());
jest.mock('../../01-client-setup/steps/setup-ios-certificates', () => jest.fn());
jest.mock('../../01-client-setup/steps/setup-remote-config', () => jest.fn());
jest.mock('../../01-client-setup/steps/git-credentials-manager', () => jest.fn());
jest.mock('../../01-client-setup/steps/generate-android-keystore', () => ({
  generateKeystore: jest.fn(),
}));
jest.mock('../../01-client-setup/steps/register-app-check', () => ({
  registerAppCheckFingerprints: jest.fn(),
}));

jest.mock('../../01-client-setup/steps/modules/asset-operations', () => ({}));
jest.mock('../../01-client-setup/steps/modules/ios-operations', () => ({}));
jest.mock('../../01-client-setup/steps/modules/keystore-operations', () => ({}));
jest.mock('../../01-client-setup/steps/modules/template-generator', () => ({}));

describe('01-client-setup/index.js', () => {
  let clientSetup;

  beforeEach(() => {
    jest.clearAllMocks();
    clientSetup = require('../../01-client-setup/index');
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('exports structure', () => {
    test('exports config', () => {
      expect(clientSetup.config).toBeDefined();
    });

    test('exports firebaseManager', () => {
      expect(clientSetup.firebaseManager).toBeDefined();
    });

    test('exports businessTypeManager', () => {
      expect(clientSetup.businessTypeManager).toBeDefined();
    });

    test('exports envLoader', () => {
      expect(clientSetup.envLoader).toBeDefined();
    });

    test('exports inputValidator', () => {
      expect(clientSetup.inputValidator).toBeDefined();
    });

    test('exports cli paths', () => {
      expect(clientSetup.cli).toBeDefined();
      expect(clientSetup.cli.createClient).toBeDefined();
      expect(clientSetup.cli.updateClient).toBeDefined();
      expect(clientSetup.cli.verifyClient).toBeDefined();
    });

    test('exports steps modules', () => {
      expect(clientSetup.steps).toBeDefined();
      expect(clientSetup.steps.createAdminUser).toBeDefined();
      expect(clientSetup.steps.createFirebaseProject).toBeDefined();
      expect(clientSetup.steps.createGitBranch).toBeDefined();
    });

    test('exports modules', () => {
      expect(clientSetup.modules).toBeDefined();
      expect(clientSetup.modules.assetOperations).toBeDefined();
      expect(clientSetup.modules.iosOperations).toBeDefined();
      expect(clientSetup.modules.keystoreOperations).toBeDefined();
      expect(clientSetup.modules.templateGenerator).toBeDefined();
    });
  });

  describe('cli paths', () => {
    test('createClient path ends with .js', () => {
      expect(clientSetup.cli.createClient).toMatch(/\.js$/);
    });

    test('updateClient path ends with .js', () => {
      expect(clientSetup.cli.updateClient).toMatch(/\.js$/);
    });

    test('verifyClient path ends with .js', () => {
      expect(clientSetup.cli.verifyClient).toMatch(/\.js$/);
    });

    test('rollbackClient path ends with .js', () => {
      expect(clientSetup.cli.rollbackClient).toMatch(/\.js$/);
    });
  });

  describe('steps exports', () => {
    test('createAdminUser is exported', () => {
      expect(clientSetup.steps.createAdminUser).toBeDefined();
    });

    test('createFirebaseProject is exported', () => {
      expect(clientSetup.steps.createFirebaseProject).toBeDefined();
    });

    test('createGitBranch is exported', () => {
      expect(clientSetup.steps.createGitBranch).toBeDefined();
    });

    test('generateMetadata is exported', () => {
      expect(clientSetup.steps.generateMetadata).toBeDefined();
    });

    test('seedFirestoreData is exported', () => {
      expect(clientSetup.steps.seedFirestoreData).toBeDefined();
    });

    test('setupIosCertificates is exported', () => {
      expect(clientSetup.steps.setupIosCertificates).toBeDefined();
    });

    test('setupRemoteConfig is exported', () => {
      expect(clientSetup.steps.setupRemoteConfig).toBeDefined();
    });

    test('gitCredentialsManager is exported', () => {
      expect(clientSetup.steps.gitCredentialsManager).toBeDefined();
    });

    test('generateAndroidKeystore is exported', () => {
      expect(clientSetup.steps.generateAndroidKeystore).toBeDefined();
    });

    test('registerAppCheck is exported', () => {
      expect(clientSetup.steps.registerAppCheck).toBeDefined();
    });
  });

  describe('modules exports', () => {
    test('assetOperations is exported', () => {
      expect(clientSetup.modules.assetOperations).toBeDefined();
    });

    test('iosOperations is exported', () => {
      expect(clientSetup.modules.iosOperations).toBeDefined();
    });

    test('keystoreOperations is exported', () => {
      expect(clientSetup.modules.keystoreOperations).toBeDefined();
    });

    test('templateGenerator is exported', () => {
      expect(clientSetup.modules.templateGenerator).toBeDefined();
    });
  });

  describe('shared exports', () => {
    test('config has firebase settings', () => {
      expect(clientSetup.config.firebase).toBeDefined();
    });

    test('config has git settings', () => {
      expect(clientSetup.config.git).toBeDefined();
    });

    test('envLoader has resolveCredentialPath', () => {
      expect(clientSetup.envLoader.resolveCredentialPath).toBeDefined();
    });

    test('inputValidator has validation functions', () => {
      expect(clientSetup.inputValidator.validateClientCode).toBeDefined();
      expect(clientSetup.inputValidator.validateEmail).toBeDefined();
    });
  });
});
