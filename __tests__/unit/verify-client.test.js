/**
 * Tests for verify-client.js (ClientHealthCheck)
 * Tests the health check logic for client setups
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

// Now require the module
const ClientHealthCheck = require('../../01-client-setup/cli/verify-client');
const clientSelector = require('../../shared/utils/client-selector');
const { execSync } = require('child_process');

describe('ClientHealthCheck', () => {
  let healthCheck;

  beforeEach(() => {
    jest.clearAllMocks();
    healthCheck = new ClientHealthCheck('test-client');
  });

  describe('constructor', () => {
    test('initializes with correct clientName', () => {
      expect(healthCheck.clientName).toBe('test-client');
    });

    test('initializes with empty results', () => {
      expect(healthCheck.results).toEqual({
        passed: [],
        failed: [],
        warnings: [],
      });
    });

    test('initializes config as null', () => {
      expect(healthCheck.config).toBeNull();
    });

    test('calls getClientDir with clientName', () => {
      expect(clientSelector.getClientDir).toHaveBeenCalledWith('test-client');
    });
  });

  describe('pass()', () => {
    test('adds message to passed array', () => {
      healthCheck.pass('Test passed');
      expect(healthCheck.results.passed).toContain('Test passed');
    });

    test('accumulates multiple passes', () => {
      healthCheck.pass('Pass 1');
      healthCheck.pass('Pass 2');
      expect(healthCheck.results.passed).toHaveLength(2);
    });
  });

  describe('fail()', () => {
    test('adds message to failed array', () => {
      healthCheck.fail('Test failed');
      expect(healthCheck.results.failed).toContain('Test failed');
    });

    test('accumulates multiple failures', () => {
      healthCheck.fail('Fail 1');
      healthCheck.fail('Fail 2');
      expect(healthCheck.results.failed).toHaveLength(2);
    });
  });

  describe('warn()', () => {
    test('adds message to warnings array', () => {
      healthCheck.warn('Test warning');
      expect(healthCheck.results.warnings).toContain('Test warning');
    });

    test('accumulates multiple warnings', () => {
      healthCheck.warn('Warn 1');
      healthCheck.warn('Warn 2');
      expect(healthCheck.results.warnings).toHaveLength(2);
    });
  });

  describe('checkConfig()', () => {
    beforeEach(() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    });

    afterEach(() => {
      fs.existsSync.mockRestore();
    });

    test('returns false if config file does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      const result = healthCheck.checkConfig();
      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('Config file not found');
    });

    test('returns false if required fields are missing', () => {
      clientSelector.loadClientConfig.mockReturnValue({
        clientName: 'Test',
        // Missing: clientCode, bundleId, firebaseProjectId, adminEmail, businessType
      });

      const result = healthCheck.checkConfig();
      expect(result).toBe(false);
      expect(healthCheck.results.failed[0]).toMatch(/Config missing fields/);
    });

    test('detects missing clientName', () => {
      clientSelector.loadClientConfig.mockReturnValue({
        clientCode: 'test',
        bundleId: 'com.test',
        firebaseProjectId: 'proj',
        adminEmail: 'a@b.com',
        businessType: 'coffee',
      });

      healthCheck.checkConfig();
      expect(healthCheck.results.failed[0]).toContain('clientName');
    });

    test('detects missing bundleId', () => {
      clientSelector.loadClientConfig.mockReturnValue({
        clientName: 'Test',
        clientCode: 'test',
        firebaseProjectId: 'proj',
        adminEmail: 'a@b.com',
        businessType: 'coffee',
      });

      healthCheck.checkConfig();
      expect(healthCheck.results.failed[0]).toContain('bundleId');
    });

    test('detects missing firebaseProjectId', () => {
      clientSelector.loadClientConfig.mockReturnValue({
        clientName: 'Test',
        clientCode: 'test',
        bundleId: 'com.test',
        adminEmail: 'a@b.com',
        businessType: 'coffee',
      });

      healthCheck.checkConfig();
      expect(healthCheck.results.failed[0]).toContain('firebaseProjectId');
    });

    test('returns true if config is valid', () => {
      clientSelector.loadClientConfig.mockReturnValue({
        clientName: 'Test',
        clientCode: 'test',
        bundleId: 'com.test',
        firebaseProjectId: 'proj',
        adminEmail: 'a@b.com',
        businessType: 'coffee',
      });

      const result = healthCheck.checkConfig();
      expect(result).toBe(true);
      expect(healthCheck.results.passed).toContain('Config file valid');
    });

    test('stores config when valid', () => {
      const validConfig = {
        clientName: 'Test',
        clientCode: 'test',
        bundleId: 'com.test',
        firebaseProjectId: 'proj',
        adminEmail: 'a@b.com',
        businessType: 'coffee',
      };
      clientSelector.loadClientConfig.mockReturnValue(validConfig);

      healthCheck.checkConfig();
      expect(healthCheck.config).toEqual(validConfig);
    });

    test('returns false on load error', () => {
      clientSelector.loadClientConfig.mockImplementation(() => {
        throw new Error('JSON parse error');
      });

      const result = healthCheck.checkConfig();
      expect(result).toBe(false);
      expect(healthCheck.results.failed[0]).toContain('Config error');
    });
  });

  describe('checkAssets()', () => {
    let existsSyncSpy;

    beforeEach(() => {
      healthCheck.clientDir = '/mock/clients/test-client';
      existsSyncSpy = jest.spyOn(fs, 'existsSync');
    });

    afterEach(() => {
      existsSyncSpy.mockRestore();
    });

    test('returns false if assets directory does not exist', () => {
      existsSyncSpy.mockReturnValue(false);

      const result = healthCheck.checkAssets();
      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('Assets directory not found');
    });

    test('returns false if client_specific_assets does not exist', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('client_specific_assets')) return false;
        return true;
      });

      const result = healthCheck.checkAssets();
      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('client_specific_assets directory not found');
    });

    test('returns false if logo.png is missing', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.endsWith('logo.png')) return false;
        return true;
      });

      const result = healthCheck.checkAssets();
      expect(result).toBe(false);
      expect(healthCheck.results.failed[0]).toContain('logo.png');
    });

    test('returns false if transparent-logo.png is missing', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.endsWith('transparent-logo.png')) return false;
        return true;
      });

      const result = healthCheck.checkAssets();
      expect(result).toBe(false);
      expect(healthCheck.results.failed[0]).toContain('transparent-logo.png');
    });

    test('returns true if all assets present', () => {
      existsSyncSpy.mockReturnValue(true);

      const result = healthCheck.checkAssets();
      expect(result).toBe(true);
      expect(healthCheck.results.passed).toContain('Client-specific assets complete');
    });
  });

  describe('checkMetadata()', () => {
    let existsSyncSpy;

    beforeEach(() => {
      healthCheck.clientDir = '/mock/clients/test-client';
      existsSyncSpy = jest.spyOn(fs, 'existsSync');
    });

    afterEach(() => {
      existsSyncSpy.mockRestore();
    });

    test('returns false if metadata directory does not exist', () => {
      existsSyncSpy.mockReturnValue(false);

      const result = healthCheck.checkMetadata();
      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('Metadata directory not found');
    });

    test('detects missing Android metadata', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('android') && p.includes('title.txt')) return false;
        return true;
      });

      healthCheck.checkMetadata();
      expect(healthCheck.results.failed).toContain('Android metadata incomplete');
    });

    test('detects missing iOS metadata', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('ios') && p.includes('name.txt')) return false;
        return true;
      });

      healthCheck.checkMetadata();
      expect(healthCheck.results.failed).toContain('iOS metadata incomplete');
    });

    test('passes if metadata is complete', () => {
      existsSyncSpy.mockReturnValue(true);

      const result = healthCheck.checkMetadata();
      expect(result).toBe(true);
      expect(healthCheck.results.passed).toContain('Android metadata exists');
      expect(healthCheck.results.passed).toContain('iOS metadata exists');
    });
  });

  describe('checkAndroidCertificates()', () => {
    let existsSyncSpy;
    let readFileSyncSpy;

    beforeEach(() => {
      healthCheck.config = { clientCode: 'test-client' };
      existsSyncSpy = jest.spyOn(fs, 'existsSync');
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync');
    });

    afterEach(() => {
      existsSyncSpy.mockRestore();
      readFileSyncSpy.mockRestore();
    });

    test('warns if config not loaded', () => {
      healthCheck.config = null;

      const result = healthCheck.checkAndroidCertificates();
      expect(result).toBe(true);
      expect(healthCheck.results.warnings[0]).toContain('Client code not in config');
    });

    test('warns if loyalty-credentials directory does not exist', () => {
      existsSyncSpy.mockReturnValue(false);

      const result = healthCheck.checkAndroidCertificates();
      expect(result).toBe(true);
      expect(healthCheck.results.warnings).toContain('loyalty-credentials directory not found');
    });

    test('fails if android certificates directory does not exist', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('loyalty-credentials') && !p.includes('android')) return true;
        if (p.includes('android')) return false;
        return true;
      });

      const result = healthCheck.checkAndroidCertificates();
      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('Android certificates directory not found');
    });

    test('fails if keystore-debug.jks is missing', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('keystore-debug.jks')) return false;
        return true;
      });

      const result = healthCheck.checkAndroidCertificates();
      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('Android debug keystore not found');
    });

    test('fails if keystore-release.jks is missing', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('keystore-release.jks')) return false;
        return true;
      });

      const result = healthCheck.checkAndroidCertificates();
      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('Android release keystore not found');
    });

    test('fails if keystore.properties is missing', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('keystore.properties')) return false;
        return true;
      });

      const result = healthCheck.checkAndroidCertificates();
      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('Android keystore.properties not found');
    });

    test('validates keystore.properties required fields', () => {
      existsSyncSpy.mockReturnValue(true);
      readFileSyncSpy.mockReturnValue('incomplete=true');

      healthCheck.checkAndroidCertificates();
      expect(healthCheck.results.warnings[0]).toContain('keystore.properties missing fields');
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

      const result = healthCheck.checkAndroidCertificates();
      expect(result).toBe(true);
      expect(healthCheck.results.passed).toContain('Android debug keystore exists');
      expect(healthCheck.results.passed).toContain('Android release keystore exists');
      expect(healthCheck.results.passed).toContain('Android keystore.properties exists');
    });
  });

  describe('checkIosCertificates()', () => {
    let existsSyncSpy;
    let readdirSyncSpy;

    beforeEach(() => {
      healthCheck.config = { clientCode: 'test-client' };
      existsSyncSpy = jest.spyOn(fs, 'existsSync');
      readdirSyncSpy = jest.spyOn(fs, 'readdirSync');
    });

    afterEach(() => {
      existsSyncSpy.mockRestore();
      readdirSyncSpy.mockRestore();
    });

    test('warns if config not loaded', () => {
      healthCheck.config = null;

      const result = healthCheck.checkIosCertificates();
      expect(result).toBe(true);
      expect(healthCheck.results.warnings[0]).toContain('Client code not in config');
    });

    test('warns if loyalty-credentials directory does not exist', () => {
      existsSyncSpy.mockReturnValue(false);

      const result = healthCheck.checkIosCertificates();
      expect(result).toBe(true);
      expect(healthCheck.results.warnings).toContain('loyalty-credentials directory not found');
    });

    test('fails if iOS certificates directory does not exist', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('loyalty-credentials') && !p.includes('ios')) return true;
        if (p.includes('ios')) return false;
        return true;
      });

      const result = healthCheck.checkIosCertificates();
      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('iOS certificates directory not found');
    });

    test('fails if no provisioning profiles found', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockReturnValue(['other.txt', 'readme.md']);

      const result = healthCheck.checkIosCertificates();
      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('No iOS provisioning profiles found');
    });

    test('counts provisioning profiles correctly', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockImplementation((p) => {
        if (p.includes('ios') && !p.includes('certs')) {
          return ['profile1.mobileprovision', 'profile2.mobileprovision', 'other.txt'];
        }
        return [];
      });

      healthCheck.checkIosCertificates();
      expect(healthCheck.results.passed[0]).toContain('2 profiles');
    });

    test('singular profile text when 1 profile', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockImplementation((p) => {
        if (p.includes('ios') && !p.includes('certs')) {
          return ['profile.mobileprovision'];
        }
        return [];
      });

      healthCheck.checkIosCertificates();
      expect(healthCheck.results.passed[0]).toMatch(/1 profile\)/);
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

      const result = healthCheck.checkIosCertificates();
      expect(result).toBe(true);
      expect(healthCheck.results.passed[0]).toContain('iOS provisioning profiles found');
    });
  });

  describe('checkGitBranch()', () => {
    beforeEach(() => {
      healthCheck.config = { clientCode: 'test-client' };
    });

    test('warns if config not loaded', () => {
      healthCheck.config = null;

      const result = healthCheck.checkGitBranch();
      expect(result).toBe(true);
      expect(healthCheck.results.warnings[0]).toContain('Client code not in config');
    });

    test('passes if client config in main branch', () => {
      execSync
        .mockReturnValueOnce('main\n* deploy/test-client\n')
        .mockReturnValueOnce('clients/test-client/config.json\n');

      const result = healthCheck.checkGitBranch();
      expect(result).toBe(true);
      expect(healthCheck.results.passed).toContain('Client config exists in main branch');
    });

    test('fails if client not in main branch', () => {
      execSync
        .mockReturnValueOnce('main\n')
        .mockImplementationOnce(() => {
          throw new Error('No match');
        });

      const result = healthCheck.checkGitBranch();
      expect(result).toBe(false);
      expect(healthCheck.results.failed).toContain('Client config not found in main branch');
    });

    test('fails on git error', () => {
      execSync.mockImplementation(() => {
        throw new Error('Git not found');
      });

      const result = healthCheck.checkGitBranch();
      expect(result).toBe(false);
      expect(healthCheck.results.failed[0]).toContain('Git check failed');
    });
  });

  describe('results aggregation', () => {
    test('aggregates passed/failed/warnings correctly', () => {
      healthCheck.pass('Pass 1');
      healthCheck.pass('Pass 2');
      healthCheck.fail('Fail 1');
      healthCheck.warn('Warn 1');
      healthCheck.warn('Warn 2');
      healthCheck.warn('Warn 3');

      expect(healthCheck.results.passed).toHaveLength(2);
      expect(healthCheck.results.failed).toHaveLength(1);
      expect(healthCheck.results.warnings).toHaveLength(3);
    });

    test('runAll returns true if zero failures', async () => {
      // Mock all checks to pass
      jest.spyOn(healthCheck, 'checkConfig').mockReturnValue(true);
      healthCheck.config = { clientCode: 'test' };
      jest.spyOn(healthCheck, 'checkFirebase').mockResolvedValue(true);
      jest.spyOn(healthCheck, 'checkAssets').mockReturnValue(true);
      jest.spyOn(healthCheck, 'checkGitBranch').mockReturnValue(true);
      jest.spyOn(healthCheck, 'checkMetadata').mockReturnValue(true);
      jest.spyOn(healthCheck, 'checkAndroidCertificates').mockReturnValue(true);
      jest.spyOn(healthCheck, 'checkIosCertificates').mockReturnValue(true);
      jest.spyOn(healthCheck, 'checkFirestoreData').mockResolvedValue(true);

      const result = await healthCheck.runAll();
      expect(result).toBe(true);
    });

    test('runAll returns false if any failure', async () => {
      // Mock one check to fail
      jest.spyOn(healthCheck, 'checkConfig').mockReturnValue(true);
      healthCheck.config = { clientCode: 'test' };
      healthCheck.fail('Something failed');

      jest.spyOn(healthCheck, 'checkFirebase').mockResolvedValue(true);
      jest.spyOn(healthCheck, 'checkAssets').mockReturnValue(true);
      jest.spyOn(healthCheck, 'checkGitBranch').mockReturnValue(true);
      jest.spyOn(healthCheck, 'checkMetadata').mockReturnValue(true);
      jest.spyOn(healthCheck, 'checkAndroidCertificates').mockReturnValue(true);
      jest.spyOn(healthCheck, 'checkIosCertificates').mockReturnValue(true);
      jest.spyOn(healthCheck, 'checkFirestoreData').mockResolvedValue(true);

      const result = await healthCheck.runAll();
      expect(result).toBe(false);
    });
  });
});
