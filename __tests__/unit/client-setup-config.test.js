/**
 * Tests for 01-client-setup/config.js
 * Tests configuration constants for client setup automation
 */

const config = require('../../01-client-setup/config');

describe('Client Setup Config', () => {
  describe('firebase configuration', () => {
    test('has all required properties', () => {
      expect(config.firebase).toBeDefined();
      expect(config.firebase.maxConnections).toBeDefined();
      expect(config.firebase.connectionTimeout).toBeDefined();
      expect(config.firebase.initializationTimeout).toBeDefined();
      expect(config.firebase.apiTimeout).toBeDefined();
    });

    test('has reasonable timeout values', () => {
      expect(config.firebase.connectionTimeout).toBeGreaterThanOrEqual(10000);
      expect(config.firebase.initializationTimeout).toBeGreaterThanOrEqual(30000);
      expect(config.firebase.apiTimeout).toBeGreaterThanOrEqual(10000);
    });

    test('maxConnections is a positive number', () => {
      expect(config.firebase.maxConnections).toBeGreaterThan(0);
    });
  });

  describe('keystore configuration', () => {
    test('has all required properties', () => {
      expect(config.keystore).toBeDefined();
      expect(config.keystore.keysize).toBeDefined();
      expect(config.keystore.validity).toBeDefined();
      expect(config.keystore.algorithm).toBeDefined();
      expect(config.keystore.passwordLength).toBeDefined();
    });

    test('keysize is secure', () => {
      expect(config.keystore.keysize).toBeGreaterThanOrEqual(2048);
    });

    test('validity is in reasonable range', () => {
      expect(config.keystore.validity).toBeGreaterThan(0);
    });

    test('algorithm is RSA', () => {
      expect(config.keystore.algorithm).toBe('RSA');
    });

    test('passwordLength is secure', () => {
      expect(config.keystore.passwordLength).toBeGreaterThanOrEqual(16);
    });
  });

  describe('git configuration', () => {
    test('has all required properties', () => {
      expect(config.git).toBeDefined();
      expect(config.git.maxRetries).toBeDefined();
      expect(config.git.retryDelay).toBeDefined();
      expect(config.git.timeout).toBeDefined();
    });

    test('maxRetries is reasonable', () => {
      expect(config.git.maxRetries).toBeGreaterThan(0);
      expect(config.git.maxRetries).toBeLessThanOrEqual(10);
    });

    test('retryDelay is in milliseconds', () => {
      expect(config.git.retryDelay).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('fileOperations configuration', () => {
    test('has all required properties', () => {
      expect(config.fileOperations).toBeDefined();
      expect(config.fileOperations.backupRetention).toBeDefined();
      expect(config.fileOperations.maxBackupSize).toBeDefined();
      expect(config.fileOperations.permissions).toBeDefined();
    });

    test('backupRetention is positive', () => {
      expect(config.fileOperations.backupRetention).toBeGreaterThan(0);
    });

    test('maxBackupSize is in bytes', () => {
      // Should be 100MB = 104857600 bytes
      expect(config.fileOperations.maxBackupSize).toBe(100 * 1024 * 1024);
    });

    test('permissions are valid octal values', () => {
      expect(config.fileOperations.permissions.keystore).toBe(0o600);
      expect(config.fileOperations.permissions.credentials).toBe(0o600);
      expect(config.fileOperations.permissions.config).toBe(0o644);
    });
  });

  describe('validation patterns', () => {
    test('has all required patterns', () => {
      expect(config.validation).toBeDefined();
      expect(config.validation.clientCode).toBeInstanceOf(RegExp);
      expect(config.validation.email).toBeInstanceOf(RegExp);
      expect(config.validation.bundleId).toBeInstanceOf(RegExp);
      expect(config.validation.hexColor).toBeInstanceOf(RegExp);
      expect(config.validation.businessTypeKey).toBeInstanceOf(RegExp);
      expect(config.validation.appleTeamId).toBeInstanceOf(RegExp);
      expect(config.validation.pathSafe).toBeInstanceOf(RegExp);
    });

    describe('clientCode pattern', () => {
      test('accepts valid client codes', () => {
        expect(config.validation.clientCode.test('demo')).toBe(true);
        expect(config.validation.clientCode.test('my-client')).toBe(true);
        expect(config.validation.clientCode.test('client123')).toBe(true);
        expect(config.validation.clientCode.test('abc')).toBe(true);
      });

      test('rejects invalid client codes', () => {
        expect(config.validation.clientCode.test('AB')).toBe(false); // too short
        expect(config.validation.clientCode.test('My_Client')).toBe(false); // uppercase + underscore
        expect(config.validation.clientCode.test('client.name')).toBe(false); // dot
        expect(config.validation.clientCode.test('')).toBe(false);
      });
    });

    describe('email pattern', () => {
      test('accepts valid emails', () => {
        expect(config.validation.email.test('test@example.com')).toBe(true);
        expect(config.validation.email.test('user.name@domain.co.uk')).toBe(true);
        expect(config.validation.email.test('a@b.c')).toBe(true);
      });

      test('rejects invalid emails', () => {
        expect(config.validation.email.test('notanemail')).toBe(false);
        expect(config.validation.email.test('@domain.com')).toBe(false);
        expect(config.validation.email.test('user@')).toBe(false);
        expect(config.validation.email.test('')).toBe(false);
      });
    });

    describe('bundleId pattern', () => {
      test('accepts valid bundle IDs', () => {
        expect(config.validation.bundleId.test('com.example.app')).toBe(true);
        expect(config.validation.bundleId.test('com.company.myapp')).toBe(true);
        expect(config.validation.bundleId.test('br.com.loyaltyhub.demo')).toBe(true);
      });

      test('rejects invalid bundle IDs', () => {
        expect(config.validation.bundleId.test('invalid')).toBe(false);
        expect(config.validation.bundleId.test('123.456.789')).toBe(false);
        expect(config.validation.bundleId.test('.com.example')).toBe(false);
      });
    });

    describe('hexColor pattern', () => {
      test('accepts valid hex colors', () => {
        expect(config.validation.hexColor.test('#FF0000')).toBe(true);
        expect(config.validation.hexColor.test('FF0000')).toBe(true);
        expect(config.validation.hexColor.test('#ff00ff')).toBe(true);
        expect(config.validation.hexColor.test('#FF00FF00')).toBe(true); // with alpha
      });

      test('rejects invalid hex colors', () => {
        expect(config.validation.hexColor.test('#GGG')).toBe(false);
        expect(config.validation.hexColor.test('red')).toBe(false);
        expect(config.validation.hexColor.test('#FF')).toBe(false);
      });
    });

    describe('businessTypeKey pattern', () => {
      test('accepts valid business type keys', () => {
        expect(config.validation.businessTypeKey.test('restaurant')).toBe(true);
        expect(config.validation.businessTypeKey.test('coffee_shop')).toBe(true);
        expect(config.validation.businessTypeKey.test('gym2go')).toBe(true);
      });

      test('rejects invalid business type keys', () => {
        expect(config.validation.businessTypeKey.test('123invalid')).toBe(false);
        expect(config.validation.businessTypeKey.test('my-type')).toBe(false);
        expect(config.validation.businessTypeKey.test('')).toBe(false);
      });
    });

    describe('appleTeamId pattern', () => {
      test('accepts valid Apple Team IDs', () => {
        expect(config.validation.appleTeamId.test('ABCD123456')).toBe(true);
        expect(config.validation.appleTeamId.test('1234567890')).toBe(true);
      });

      test('rejects invalid Apple Team IDs', () => {
        expect(config.validation.appleTeamId.test('abc123')).toBe(false); // lowercase
        expect(config.validation.appleTeamId.test('ABCD12345')).toBe(false); // too short
        expect(config.validation.appleTeamId.test('ABCD1234567')).toBe(false); // too long
      });
    });

    describe('pathSafe pattern', () => {
      test('accepts valid path-safe strings', () => {
        expect(config.validation.pathSafe.test('my_folder')).toBe(true);
        expect(config.validation.pathSafe.test('folder-name')).toBe(true);
        expect(config.validation.pathSafe.test('File123')).toBe(true);
      });

      test('rejects invalid path strings', () => {
        expect(config.validation.pathSafe.test('path/traversal')).toBe(false);
        expect(config.validation.pathSafe.test('../parent')).toBe(false);
        expect(config.validation.pathSafe.test('file.txt')).toBe(false);
      });
    });
  });

  describe('minVersions configuration', () => {
    test('has all required version specs', () => {
      expect(config.minVersions).toBeDefined();
      expect(config.minVersions.node).toBeDefined();
      expect(config.minVersions.flutter).toBeDefined();
      expect(config.minVersions.firebaseCli).toBeDefined();
    });

    test('versions are valid semver strings', () => {
      const semverRegex = /^\d+\.\d+\.\d+$/;
      expect(config.minVersions.node).toMatch(semverRegex);
      expect(config.minVersions.flutter).toMatch(semverRegex);
      expect(config.minVersions.firebaseCli).toMatch(semverRegex);
    });
  });

  describe('progress configuration', () => {
    test('has all required properties', () => {
      expect(config.progress).toBeDefined();
      expect(config.progress.enabled).toBeDefined();
      expect(config.progress.format).toBeDefined();
      expect(config.progress.barCompleteChar).toBeDefined();
      expect(config.progress.barIncompleteChar).toBeDefined();
    });

    test('enabled is boolean', () => {
      expect(typeof config.progress.enabled).toBe('boolean');
    });
  });

  describe('logging configuration', () => {
    test('has all required properties', () => {
      expect(config.logging).toBeDefined();
      expect(config.logging.level).toBeDefined();
      expect(config.logging.maxFiles).toBeDefined();
      expect(config.logging.maxFileSize).toBeDefined();
      expect(config.logging.dateFormat).toBeDefined();
    });

    test('level defaults to info', () => {
      // If LOG_LEVEL env var is not set, should default to 'info'
      if (!process.env.LOG_LEVEL) {
        expect(config.logging.level).toBe('info');
      }
    });

    test('maxFileSize is in bytes (10MB)', () => {
      expect(config.logging.maxFileSize).toBe(10 * 1024 * 1024);
    });
  });

  describe('ios configuration', () => {
    test('has requiredEnvVars', () => {
      expect(config.ios).toBeDefined();
      expect(config.ios.requiredEnvVars).toBeDefined();
      expect(Array.isArray(config.ios.requiredEnvVars)).toBe(true);
    });

    test('requiredEnvVars contains expected variables', () => {
      expect(config.ios.requiredEnvVars).toContain('MATCH_GIT_URL');
      expect(config.ios.requiredEnvVars).toContain('MATCH_PASSWORD');
      expect(config.ios.requiredEnvVars).toContain('APPLE_TEAM_ID');
      expect(config.ios.requiredEnvVars).toContain('FASTLANE_USER');
    });
  });

  describe('assets configuration', () => {
    test('has all required properties', () => {
      expect(config.assets).toBeDefined();
      expect(config.assets.maxImageSize).toBeDefined();
      expect(config.assets.supportedFormats).toBeDefined();
      expect(config.assets.compressionQuality).toBeDefined();
    });

    test('maxImageSize is 5MB in bytes', () => {
      expect(config.assets.maxImageSize).toBe(5 * 1024 * 1024);
    });

    test('supportedFormats is array with common formats', () => {
      expect(Array.isArray(config.assets.supportedFormats)).toBe(true);
      expect(config.assets.supportedFormats).toContain('png');
      expect(config.assets.supportedFormats).toContain('jpg');
      expect(config.assets.supportedFormats).toContain('jpeg');
      expect(config.assets.supportedFormats).toContain('svg');
    });

    test('compressionQuality is valid (0-1)', () => {
      expect(config.assets.compressionQuality).toBeGreaterThan(0);
      expect(config.assets.compressionQuality).toBeLessThanOrEqual(1);
    });
  });

  describe('timeouts configuration', () => {
    test('has all required properties', () => {
      expect(config.timeouts).toBeDefined();
      expect(config.timeouts.podInstall).toBeDefined();
      expect(config.timeouts.imageCompression).toBeDefined();
      expect(config.timeouts.buildValidation).toBeDefined();
    });

    test('timeouts are reasonable for operations', () => {
      // Pod install: 5 minutes
      expect(config.timeouts.podInstall).toBe(300000);
      // Image compression: 2 minutes
      expect(config.timeouts.imageCompression).toBe(120000);
      // Build validation: 3 minutes
      expect(config.timeouts.buildValidation).toBe(180000);
    });
  });
});
