/**
 * Tests for verify-client (ClientHealthCheck and sub-checkers)
 * Tests the health check logic for client setups
 *
 * The ClientHealthCheck was refactored into:
 * - CheckResult: pass/fail/warn result aggregation
 * - ConfigChecker: config validation
 * - FirebaseChecker: Firebase project checks
 * - AssetChecker: asset file checks
 * - GitChecker: git branch checks
 * - MetadataChecker: app store metadata checks
 * - CertificateChecker: Android/iOS certificate checks + deployment credentials
 */

const path = require('path');
const fs = require('fs');

// Mock dependencies before requiring module
jest.mock('../../shared/utils/logger', () => ({
  section: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  success: jest.fn(),
  blank: jest.fn(),
}));

jest.mock('../../shared/utils/client-selector', () => ({
  getClientDir: jest.fn((clientName) => `/mock/clients/${clientName}`),
  getClientConfigPath: jest.fn((clientName) => `/mock/clients/${clientName}/config.json`),
  loadClientConfig: jest.fn(),
  selectClientOrPrompt: jest.fn(),
}));

jest.mock('../../01-client-setup/shared/firebase-manager', () => ({
  initializeClientFirebase: jest.fn(),
  getClientFirestore: jest.fn(),
  cleanup: jest.fn(),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

jest.mock('../../shared/utils/paths', () => ({
  COMPOSE_ROOT: '/mock/loyalty-composer',
  LOYALTY_CREDENTIALS_ROOT: '/mock/loyalty-credentials',
  getClientConfigPath: jest.fn(),
}));

// Now require the modules
const CheckResult = require('../../01-client-setup/cli/verify-client/check-result');
const ConfigChecker = require('../../01-client-setup/cli/verify-client/config-checker');
const AssetChecker = require('../../01-client-setup/cli/verify-client/asset-checker');
const GitChecker = require('../../01-client-setup/cli/verify-client/git-checker');
const MetadataChecker = require('../../01-client-setup/cli/verify-client/metadata-checker');
const CertificateChecker = require('../../01-client-setup/cli/verify-client/certificate-checker');
const clientSelector = require('../../shared/utils/client-selector');
const { execSync } = require('child_process');

describe('CheckResult', () => {
  let checkResult;

  beforeEach(() => {
    jest.clearAllMocks();
    checkResult = new CheckResult();
  });

  describe('pass()', () => {
    test('adds message to passed array', () => {
      checkResult.pass('Test passed');
      expect(checkResult.results.passed).toContain('Test passed');
    });

    test('accumulates multiple passes', () => {
      checkResult.pass('Pass 1');
      checkResult.pass('Pass 2');
      expect(checkResult.results.passed).toHaveLength(2);
    });
  });

  describe('fail()', () => {
    test('adds message to failed array', () => {
      checkResult.fail('Test failed');
      expect(checkResult.results.failed).toContain('Test failed');
    });

    test('accumulates multiple failures', () => {
      checkResult.fail('Fail 1');
      checkResult.fail('Fail 2');
      expect(checkResult.results.failed).toHaveLength(2);
    });
  });

  describe('warn()', () => {
    test('adds message to warnings array', () => {
      checkResult.warn('Test warning');
      expect(checkResult.results.warnings).toContain('Test warning');
    });

    test('accumulates multiple warnings', () => {
      checkResult.warn('Warn 1');
      checkResult.warn('Warn 2');
      expect(checkResult.results.warnings).toHaveLength(2);
    });
  });

  describe('isHealthy()', () => {
    test('returns true when no failures', () => {
      checkResult.pass('Pass 1');
      checkResult.warn('Warn 1');
      expect(checkResult.isHealthy()).toBe(true);
    });

    test('returns false when there are failures', () => {
      checkResult.fail('Fail 1');
      expect(checkResult.isHealthy()).toBe(false);
    });
  });

  describe('results aggregation', () => {
    test('aggregates passed/failed/warnings correctly', () => {
      checkResult.pass('Pass 1');
      checkResult.pass('Pass 2');
      checkResult.fail('Fail 1');
      checkResult.warn('Warn 1');
      checkResult.warn('Warn 2');
      checkResult.warn('Warn 3');

      expect(checkResult.results.passed).toHaveLength(2);
      expect(checkResult.results.failed).toHaveLength(1);
      expect(checkResult.results.warnings).toHaveLength(3);
    });
  });
});

describe('ConfigChecker', () => {
  let checkResult;
  let existsSyncSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    checkResult = new CheckResult();
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
  });

  test('returns null if config file does not exist', () => {
    existsSyncSpy.mockReturnValue(false);
    const checker = new ConfigChecker('test-client', checkResult);

    const result = checker.check();

    expect(result).toBeNull();
    expect(checkResult.results.failed).toContain('Config file not found');
  });

  test('returns null if required fields are missing', () => {
    clientSelector.loadClientConfig.mockReturnValue({
      clientName: 'Test',
      // Missing: clientCode, bundleId, firebaseProjectId, adminEmail, businessType
    });

    const checker = new ConfigChecker('test-client', checkResult);
    const result = checker.check();

    expect(result).toBeNull();
    expect(checkResult.results.failed[0]).toMatch(/Config missing fields/);
  });

  test('detects missing clientName', () => {
    clientSelector.loadClientConfig.mockReturnValue({
      clientCode: 'test',
      bundleId: 'com.test',
      firebaseProjectId: 'proj',
      adminEmail: 'a@b.com',
      businessType: 'coffee',
    });

    const checker = new ConfigChecker('test-client', checkResult);
    checker.check();

    expect(checkResult.results.failed[0]).toContain('clientName');
  });

  test('detects missing bundleId', () => {
    clientSelector.loadClientConfig.mockReturnValue({
      clientName: 'Test',
      clientCode: 'test',
      firebaseProjectId: 'proj',
      adminEmail: 'a@b.com',
      businessType: 'coffee',
    });

    const checker = new ConfigChecker('test-client', checkResult);
    checker.check();

    expect(checkResult.results.failed[0]).toContain('bundleId');
  });

  test('detects missing firebaseProjectId', () => {
    clientSelector.loadClientConfig.mockReturnValue({
      clientName: 'Test',
      clientCode: 'test',
      bundleId: 'com.test',
      adminEmail: 'a@b.com',
      businessType: 'coffee',
    });

    const checker = new ConfigChecker('test-client', checkResult);
    checker.check();

    expect(checkResult.results.failed[0]).toContain('firebaseProjectId');
  });

  test('returns config if valid', () => {
    clientSelector.loadClientConfig.mockReturnValue({
      clientName: 'Test',
      clientCode: 'test',
      bundleId: 'com.test',
      firebaseProjectId: 'proj',
      adminEmail: 'a@b.com',
      businessType: 'coffee',
    });

    const checker = new ConfigChecker('test-client', checkResult);
    const result = checker.check();

    expect(result).toBeDefined();
    expect(checkResult.results.passed).toContain('Config file valid');
  });

  test('returns null on load error', () => {
    clientSelector.loadClientConfig.mockImplementation(() => {
      throw new Error('JSON parse error');
    });

    const checker = new ConfigChecker('test-client', checkResult);
    const result = checker.check();

    expect(result).toBeNull();
    expect(checkResult.results.failed[0]).toContain('Config error');
  });
});

describe('AssetChecker', () => {
  let checkResult;
  let existsSyncSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    checkResult = new CheckResult();
    existsSyncSpy = jest.spyOn(fs, 'existsSync');
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
  });

  test('returns false if assets directory does not exist', () => {
    existsSyncSpy.mockReturnValue(false);

    const checker = new AssetChecker('test-client', checkResult);
    const result = checker.check();

    expect(result).toBe(false);
    expect(checkResult.results.failed).toContain('Assets directory not found');
  });

  test('returns false if client_specific_assets does not exist', () => {
    existsSyncSpy.mockImplementation((p) => {
      if (p.includes('client_specific_assets')) return false;
      return true;
    });

    const checker = new AssetChecker('test-client', checkResult);
    const result = checker.check();

    expect(result).toBe(false);
    expect(checkResult.results.failed).toContain('client_specific_assets directory not found');
  });

  test('returns false if logo.png is missing', () => {
    existsSyncSpy.mockImplementation((p) => {
      if (p.endsWith('logo.png')) return false;
      return true;
    });

    const checker = new AssetChecker('test-client', checkResult);
    const result = checker.check();

    expect(result).toBe(false);
    expect(checkResult.results.failed[0]).toContain('logo.png');
  });

  test('returns false if transparent-logo.png is missing', () => {
    existsSyncSpy.mockImplementation((p) => {
      if (p.endsWith('transparent-logo.png')) return false;
      return true;
    });

    const checker = new AssetChecker('test-client', checkResult);
    const result = checker.check();

    expect(result).toBe(false);
    expect(checkResult.results.failed[0]).toContain('transparent-logo.png');
  });

  test('returns true if all assets present', () => {
    existsSyncSpy.mockReturnValue(true);

    const checker = new AssetChecker('test-client', checkResult);
    const result = checker.check();

    expect(result).toBe(true);
    expect(checkResult.results.passed).toContain('Client-specific assets complete');
  });
});

describe('MetadataChecker', () => {
  let checkResult;
  let existsSyncSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    checkResult = new CheckResult();
    existsSyncSpy = jest.spyOn(fs, 'existsSync');
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
  });

  test('returns false if metadata directory does not exist', () => {
    existsSyncSpy.mockReturnValue(false);

    const checker = new MetadataChecker('test-client', { locale: 'pt-BR' }, checkResult);
    const result = checker.check();

    expect(result).toBe(false);
    expect(checkResult.results.failed).toContain('Metadata directory not found');
  });

  test('detects missing Android metadata', () => {
    existsSyncSpy.mockImplementation((p) => {
      if (p.includes('android') && p.includes('title.txt')) return false;
      return true;
    });

    const checker = new MetadataChecker('test-client', { locale: 'pt-BR' }, checkResult);
    checker.check();

    expect(checkResult.results.failed).toContain('Android metadata incomplete');
  });

  test('detects missing iOS metadata', () => {
    existsSyncSpy.mockImplementation((p) => {
      if (p.includes('ios') && p.includes('name.txt')) return false;
      return true;
    });

    const checker = new MetadataChecker('test-client', { locale: 'pt-BR' }, checkResult);
    checker.check();

    expect(checkResult.results.failed).toContain('iOS metadata incomplete');
  });

  test('passes if metadata is complete', () => {
    existsSyncSpy.mockReturnValue(true);

    const checker = new MetadataChecker('test-client', { locale: 'pt-BR' }, checkResult);
    const result = checker.check();

    expect(result).toBe(true);
    expect(checkResult.results.passed).toContain('Android metadata exists');
    expect(checkResult.results.passed).toContain('iOS metadata exists');
  });
});

describe('CertificateChecker', () => {
  let checkResult;
  let existsSyncSpy;
  let readFileSyncSpy;
  let readdirSyncSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    checkResult = new CheckResult();
    existsSyncSpy = jest.spyOn(fs, 'existsSync');
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync');
    readdirSyncSpy = jest.spyOn(fs, 'readdirSync');
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    readdirSyncSpy.mockRestore();
  });

  describe('checkAndroid()', () => {
    test('warns if config not loaded', () => {
      const checker = new CertificateChecker(null, checkResult);
      const result = checker.checkAndroid();

      expect(result).toBe(true);
      expect(checkResult.results.warnings[0]).toContain('Client code not in config');
    });

    test('warns if loyalty-credentials directory does not exist', () => {
      existsSyncSpy.mockReturnValue(false);

      const checker = new CertificateChecker({ clientCode: 'test-client' }, checkResult);
      const result = checker.checkAndroid();

      expect(result).toBe(true);
      expect(checkResult.results.warnings).toContain('loyalty-credentials directory not found');
    });

    test('fails if android certificates directory does not exist', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('loyalty-credentials') && !p.includes('android')) return true;
        if (p.includes('android')) return false;
        return true;
      });

      const checker = new CertificateChecker({ clientCode: 'test-client' }, checkResult);
      const result = checker.checkAndroid();

      expect(result).toBe(false);
      expect(checkResult.results.failed).toContain('Android certificates directory not found');
    });

    test('fails if keystore-debug.jks is missing', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('keystore-debug.jks')) return false;
        return true;
      });

      const checker = new CertificateChecker({ clientCode: 'test-client' }, checkResult);
      const result = checker.checkAndroid();

      expect(result).toBe(false);
      expect(checkResult.results.failed).toContain('Android debug keystore not found');
    });

    test('fails if keystore-release.jks is missing', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('keystore-release.jks')) return false;
        return true;
      });

      const checker = new CertificateChecker({ clientCode: 'test-client' }, checkResult);
      const result = checker.checkAndroid();

      expect(result).toBe(false);
      expect(checkResult.results.failed).toContain('Android release keystore not found');
    });

    test('fails if keystore.properties is missing', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('keystore.properties')) return false;
        return true;
      });

      const checker = new CertificateChecker({ clientCode: 'test-client' }, checkResult);
      const result = checker.checkAndroid();

      expect(result).toBe(false);
      expect(checkResult.results.failed).toContain('Android keystore.properties not found');
    });

    test('validates keystore.properties required fields', () => {
      existsSyncSpy.mockReturnValue(true);
      readFileSyncSpy.mockReturnValue('incomplete=true');

      const checker = new CertificateChecker({ clientCode: 'test-client' }, checkResult);
      checker.checkAndroid();

      expect(checkResult.results.warnings[0]).toContain('keystore.properties missing fields');
    });

    test('passes if all certificates present', () => {
      existsSyncSpy.mockReturnValue(true);
      readFileSyncSpy.mockReturnValue(`
        debug.storeFile=./keystore-debug.jks
        debug.storePassword=pass
        debug.keyAlias=debug
        release.storeFile=./keystore-release.jks
        release.storePassword=pass
        release.keyAlias=release
      `);

      const checker = new CertificateChecker({ clientCode: 'test-client' }, checkResult);
      const result = checker.checkAndroid();

      expect(result).toBe(true);
      expect(checkResult.results.passed).toContain('Android debug keystore exists');
      expect(checkResult.results.passed).toContain('Android release keystore exists');
      expect(checkResult.results.passed).toContain('Android keystore.properties exists');
    });
  });

  describe('checkIos()', () => {
    test('warns if config not loaded', () => {
      const checker = new CertificateChecker(null, checkResult);
      const result = checker.checkIos();

      expect(result).toBe(true);
      expect(checkResult.results.warnings[0]).toContain('Client code not in config');
    });

    test('warns if loyalty-credentials directory does not exist', () => {
      existsSyncSpy.mockReturnValue(false);

      const checker = new CertificateChecker({ clientCode: 'test-client' }, checkResult);
      const result = checker.checkIos();

      expect(result).toBe(true);
      expect(checkResult.results.warnings).toContain('loyalty-credentials directory not found');
    });

    test('fails if iOS certificates directory does not exist', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('loyalty-credentials') && !p.includes('ios')) return true;
        if (p.includes('ios')) return false;
        return true;
      });

      const checker = new CertificateChecker({ clientCode: 'test-client' }, checkResult);
      const result = checker.checkIos();

      expect(result).toBe(false);
      expect(checkResult.results.failed).toContain('iOS certificates directory not found');
    });

    test('fails if no provisioning profiles found', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockReturnValue(['other.txt', 'readme.md']);

      const checker = new CertificateChecker({ clientCode: 'test-client' }, checkResult);
      const result = checker.checkIos();

      expect(result).toBe(false);
      expect(checkResult.results.failed).toContain('No iOS provisioning profiles found');
    });

    test('counts provisioning profiles correctly', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockImplementation((p) => {
        if (p.includes('ios') && !p.includes('certs')) {
          return ['profile1.mobileprovision', 'profile2.mobileprovision', 'other.txt'];
        }
        return [];
      });

      const checker = new CertificateChecker({ clientCode: 'test-client' }, checkResult);
      checker.checkIos();

      expect(checkResult.results.passed[0]).toContain('2 profiles');
    });

    test('singular profile text when 1 profile', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockImplementation((p) => {
        if (p.includes('ios') && !p.includes('certs')) {
          return ['profile.mobileprovision'];
        }
        return [];
      });

      const checker = new CertificateChecker({ clientCode: 'test-client' }, checkResult);
      checker.checkIos();

      expect(checkResult.results.passed[0]).toMatch(/1 profile\)/);
    });

    test('passes if provisioning profiles exist', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockImplementation((p) => {
        if (p.includes('ios') && !p.includes('certs')) {
          return ['app.mobileprovision'];
        }
        if (p.includes('certs')) {
          return ['cert.cer', 'cert.p12'];
        }
        return [];
      });

      const checker = new CertificateChecker({ clientCode: 'test-client' }, checkResult);
      const result = checker.checkIos();

      expect(result).toBe(true);
      expect(checkResult.results.passed[0]).toContain('iOS provisioning profiles found');
    });
  });

  describe('checkDeployment()', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    test('shows info (not warning) when Google Play key not set - it is optional for first release', () => {
      delete process.env.GOOGLE_PLAY_JSON_KEY;
      process.env.APP_STORE_CONNECT_API_KEY_ID = 'key-id';
      process.env.APP_STORE_CONNECT_API_ISSUER_ID = 'issuer-id';

      const checker = new CertificateChecker({ clientCode: 'test' }, checkResult);
      const result = checker.checkDeployment();

      // Google Play is optional, so this should pass
      expect(result).toBe(true);
      // Should NOT be in warnings
      expect(checkResult.results.warnings.some((w) => w.includes('GOOGLE_PLAY_JSON_KEY'))).toBe(false);
    });

    test('warns when App Store credentials not set', () => {
      delete process.env.APP_STORE_CONNECT_API_KEY_ID;
      delete process.env.APP_STORE_CONNECT_API_ISSUER_ID;

      const checker = new CertificateChecker({ clientCode: 'test' }, checkResult);
      const result = checker.checkDeployment();

      expect(result).toBe(false);
      expect(checkResult.results.warnings.some((w) => w.includes('App Store Connect'))).toBe(true);
    });

    test('passes when all credentials configured', () => {
      process.env.GOOGLE_PLAY_JSON_KEY = '/path/to/key.json';
      process.env.APP_STORE_CONNECT_API_KEY_ID = 'key-id';
      process.env.APP_STORE_CONNECT_API_ISSUER_ID = 'issuer-id';
      existsSyncSpy.mockReturnValue(true);

      const checker = new CertificateChecker({ clientCode: 'test' }, checkResult);
      const result = checker.checkDeployment();

      expect(result).toBe(true);
    });
  });
});

describe('GitChecker', () => {
  let checkResult;

  beforeEach(() => {
    jest.clearAllMocks();
    checkResult = new CheckResult();
  });

  test('warns if config not loaded', () => {
    const checker = new GitChecker(null, checkResult);
    const result = checker.check();

    expect(result).toBe(true);
    expect(checkResult.results.warnings[0]).toContain('Client code not in config');
  });

  test('passes if client config in main branch', () => {
    execSync.mockReturnValueOnce('clients/test-client/config.json\n');

    const checker = new GitChecker({ clientCode: 'test-client' }, checkResult);
    const result = checker.check();

    expect(result).toBe(true);
    expect(checkResult.results.passed).toContain('Client config exists in main branch');
  });

  test('fails if client not in main branch', () => {
    execSync.mockImplementationOnce(() => {
      throw new Error('No match');
    });

    const checker = new GitChecker({ clientCode: 'test-client' }, checkResult);
    const result = checker.check();

    expect(result).toBe(false);
    expect(checkResult.results.failed).toContain('Client config not found in main branch');
  });

  test('fails on git error', () => {
    execSync.mockImplementation(() => {
      throw new Error('Git not found');
    });

    const checker = new GitChecker({ clientCode: 'test-client' }, checkResult);
    const result = checker.check();

    expect(result).toBe(false);
    expect(checkResult.results.failed[0]).toContain('Client config not found in main branch');
  });
});
