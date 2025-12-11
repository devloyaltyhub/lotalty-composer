/**
 * Tests for generate-android-keystore.js
 * Tests Android keystore generation and validation
 */

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  chmodSync: jest.fn(),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
}));

jest.mock('chalk', () => ({
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  red: jest.fn((str) => str),
  cyan: jest.fn((str) => str),
  gray: jest.fn((str) => str),
  white: jest.fn((str) => str),
}));

const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const {
  generateKeystore,
  getSHA256Fingerprint,
  validateKeystore,
  getLoyaltyCredentialsPath,
} = require('../../01-client-setup/steps/generate-android-keystore');

describe('generate-android-keystore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Default mocks
    fs.existsSync.mockReturnValue(true);
    crypto.randomBytes.mockReturnValue(Buffer.from('0123456789abcdef'));
    execSync.mockReturnValue('');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getLoyaltyCredentialsPath()', () => {
    test('returns path to loyalty-credentials when it exists', () => {
      fs.existsSync.mockReturnValue(true);

      const result = getLoyaltyCredentialsPath();

      expect(result).toContain('loyalty-credentials');
    });

    test('throws error when credentials repo not found', () => {
      fs.existsSync.mockReturnValue(false);

      expect(() => getLoyaltyCredentialsPath()).toThrow('loyalty-credentials repository not found');
    });
  });

  describe('getSHA256Fingerprint()', () => {
    const keystorePath = '/path/to/keystore.jks';
    const password = 'testpassword';
    const alias = 'testkey';

    test('returns SHA-256 fingerprint from keytool output', async () => {
      const mockOutput = `
Certificate fingerprints:
  SHA1: AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12
  SHA256: AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99
`;
      execSync.mockReturnValue(mockOutput);

      const result = await getSHA256Fingerprint(keystorePath, password, alias);

      expect(result).toBe('AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99');
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('keytool -list -v'),
        expect.anything()
      );
    });

    test('throws error when fingerprint not found', async () => {
      execSync.mockReturnValue('No fingerprint in output');

      await expect(getSHA256Fingerprint(keystorePath, password, alias)).rejects.toThrow(
        'Could not extract SHA-256 fingerprint'
      );
    });

    test('throws error on keytool failure', async () => {
      execSync.mockImplementation(() => {
        throw new Error('keytool failed');
      });

      await expect(getSHA256Fingerprint(keystorePath, password, alias)).rejects.toThrow();
    });
  });

  describe('validateKeystore()', () => {
    const keystorePath = '/path/to/keystore.jks';
    const password = 'testpassword';
    const alias = 'testkey';

    test('returns true for valid keystore', async () => {
      fs.existsSync.mockReturnValue(true);
      execSync.mockReturnValue('');

      const result = await validateKeystore(keystorePath, password, alias);

      expect(result).toBe(true);
    });

    test('returns false when keystore file does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      const result = await validateKeystore(keystorePath, password, alias);

      expect(result).toBe(false);
    });

    test('returns false when keytool fails', async () => {
      fs.existsSync.mockReturnValue(true);
      execSync.mockImplementation(() => {
        throw new Error('keytool error');
      });

      const result = await validateKeystore(keystorePath, password, alias);

      expect(result).toBe(false);
    });
  });

  describe('generateKeystore()', () => {
    const clientCode = 'demo';
    const clientsDir = '/path/to/clients';
    let keystoreCreated = {};

    beforeEach(() => {
      keystoreCreated = {};

      // Mock keytool version check and keystore generation
      execSync.mockImplementation((cmd) => {
        if (cmd === 'keytool -version') return 'keytool 11.0.0';
        if (cmd.includes('keytool -list -v')) {
          return 'SHA256: AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';
        }
        if (cmd.includes('keytool') && cmd.includes('-genkeypair')) {
          // Mark keystore as created when keytool generates it
          if (cmd.includes('keystore-debug.jks')) {
            keystoreCreated['debug'] = true;
          }
          if (cmd.includes('keystore-release.jks')) {
            keystoreCreated['release'] = true;
          }
        }
        return '';
      });

      fs.existsSync.mockImplementation((path) => {
        // Credentials repo exists
        if (path.includes('loyalty-credentials') && !path.includes('keystore') && !path.includes('.jks')) {
          return true;
        }
        // Keystore files exist after generation
        if (path.includes('keystore-debug.jks')) {
          return keystoreCreated['debug'] || false;
        }
        if (path.includes('keystore-release.jks')) {
          return keystoreCreated['release'] || false;
        }
        // Client credentials directory
        if (path.includes(`clients/${clientCode}/android`)) {
          return true;
        }
        return true;
      });
    });

    test('generates debug and release keystores', async () => {
      const result = await generateKeystore(clientCode, clientsDir);

      expect(result.debug).toBeDefined();
      expect(result.release).toBeDefined();
      expect(result.debug.alias).toBe('androiddebugkey');
      expect(result.release.alias).toBe('loyaltyhub-release');
    });

    test('creates client credentials directory', async () => {
      fs.existsSync.mockImplementation((p) => {
        // loyalty-credentials exists
        if (p.includes('loyalty-credentials') && !p.includes('clients/')) return true;
        // Client dir does not exist initially
        if (p.includes(`clients/${clientCode}/android`) && !p.includes('.jks')) return false;
        // Keystore files exist after generation
        if (p.includes('.jks')) return keystoreCreated['debug'] || keystoreCreated['release'] || false;
        return true;
      });

      await generateKeystore(clientCode, clientsDir);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(`clients/${clientCode}/android`),
        { recursive: true }
      );
    });

    test('generates secure password for release keystore', async () => {
      await generateKeystore(clientCode, clientsDir);

      expect(crypto.randomBytes).toHaveBeenCalledWith(16);
    });

    test('creates keystore.properties file', async () => {
      await generateKeystore(clientCode, clientsDir);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('keystore.properties'),
        expect.stringContaining('debug.storeFile')
      );
    });

    test('sets secure permissions on files', async () => {
      await generateKeystore(clientCode, clientsDir);

      expect(fs.chmodSync).toHaveBeenCalledWith(
        expect.stringContaining('keystore.properties'),
        0o600
      );
    });

    test('throws error when keytool not available', async () => {
      execSync.mockImplementation((cmd) => {
        if (cmd === 'keytool -version') {
          throw new Error('keytool not found');
        }
        return '';
      });

      await expect(generateKeystore(clientCode, clientsDir)).rejects.toThrow(
        'keytool not available'
      );
    });

    test('throws error when loyalty-credentials not found', async () => {
      fs.existsSync.mockReturnValue(false);

      await expect(generateKeystore(clientCode, clientsDir)).rejects.toThrow(
        'loyalty-credentials repository not found'
      );
    });

    test('skips existing keystores', async () => {
      fs.existsSync.mockReturnValue(true);
      execSync.mockImplementation((cmd) => {
        if (cmd === 'keytool -version') return 'keytool 11.0.0';
        if (cmd.includes('keytool -list -v')) {
          return 'SHA256: AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';
        }
        return '';
      });

      const result = await generateKeystore(clientCode, clientsDir);

      // Should still return results with existing fingerprints
      expect(result.debug.sha256).toBeDefined();
      expect(result.release.sha256).toBeDefined();
    });

    test('returns keystorePropertiesPath', async () => {
      const result = await generateKeystore(clientCode, clientsDir);

      expect(result.keystorePropertiesPath).toContain('keystore.properties');
    });

    test('returns clientCredentialsDir', async () => {
      const result = await generateKeystore(clientCode, clientsDir);

      expect(result.clientCredentialsDir).toContain(`clients/${clientCode}/android`);
    });

    test('debug keystore uses standard password', async () => {
      const result = await generateKeystore(clientCode, clientsDir);

      expect(result.debug.password).toBe('android-debug-key');
    });

    test('release keystore uses unique password', async () => {
      const result = await generateKeystore(clientCode, clientsDir);

      expect(result.release.password).toContain('lh-demo-');
      expect(result.release.password.length).toBeGreaterThan(15);
    });
  });
});
