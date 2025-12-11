/**
 * Tests for shared/utils/preflight-check.js
 * Tests pre-flight checks for system dependencies
 */

// Mock child_process before requiring the module
const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  execSync: mockExecSync,
}));

// Mock fs
const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  writeFileSync: jest.fn(),
};
jest.mock('fs', () => mockFs);

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock logger
jest.mock('../../shared/utils/logger', () => ({
  startSpinner: jest.fn(),
  succeedSpinner: jest.fn(),
  failSpinner: jest.fn(),
  stopSpinner: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn(),
  blank: jest.fn(),
  section: jest.fn(),
}));

describe('PreflightCheck', () => {
  let PreflightCheck;
  let checker;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set required env vars
    process.env.MASTER_FIREBASE_PROJECT_ID = 'test-project';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/creds.json';

    // Reset modules to get fresh instance
    jest.resetModules();

    // Re-require after reset
    const module = require('../../shared/utils/preflight-check');
    PreflightCheck = module.PreflightCheck;
    checker = new PreflightCheck();
    logger = require('../../shared/utils/logger');
  });

  afterEach(() => {
    delete process.env.MASTER_FIREBASE_PROJECT_ID;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.ANDROID_HOME;
    delete process.env.EXPECTED_GOOGLE_ACCOUNT;
  });

  describe('execCommand()', () => {
    test('returns command output trimmed', () => {
      mockExecSync.mockReturnValue('  command output  ');

      const result = checker.execCommand('test command');

      expect(result).toBe('command output');
    });

    test('returns null on error', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('command failed');
      });

      const result = checker.execCommand('bad command');

      expect(result).toBeNull();
    });
  });

  describe('commandExists()', () => {
    test('returns true when command exists', () => {
      mockExecSync.mockReturnValue('/usr/bin/command');

      const result = checker.commandExists('command');

      expect(result).toBe(true);
    });

    test('returns false when command throws', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = checker.commandExists('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('checkFlutter()', () => {
    test('passes when Flutter found', () => {
      mockExecSync
        .mockReturnValueOnce('/usr/local/bin/flutter')
        .mockReturnValueOnce('Flutter 3.16.0');

      const result = checker.checkFlutter();

      expect(result).toBe(true);
      expect(logger.succeedSpinner).toHaveBeenCalled();
    });

    test('fails when Flutter not found', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = checker.checkFlutter();

      expect(result).toBe(false);
      expect(checker.failed).toBe(true);
    });
  });

  describe('checkFirebaseCLI()', () => {
    test('passes when Firebase CLI found', () => {
      mockExecSync
        .mockReturnValueOnce('/usr/local/bin/firebase')
        .mockReturnValueOnce('12.0.0');

      const result = checker.checkFirebaseCLI();

      expect(result).toBe(true);
    });

    test('fails when Firebase CLI not found', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = checker.checkFirebaseCLI();

      expect(result).toBe(false);
      expect(checker.failed).toBe(true);
    });
  });

  describe('checkGcloudCLI()', () => {
    test('passes when gcloud found', () => {
      mockExecSync
        .mockReturnValueOnce('/usr/local/bin/gcloud')
        .mockReturnValueOnce('Google Cloud SDK 450.0.0');

      const result = checker.checkGcloudCLI();

      expect(result).toBe(true);
    });

    test('fails when gcloud not found', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = checker.checkGcloudCLI();

      expect(result).toBe(false);
      expect(checker.failed).toBe(true);
    });
  });

  describe('checkGit()', () => {
    test('passes when Git found', () => {
      mockExecSync
        .mockReturnValueOnce('/usr/bin/git')
        .mockReturnValueOnce('git version 2.39.0');

      const result = checker.checkGit();

      expect(result).toBe(true);
    });

    test('fails when Git not found', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = checker.checkGit();

      expect(result).toBe(false);
      expect(checker.failed).toBe(true);
    });
  });

  describe('checkNode()', () => {
    test('passes when Node version >= 16', () => {
      const result = checker.checkNode();

      // Assuming test runs on Node 16+
      expect(result).toBe(true);
    });
  });

  describe('checkMacOS()', () => {
    test('passes on macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const result = checker.checkMacOS();

      expect(result).toBe(true);
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('warns on non-macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const result = checker.checkMacOS();

      expect(result).toBe(false);
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('checkXcode()', () => {
    test('skips on non-macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const result = checker.checkXcode();

      expect(result).toBe(true);
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('passes when Xcode found on macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      mockExecSync
        .mockReturnValueOnce('/usr/bin/xcodebuild')
        .mockReturnValueOnce('Xcode 15.0');

      const result = checker.checkXcode();

      expect(result).toBe(true);
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('checkAndroidSDK()', () => {
    test('passes when ANDROID_HOME set and exists', () => {
      process.env.ANDROID_HOME = '/path/to/android/sdk';
      mockFs.existsSync.mockReturnValue(true);

      const result = checker.checkAndroidSDK();

      expect(result).toBe(true);
    });

    test('fails when ANDROID_HOME not set', () => {
      delete process.env.ANDROID_HOME;
      delete process.env.ANDROID_SDK_ROOT;

      const result = checker.checkAndroidSDK();

      expect(result).toBe(false);
    });

    test('fails when ANDROID_HOME path does not exist', () => {
      process.env.ANDROID_HOME = '/nonexistent';
      mockFs.existsSync.mockReturnValue(false);

      const result = checker.checkAndroidSDK();

      expect(result).toBe(false);
    });
  });

  describe('checkFastlane()', () => {
    test('passes when Fastlane found', () => {
      mockExecSync
        .mockReturnValueOnce('/usr/local/bin/fastlane')
        .mockReturnValueOnce('fastlane 2.219.0');

      const result = checker.checkFastlane();

      expect(result).toBe(true);
    });

    test('fails when Fastlane not found', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = checker.checkFastlane();

      expect(result).toBe(false);
      expect(checker.failed).toBe(true);
    });
  });

  describe('checkEnvVariables()', () => {
    test('passes when required vars set', () => {
      const result = checker.checkEnvVariables();

      expect(result).toBe(true);
    });

    test('fails when vars missing', () => {
      delete process.env.MASTER_FIREBASE_PROJECT_ID;

      const result = checker.checkEnvVariables();

      expect(result).toBe(false);
      expect(checker.failed).toBe(true);
    });
  });

  describe('checkLoyaltyCredentialsRepo()', () => {
    test('passes when repo exists with proper structure', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('.git');

      const result = checker.checkLoyaltyCredentialsRepo();

      expect(result).toBe(true);
    });
  });

  describe('checkCredentialFiles()', () => {
    test('passes when credential files exist', () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = checker.checkCredentialFiles();

      expect(result).toBe(true);
    });

    test('fails when credential files missing', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = checker.checkCredentialFiles();

      expect(result).toBe(false);
      expect(checker.failed).toBe(true);
    });
  });

  describe('checkFirebaseAuth()', () => {
    test('passes when authenticated', async () => {
      mockExecSync.mockReturnValue(JSON.stringify({ projects: [] }));

      const result = await checker.checkFirebaseAuth();

      expect(result).toBe(true);
    });

    test('fails when not authenticated', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not authenticated');
      });

      const result = await checker.checkFirebaseAuth();

      expect(result).toBe(false);
    });
  });

  describe('checkFirebaseAccount()', () => {
    test('skips when EXPECTED_GOOGLE_ACCOUNT not set', () => {
      delete process.env.EXPECTED_GOOGLE_ACCOUNT;

      const result = checker.checkFirebaseAccount();

      expect(result).toBe(true);
    });

    test('passes when correct account', () => {
      process.env.EXPECTED_GOOGLE_ACCOUNT = 'test@example.com';
      mockExecSync.mockReturnValue('Logged in as test@example.com\n');

      const result = checker.checkFirebaseAccount();

      expect(result).toBe(true);
    });

    test('fails when wrong account', () => {
      process.env.EXPECTED_GOOGLE_ACCOUNT = 'expected@example.com';
      mockExecSync.mockReturnValue('Logged in as other@example.com\n');

      const result = checker.checkFirebaseAccount();

      expect(result).toBe(false);
    });
  });

  describe('checkGcloudAccount()', () => {
    test('skips when EXPECTED_GOOGLE_ACCOUNT not set', () => {
      delete process.env.EXPECTED_GOOGLE_ACCOUNT;

      const result = checker.checkGcloudAccount();

      expect(result).toBe(true);
    });

    test('passes when correct account', () => {
      process.env.EXPECTED_GOOGLE_ACCOUNT = 'test@example.com';
      mockExecSync.mockReturnValue('test@example.com\n');

      const result = checker.checkGcloudAccount();

      expect(result).toBe(true);
    });

    test('fails when wrong account', () => {
      process.env.EXPECTED_GOOGLE_ACCOUNT = 'expected@example.com';
      mockExecSync.mockReturnValue('other@example.com\n');

      const result = checker.checkGcloudAccount();

      expect(result).toBe(false);
    });
  });

  describe('checkAndroidKeystoreSetup()', () => {
    test('passes when keytool available', () => {
      mockExecSync.mockReturnValue('/usr/bin/keytool\n');

      const result = checker.checkAndroidKeystoreSetup();

      expect(result).toBe(true);
    });

    test('fails when keytool not available', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('command not found');
      });

      const result = checker.checkAndroidKeystoreSetup();

      expect(result).toBe(false);
    });
  });

  describe('checkIosCertificatesSetup()', () => {
    test('skips on non-macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const result = checker.checkIosCertificatesSetup();

      expect(result).toBe(true);
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});
