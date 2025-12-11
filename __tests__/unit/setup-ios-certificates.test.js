/**
 * Tests for setup-ios-certificates.js (IOSCertificateSetup)
 * Tests iOS certificate and provisioning profile setup
 */

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

jest.mock('chalk', () => ({
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  red: jest.fn((str) => str),
  cyan: jest.fn((str) => str),
  gray: jest.fn((str) => str),
}));

jest.mock('../../01-client-setup/shared/input-validator', () => ({
  validateGitUrl: jest.fn(),
  validateAppleTeamId: jest.fn(),
  validateEnvironmentVariables: jest.fn(),
}));

jest.mock('../../shared/utils/error-handler', () => ({
  ValidationError: class ValidationError extends Error {
    constructor(message, field) {
      super(message);
      this.field = field;
      this.metadata = { missing: [field] };
    }
  },
}));

const { execSync } = require('child_process');
const fs = require('fs');
const IOSCertificateSetup = require('../../01-client-setup/steps/setup-ios-certificates');
const {
  validateGitUrl,
  validateAppleTeamId,
  validateEnvironmentVariables,
} = require('../../01-client-setup/shared/input-validator');
const { ValidationError } = require('../../shared/utils/error-handler');

describe('IOSCertificateSetup', () => {
  let setup;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});

    fs.existsSync.mockReturnValue(true);

    // Setup environment variables
    process.env.MATCH_GIT_URL = 'git@github.com:org/repo.git';
    process.env.MATCH_PASSWORD = 'test-password';
    process.env.APPLE_TEAM_ID = 'ABCD123456';
    process.env.APP_STORE_CONNECT_API_KEY_ID = 'key-id';
    process.env.APP_STORE_CONNECT_API_ISSUER_ID = 'issuer-id';
    process.env.APP_STORE_CONNECT_API_KEY = 'api-key';

    setup = new IOSCertificateSetup();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.MATCH_GIT_URL;
    delete process.env.MATCH_PASSWORD;
    delete process.env.APPLE_TEAM_ID;
    delete process.env.APP_STORE_CONNECT_API_KEY_ID;
    delete process.env.APP_STORE_CONNECT_API_ISSUER_ID;
    delete process.env.APP_STORE_CONNECT_API_KEY;
  });

  describe('constructor', () => {
    test('initializes with fastlane directory path', () => {
      expect(setup.fastlaneDir).toContain('fastlane');
    });

    test('throws error when fastlane directory not found', () => {
      fs.existsSync.mockReturnValue(false);

      expect(() => new IOSCertificateSetup()).toThrow('Fastlane directory not found');
    });
  });

  describe('getFastlaneDir()', () => {
    test('returns path to fastlane directory', () => {
      const dir = setup.getFastlaneDir();

      expect(dir).toContain('02-build-deploy');
      expect(dir).toContain('fastlane');
    });
  });

  describe('checkEnvironmentVariables()', () => {
    test('returns true when all env vars are set and valid', () => {
      validateEnvironmentVariables.mockImplementation(() => {});
      validateGitUrl.mockImplementation(() => {});
      validateAppleTeamId.mockImplementation(() => {});

      const result = setup.checkEnvironmentVariables();

      expect(result).toBe(true);
    });

    test('returns false when env vars are missing', () => {
      validateEnvironmentVariables.mockImplementation(() => {
        throw new ValidationError('Missing vars', 'MATCH_GIT_URL');
      });

      const result = setup.checkEnvironmentVariables();

      expect(result).toBe(false);
    });

    test('returns false when MATCH_GIT_URL format is invalid', () => {
      validateEnvironmentVariables.mockImplementation(() => {});
      validateGitUrl.mockImplementation(() => {
        throw new ValidationError('Invalid Git URL', 'MATCH_GIT_URL');
      });

      const result = setup.checkEnvironmentVariables();

      expect(result).toBe(false);
    });

    test('returns false when APPLE_TEAM_ID format is invalid', () => {
      validateEnvironmentVariables.mockImplementation(() => {});
      validateGitUrl.mockImplementation(() => {});
      validateAppleTeamId.mockImplementation(() => {
        throw new ValidationError('Invalid Team ID', 'APPLE_TEAM_ID');
      });

      const result = setup.checkEnvironmentVariables();

      expect(result).toBe(false);
    });

    test('returns false when API key is empty', () => {
      process.env.APP_STORE_CONNECT_API_KEY = '';
      validateEnvironmentVariables.mockImplementation(() => {});
      validateGitUrl.mockImplementation(() => {});
      validateAppleTeamId.mockImplementation(() => {});

      const result = setup.checkEnvironmentVariables();

      expect(result).toBe(false);
    });
  });

  describe('checkClientConfigured()', () => {
    test('returns true when config.json exists', () => {
      fs.existsSync.mockReturnValue(true);

      const result = setup.checkClientConfigured('demo', 'com.example.demo');

      expect(result).toBe(true);
    });

    test('returns false when config.json not found', () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.includes('config.json')) return false;
        return true;
      });

      const result = setup.checkClientConfigured('demo', 'com.example.demo');

      expect(result).toBe(false);
    });
  });

  describe('execFastlane()', () => {
    test('executes fastlane command', () => {
      execSync.mockReturnValue('  output  ');

      const result = setup.execFastlane('fastlane ios test');

      expect(result).toBe('output');
      expect(execSync).toHaveBeenCalledWith(
        'fastlane ios test',
        expect.objectContaining({
          cwd: setup.fastlaneDir,
        })
      );
    });

    test('passes environment variables', () => {
      execSync.mockReturnValue('');

      setup.execFastlane('fastlane ios test');

      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          env: expect.objectContaining({
            LC_ALL: 'en_US.UTF-8',
            LANG: 'en_US.UTF-8',
          }),
        })
      );
    });

    test('throws error on command failure', () => {
      execSync.mockImplementation(() => {
        throw new Error('fastlane failed');
      });

      expect(() => setup.execFastlane('fastlane ios test')).toThrow('Fastlane command failed');
    });

    test('uses pipe stdio when silent option is true', () => {
      execSync.mockReturnValue('');

      setup.execFastlane('fastlane ios test', { silent: true });

      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          stdio: 'pipe',
        })
      );
    });
  });

  describe('setupCertificates()', () => {
    beforeEach(() => {
      validateEnvironmentVariables.mockImplementation(() => {});
      validateGitUrl.mockImplementation(() => {});
      validateAppleTeamId.mockImplementation(() => {});
      fs.existsSync.mockReturnValue(true);
      execSync.mockReturnValue('');
    });

    test('sets up certificates successfully', async () => {
      const result = await setup.setupCertificates('demo', 'com.example.demo');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
    });

    test('runs fastlane sync_certificates_appstore', async () => {
      await setup.setupCertificates('demo', 'com.example.demo');

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('fastlane ios sync_certificates_appstore client:demo'),
        expect.anything()
      );
    });

    test('returns skipped result when env vars missing', async () => {
      validateEnvironmentVariables.mockImplementation(() => {
        throw new ValidationError('Missing', 'VAR');
      });

      const result = await setup.setupCertificates('demo', 'com.example.demo');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('missing_env_vars');
    });

    test('returns skipped result when client not configured', async () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.includes('config.json')) return false;
        return true;
      });

      const result = await setup.setupCertificates('demo', 'com.example.demo');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('client_not_configured');
    });

    test('returns error result when fastlane fails', async () => {
      execSync.mockImplementation(() => {
        throw new Error('Fastlane error');
      });

      const result = await setup.setupCertificates('demo', 'com.example.demo');

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(false);
      expect(result.error).toContain('Fastlane');
    });
  });
});
