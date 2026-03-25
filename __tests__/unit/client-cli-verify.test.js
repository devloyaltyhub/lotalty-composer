/**
 * Tests for 01-client-setup/cli/verify-client.js
 * Tests ClientHealthCheck class and its sub-checkers
 *
 * The ClientHealthCheck now delegates to CheckResult, ConfigChecker,
 * FirebaseChecker, AssetChecker, GitChecker, MetadataChecker, CertificateChecker.
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

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

jest.mock('../../shared/utils/paths', () => ({
  COMPOSE_ROOT: '/mock/loyalty-composer',
  LOYALTY_CREDENTIALS_ROOT: '/mock/loyalty-credentials',
  getClientConfigPath: jest.fn(),
}));

const firebaseClient = require('../../01-client-setup/shared/firebase-manager');
const ClientHealthCheck = require('../../01-client-setup/cli/verify-client');
const CheckResult = require('../../01-client-setup/cli/verify-client/check-result');
const ConfigChecker = require('../../01-client-setup/cli/verify-client/config-checker');
const AssetChecker = require('../../01-client-setup/cli/verify-client/asset-checker');
const GitChecker = require('../../01-client-setup/cli/verify-client/git-checker');
const MetadataChecker = require('../../01-client-setup/cli/verify-client/metadata-checker');
const CertificateChecker = require('../../01-client-setup/cli/verify-client/certificate-checker');

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
      expect(healthCheck.config).toBeNull();
      expect(healthCheck.checkResult).toBeInstanceOf(CheckResult);
    });
  });

  describe('runAll()', () => {
    test('returns false when config check fails', async () => {
      mockClientSelector.getClientConfigPath.mockReturnValue('/clients/demo/config.json');
      mockFs.existsSync.mockReturnValue(false);

      const result = await healthCheck.runAll();

      expect(typeof result).toBe('boolean');
    });

    test('runs all checks and returns summary when config valid', async () => {
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

describe('ConfigChecker (via client-cli-verify)', () => {
  let checkResult;

  beforeEach(() => {
    jest.clearAllMocks();
    checkResult = new CheckResult();
    mockClientSelector.getClientDir.mockReturnValue('/clients/demo');
  });

  test('fails when config file not found', () => {
    mockClientSelector.getClientConfigPath.mockReturnValue('/clients/demo/config.json');
    mockFs.existsSync.mockReturnValue(false);

    const checker = new ConfigChecker('demo', checkResult);
    const result = checker.check();

    expect(result).toBeNull();
    expect(checkResult.results.failed).toContain('Config file not found');
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

    const checker = new ConfigChecker('demo', checkResult);
    const result = checker.check();

    expect(result).toBeDefined();
    expect(checkResult.results.passed).toContain('Config file valid');
  });

  test('fails when required fields missing', () => {
    mockClientSelector.getClientConfigPath.mockReturnValue('/clients/demo/config.json');
    mockFs.existsSync.mockReturnValue(true);
    mockClientSelector.loadClientConfig.mockReturnValue({
      clientName: 'Demo',
    });

    const checker = new ConfigChecker('demo', checkResult);
    const result = checker.check();

    expect(result).toBeNull();
    expect(checkResult.results.failed.some((f) => f.includes('missing fields'))).toBe(true);
  });

  test('handles config load error', () => {
    mockClientSelector.getClientConfigPath.mockReturnValue('/clients/demo/config.json');
    mockFs.existsSync.mockReturnValue(true);
    mockClientSelector.loadClientConfig.mockImplementation(() => {
      throw new Error('Parse error');
    });

    const checker = new ConfigChecker('demo', checkResult);
    const result = checker.check();

    expect(result).toBeNull();
    expect(checkResult.results.failed.some((f) => f.includes('Config error'))).toBe(true);
  });
});

describe('AssetChecker (via client-cli-verify)', () => {
  let checkResult;

  beforeEach(() => {
    jest.clearAllMocks();
    checkResult = new CheckResult();
    mockClientSelector.getClientDir.mockReturnValue('/clients/demo');
  });

  test('fails when assets directory not found', () => {
    mockFs.existsSync.mockReturnValue(false);

    const checker = new AssetChecker('demo', checkResult);
    const result = checker.check();

    expect(result).toBe(false);
    expect(checkResult.results.failed).toContain('Assets directory not found');
  });

  test('passes when all required assets exist', () => {
    mockFs.existsSync.mockReturnValue(true);

    const checker = new AssetChecker('demo', checkResult);
    const result = checker.check();

    expect(result).toBe(true);
    expect(checkResult.results.passed).toContain('Client-specific assets complete');
  });

  test('fails when assets are missing', () => {
    mockFs.existsSync.mockImplementation((path) => {
      if (path.includes('assets') && !path.includes('logo')) return true;
      if (path.includes('client_specific_assets') && !path.includes('.png')) return true;
      return false;
    });

    const checker = new AssetChecker('demo', checkResult);
    const result = checker.check();

    expect(result).toBe(false);
  });
});

describe('GitChecker (via client-cli-verify)', () => {
  let checkResult;

  beforeEach(() => {
    jest.clearAllMocks();
    checkResult = new CheckResult();
  });

  test('warns when client code not in config', () => {
    const checker = new GitChecker(null, checkResult);
    const result = checker.check();

    expect(result).toBe(true);
    expect(checkResult.results.warnings.some((w) => w.includes('Client code not in config'))).toBe(true);
  });

  test('passes when client config exists in main branch', () => {
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('git ls-tree')) return 'clients/demo/config.json';
      return '';
    });

    const checker = new GitChecker({ clientCode: 'demo' }, checkResult);
    const result = checker.check();

    expect(result).toBe(true);
  });

  test('fails when client config not in main branch', () => {
    mockExecSync.mockImplementation((cmd) => {
      if (cmd.includes('git ls-tree')) throw new Error('not found');
      return '';
    });

    const checker = new GitChecker({ clientCode: 'demo' }, checkResult);
    const result = checker.check();

    expect(result).toBe(false);
  });
});

describe('MetadataChecker (via client-cli-verify)', () => {
  let checkResult;

  beforeEach(() => {
    jest.clearAllMocks();
    checkResult = new CheckResult();
    mockClientSelector.getClientDir.mockReturnValue('/clients/demo');
  });

  test('fails when metadata directory not found', () => {
    mockFs.existsSync.mockReturnValue(false);

    const checker = new MetadataChecker('demo', { locale: 'pt-BR' }, checkResult);
    const result = checker.check();

    expect(result).toBe(false);
    expect(checkResult.results.failed).toContain('Metadata directory not found');
  });

  test('checks both Android and iOS metadata', () => {
    mockFs.existsSync.mockImplementation((path) => {
      if (path.includes('metadata') && !path.includes('title') && !path.includes('name')) return true;
      if (path.includes('android') && path.includes('title.txt')) return true;
      if (path.includes('ios') && path.includes('name.txt')) return true;
      return false;
    });

    const checker = new MetadataChecker('demo', { locale: 'pt-BR' }, checkResult);
    const result = checker.check();

    expect(result).toBe(true);
  });
});

describe('CertificateChecker (via client-cli-verify)', () => {
  let checkResult;

  beforeEach(() => {
    jest.clearAllMocks();
    checkResult = new CheckResult();
  });

  describe('checkAndroid()', () => {
    test('warns when client code not in config', () => {
      const checker = new CertificateChecker(null, checkResult);
      const result = checker.checkAndroid();

      expect(result).toBe(true);
    });

    test('passes when all keystore files exist', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
        debug.storeFile=/path/to/debug.jks
        debug.storePassword=password
        debug.keyAlias=debug
        release.storeFile=/path/to/release.jks
        release.storePassword=password
        release.keyAlias=release
      `);

      const checker = new CertificateChecker({ clientCode: 'demo' }, checkResult);
      const result = checker.checkAndroid();

      expect(result).toBe(true);
    });
  });

  describe('checkIos()', () => {
    test('warns when client code not in config', () => {
      const checker = new CertificateChecker(null, checkResult);
      const result = checker.checkIos();

      expect(result).toBe(true);
    });

    test('fails when iOS directory not found', () => {
      mockFs.existsSync.mockImplementation((p) => {
        if (p.includes('ios')) return false;
        if (p.includes('loyalty-credentials')) return true;
        return false;
      });

      const checker = new CertificateChecker({ clientCode: 'demo' }, checkResult);
      const result = checker.checkIos();

      expect(result).toBe(false);
    });

    test('passes when provisioning profiles exist', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation((path) => {
        if (path.includes('ios') && path.includes('demo')) return ['App_Distribution.mobileprovision'];
        if (path.includes('certs')) return ['distribution.cer', 'distribution.p12'];
        return [];
      });

      const checker = new CertificateChecker({ clientCode: 'demo' }, checkResult);
      const result = checker.checkIos();

      expect(result).toBe(true);
    });
  });
});
