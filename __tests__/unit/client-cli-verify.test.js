/**
 * Tests for 01-client-setup/cli/verify-client.js
 * Tests ClientHealthCheck class
 */

const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
};
jest.mock('fs', () => mockFs);

const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  execSync: mockExecSync,
}));

jest.mock('../../shared/utils/logger', () => ({
  section: jest.fn(),
  info: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  blank: jest.fn(),
}));

const mockClientSelector = {
  getClientDir: jest.fn(),
  getClientConfigPath: jest.fn(),
  loadClientConfig: jest.fn(),
  selectClientOrPrompt: jest.fn(),
};
jest.mock('../../shared/utils/client-selector', () => mockClientSelector);

jest.mock('../../01-client-setup/shared/firebase-manager', () => ({
  initializeClientFirebase: jest.fn(),
  getClientFirestore: jest.fn(),
  cleanup: jest.fn(),
}));

const firebaseClient = require('../../01-client-setup/shared/firebase-manager');
const ClientHealthCheck = require('../../01-client-setup/cli/verify-client');

describe('ClientHealthCheck', () => {
  let healthCheck;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClientSelector.getClientDir.mockReturnValue('/clients/demo');
    healthCheck = new ClientHealthCheck('demo');
  });

  describe('constructor', () => {
    test('initializes with client name', () => {
      expect(healthCheck.clientName).toBe('demo');
      expect(healthCheck.clientDir).toBe('/clients/demo');
      expect(healthCheck.results.passed).toEqual([]);
      expect(healthCheck.results.failed).toEqual([]);
      expect(healthCheck.results.warnings).toEqual([]);
    });
  });

  describe('pass()', () => {
    test('adds message to passed results', () => {
      healthCheck.pass('Test passed');

      expect(healthCheck.results.passed).toContain('Test passed');
    });
  });

  describe('fail()', () => {
    test('adds message to failed results', () => {
      healthCheck.fail('Test failed');

      expect(healthCheck.results.failed).toContain('Test failed');
    });
  });

  describe('warn()', () => {
    test('adds message to warnings', () => {
      healthCheck.warn('Test warning');

      expect(healthCheck.results.warnings).toContain('Test warning');
    });
  });

  describe('checkConfig()', () => {
    test('fails when config file not found', () => {
      mockClientSelector.getClientConfigPath.mockReturnValue('/clients/demo/config.json');
      mockFs.existsSync.mockReturnValue(false);

      const result = healthCheck.checkConfig();

      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('Config file not found');
    });

    test('passes when config is valid', () => {
      mockClientSelector.getClientConfigPath.mockReturnValue('/clients/demo/config.json');
      mockFs.existsSync.mockReturnValue(true);
      mockClientSelector.loadClientConfig.mockReturnValue({
        clientName: 'Demo',
        clientCode: 'demo',
        bundleId: 'com.example.demo',
        firebaseProjectId: 'demo-firebase',
        adminEmail: 'admin@demo.com',
        businessType: 'coffee',
      });

      const result = healthCheck.checkConfig();

      expect(result).toBe(true);
      expect(healthCheck.results.passed).toContain('Config file valid');
    });

    test('fails when required fields missing', () => {
      mockClientSelector.getClientConfigPath.mockReturnValue('/clients/demo/config.json');
      mockFs.existsSync.mockReturnValue(true);
      mockClientSelector.loadClientConfig.mockReturnValue({
        clientName: 'Demo',
        // Missing other required fields
      });

      const result = healthCheck.checkConfig();

      expect(result).toBe(false);
      expect(healthCheck.results.failed.some((f) => f.includes('missing fields'))).toBe(true);
    });

    test('handles config load error', () => {
      mockClientSelector.getClientConfigPath.mockReturnValue('/clients/demo/config.json');
      mockFs.existsSync.mockReturnValue(true);
      mockClientSelector.loadClientConfig.mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = healthCheck.checkConfig();

      expect(result).toBe(false);
      expect(healthCheck.results.failed.some((f) => f.includes('Config error'))).toBe(true);
    });
  });

  describe('checkFirebase()', () => {
    test('fails when config not loaded', async () => {
      healthCheck.config = null;

      const result = await healthCheck.checkFirebase();

      expect(result).toBe(false);
    });

    test('passes when Firebase project exists', async () => {
      healthCheck.config = { firebaseProjectId: 'demo-firebase' };
      mockExecSync.mockReturnValue(JSON.stringify({
        result: [{ projectId: 'demo-firebase' }, { projectId: 'other-project' }],
      }));

      const result = await healthCheck.checkFirebase();

      expect(result).toBe(true);
      expect(healthCheck.results.passed.some((p) => p.includes('Firebase project exists'))).toBe(true);
    });

    test('fails when Firebase project not found', async () => {
      healthCheck.config = { firebaseProjectId: 'demo-firebase' };
      mockExecSync.mockReturnValue(JSON.stringify({
        result: [{ projectId: 'other-project' }],
      }));

      const result = await healthCheck.checkFirebase();

      expect(result).toBe(false);
      expect(healthCheck.results.failed.some((f) => f.includes('Firebase project not found'))).toBe(true);
    });
  });

  describe('checkAssets()', () => {
    test('fails when assets directory not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = healthCheck.checkAssets();

      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('Assets directory not found');
    });

    test('passes when all required assets exist', () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path.includes('client_specific_assets')) return true;
        if (path.includes('logo.png')) return true;
        if (path.includes('transparent-logo.png')) return true;
        return true;
      });

      const result = healthCheck.checkAssets();

      expect(result).toBe(true);
      expect(healthCheck.results.passed).toContain('Client-specific assets complete');
    });

    test('fails when assets are missing', () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path.includes('assets') && !path.includes('logo')) return true;
        if (path.includes('client_specific_assets') && !path.includes('.png')) return true;
        return false;
      });

      const result = healthCheck.checkAssets();

      expect(result).toBe(false);
    });
  });

  describe('checkGitBranch()', () => {
    test('warns when client code not in config', () => {
      healthCheck.config = null;

      const result = healthCheck.checkGitBranch();

      expect(result).toBe(true);
      expect(healthCheck.results.warnings.some((w) => w.includes('Client code not in config'))).toBe(true);
    });

    test('passes when client config exists in main branch', () => {
      healthCheck.config = { clientCode: 'demo' };
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('git branch')) return 'main\n  deploy/demo';
        if (cmd.includes('git ls-tree')) return 'clients/demo/config.json';
        return '';
      });

      const result = healthCheck.checkGitBranch();

      expect(result).toBe(true);
    });

    test('fails when client config not in main branch', () => {
      healthCheck.config = { clientCode: 'demo' };
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('git branch')) return 'main';
        if (cmd.includes('git ls-tree')) throw new Error('not found');
        return '';
      });

      const result = healthCheck.checkGitBranch();

      expect(result).toBe(false);
    });
  });

  describe('checkMetadata()', () => {
    test('fails when metadata directory not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = healthCheck.checkMetadata();

      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('Metadata directory not found');
    });

    test('checks both Android and iOS metadata', () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path.includes('metadata') && !path.includes('title') && !path.includes('name')) return true;
        if (path.includes('android') && path.includes('title.txt')) return true;
        if (path.includes('ios') && path.includes('name.txt')) return true;
        return false;
      });

      const result = healthCheck.checkMetadata();

      expect(result).toBe(true);
    });
  });

  describe('checkFirestoreData()', () => {
    test('warns when Firebase not configured', async () => {
      healthCheck.config = null;

      const result = await healthCheck.checkFirestoreData();

      expect(result).toBe(true);
    });

    test('warns when service account not found', async () => {
      healthCheck.config = { firebaseOptions: {}, clientCode: 'demo' };
      mockFs.existsSync.mockReturnValue(false);

      const result = await healthCheck.checkFirestoreData();

      expect(result).toBe(true);
      expect(healthCheck.results.warnings.some((w) => w.includes('Service account not found'))).toBe(true);
    });

    test('passes when seed data exists', async () => {
      healthCheck.config = { firebaseOptions: {}, clientCode: 'demo' };
      mockFs.existsSync.mockReturnValue(true);
      firebaseClient.initializeClientFirebase.mockResolvedValue();
      firebaseClient.getClientFirestore.mockReturnValue({
        collection: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ empty: false }),
          })),
        })),
      });

      const result = await healthCheck.checkFirestoreData();

      expect(result).toBe(true);
    });
  });

  describe('checkAndroidCertificates()', () => {
    test('warns when client code not in config', () => {
      healthCheck.config = null;

      const result = healthCheck.checkAndroidCertificates();

      expect(result).toBe(true);
    });

    test('passes when all keystore files exist', () => {
      healthCheck.config = { clientCode: 'demo' };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
        debug.storeFile=/path/to/debug.jks
        debug.storePassword=password
        debug.keyAlias=debug
        release.storeFile=/path/to/release.jks
        release.storePassword=password
        release.keyAlias=release
      `);

      const result = healthCheck.checkAndroidCertificates();

      expect(result).toBe(true);
    });
  });

  describe('checkIosCertificates()', () => {
    test('warns when client code not in config', () => {
      healthCheck.config = null;

      const result = healthCheck.checkIosCertificates();

      expect(result).toBe(true);
    });

    test('fails when iOS directory not found', () => {
      healthCheck.config = { clientCode: 'demo' };
      mockFs.existsSync.mockImplementation((p) => {
        // Check for ios path first (more specific) before loyalty-credentials
        if (p.includes('ios')) return false;
        if (p.includes('loyalty-credentials')) return true;
        return false;
      });

      const result = healthCheck.checkIosCertificates();

      expect(result).toBe(false);
    });

    test('passes when provisioning profiles exist', () => {
      healthCheck.config = { clientCode: 'demo' };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation((path) => {
        if (path.includes('ios') && path.includes('demo')) return ['App_Distribution.mobileprovision'];
        if (path.includes('certs')) return ['distribution.cer', 'distribution.p12'];
        return [];
      });

      const result = healthCheck.checkIosCertificates();

      expect(result).toBe(true);
    });
  });

  describe('checkDeploymentCredentials()', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    test('shows info (not warning) when Google Play key not set - it is optional for first release', () => {
      delete process.env.GOOGLE_PLAY_JSON_KEY;
      // Set App Store credentials so that's not the cause of failure
      process.env.APP_STORE_CONNECT_API_KEY_ID = 'key-id';
      process.env.APP_STORE_CONNECT_API_ISSUER_ID = 'issuer-id';

      const result = healthCheck.checkDeploymentCredentials();

      // Google Play is optional (first upload must be manual), so this should pass
      expect(result).toBe(true);
      // Should NOT be in warnings - it's just informational
      expect(healthCheck.results.warnings.some((w) => w.includes('GOOGLE_PLAY_JSON_KEY'))).toBe(false);
    });

    test('warns when App Store credentials not set', () => {
      delete process.env.APP_STORE_CONNECT_API_KEY_ID;
      delete process.env.APP_STORE_CONNECT_API_ISSUER_ID;

      const result = healthCheck.checkDeploymentCredentials();

      expect(result).toBe(false);
      expect(healthCheck.results.warnings.some((w) => w.includes('App Store Connect'))).toBe(true);
    });

    test('passes when all credentials configured', () => {
      process.env.GOOGLE_PLAY_JSON_KEY = '/path/to/key.json';
      process.env.APP_STORE_CONNECT_API_KEY_ID = 'key-id';
      process.env.APP_STORE_CONNECT_API_ISSUER_ID = 'issuer-id';
      mockFs.existsSync.mockReturnValue(true);

      const result = healthCheck.checkDeploymentCredentials();

      expect(result).toBe(true);
    });
  });

  describe('checkScreenshotsPresent()', () => {
    test('warns when screenshots are insufficient', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = healthCheck.checkScreenshotsPresent();

      expect(result).toBe(false);
    });

    test('passes when screenshots exist', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['1.png', '2.png', '3.png']);

      const result = healthCheck.checkScreenshotsPresent();

      expect(result).toBe(true);
    });
  });

  describe('runAll()', () => {
    test('runs all checks and returns summary', async () => {
      // Mock successful config check
      mockClientSelector.getClientConfigPath.mockReturnValue('/clients/demo/config.json');
      mockClientSelector.loadClientConfig.mockReturnValue({
        clientName: 'Demo',
        clientCode: 'demo',
        bundleId: 'com.example.demo',
        firebaseProjectId: 'demo-firebase',
        adminEmail: 'admin@demo.com',
        businessType: 'coffee',
        firebaseOptions: {},
      });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['file1.png', 'file2.png']);
      mockFs.readFileSync.mockReturnValue('debug.storeFile=x\ndebug.storePassword=x\ndebug.keyAlias=x\nrelease.storeFile=x\nrelease.storePassword=x\nrelease.keyAlias=x');
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('firebase projects:list')) {
          return JSON.stringify({ result: [{ projectId: 'demo-firebase' }] });
        }
        if (cmd.includes('git branch')) return 'main\n  deploy/demo';
        if (cmd.includes('git ls-tree')) return 'clients/demo/config.json';
        return '';
      });
      firebaseClient.getClientFirestore.mockReturnValue({
        collection: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ empty: false }),
          })),
        })),
      });

      const result = await healthCheck.runAll();

      expect(typeof result).toBe('boolean');
    });
  });
});
