/**
 * Tests for env-loader.js
 * Tests environment variable loading and expansion
 */

// Mock dotenv before requiring module
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

const dotenv = require('dotenv');
const { resolveCredentialPath, loadEnvWithExpansion } = require('../../01-client-setup/shared/env-loader');

describe('env-loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset process.env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('resolveCredentialPath()', () => {
    test('returns undefined when env var does not exist', () => {
      delete process.env.NON_EXISTENT_VAR;

      const result = resolveCredentialPath('NON_EXISTENT_VAR');

      expect(result).toBeUndefined();
    });

    test('expands $HOME in path', () => {
      process.env.HOME = '/Users/testuser';
      process.env.TEST_PATH = '$HOME/credentials/file.json';

      resolveCredentialPath('TEST_PATH');

      expect(process.env.TEST_PATH).toBe('/Users/testuser/credentials/file.json');
    });

    test('expands $USER in path', () => {
      process.env.USER = 'testuser';
      process.env.TEST_PATH = '/home/$USER/credentials';

      resolveCredentialPath('TEST_PATH');

      expect(process.env.TEST_PATH).toBe('/home/testuser/credentials');
    });

    test('expands multiple variables in same path', () => {
      process.env.HOME = '/Users/testuser';
      process.env.PROJECT = 'loyalty-credentials';
      process.env.TEST_PATH = '$HOME/Sites/$PROJECT/file.json';

      resolveCredentialPath('TEST_PATH');

      expect(process.env.TEST_PATH).toBe('/Users/testuser/Sites/loyalty-credentials/file.json');
    });

    test('keeps unresolved variable as-is', () => {
      process.env.TEST_PATH = '$UNDEFINED_VAR/path/to/file';
      delete process.env.UNDEFINED_VAR;

      resolveCredentialPath('TEST_PATH');

      expect(process.env.TEST_PATH).toBe('$UNDEFINED_VAR/path/to/file');
    });

    test('does not modify paths without variables', () => {
      process.env.TEST_PATH = '/absolute/path/to/file.json';

      resolveCredentialPath('TEST_PATH');

      expect(process.env.TEST_PATH).toBe('/absolute/path/to/file.json');
    });

    test('handles empty string value', () => {
      process.env.TEST_PATH = '';

      resolveCredentialPath('TEST_PATH');

      expect(process.env.TEST_PATH).toBe('');
    });

    test('expands variable at end of path', () => {
      process.env.FILENAME = 'credentials.json';
      process.env.TEST_PATH = '/path/to/$FILENAME';

      resolveCredentialPath('TEST_PATH');

      expect(process.env.TEST_PATH).toBe('/path/to/credentials.json');
    });

    test('only matches valid variable names (uppercase with underscores)', () => {
      process.env.valid_var = 'should-not-match';
      process.env.TEST_PATH = '$valid_var/path';

      resolveCredentialPath('TEST_PATH');

      // lowercase variables should not be matched
      expect(process.env.TEST_PATH).toBe('$valid_var/path');
    });

    test('handles variable names with numbers', () => {
      process.env.VAR123 = 'value123';
      process.env.TEST_PATH = '/path/$VAR123/file';

      resolveCredentialPath('TEST_PATH');

      expect(process.env.TEST_PATH).toBe('/path/value123/file');
    });
  });

  describe('loadEnvWithExpansion()', () => {
    test('calls dotenv.config with correct path', () => {
      const scriptDir = '/Users/test/loyalty-compose/01-client-setup/cli';

      loadEnvWithExpansion(scriptDir);

      expect(dotenv.config).toHaveBeenCalledWith({
        path: expect.stringContaining('.env'),
      });
    });

    test('expands MASTER_FIREBASE_SERVICE_ACCOUNT', () => {
      process.env.HOME = '/Users/testuser';
      process.env.MASTER_FIREBASE_SERVICE_ACCOUNT = '$HOME/credentials/firebase.json';

      loadEnvWithExpansion('/test/dir');

      expect(process.env.MASTER_FIREBASE_SERVICE_ACCOUNT).toBe('/Users/testuser/credentials/firebase.json');
    });

    test('expands GOOGLE_APPLICATION_CREDENTIALS', () => {
      process.env.HOME = '/Users/testuser';
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '$HOME/credentials/service-account.json';

      loadEnvWithExpansion('/test/dir');

      expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBe('/Users/testuser/credentials/service-account.json');
    });

    test('expands GOOGLE_PLAY_JSON_KEY', () => {
      process.env.HOME = '/Users/testuser';
      process.env.GOOGLE_PLAY_JSON_KEY = '$HOME/credentials/play-store.json';

      loadEnvWithExpansion('/test/dir');

      expect(process.env.GOOGLE_PLAY_JSON_KEY).toBe('/Users/testuser/credentials/play-store.json');
    });

    test('expands APP_STORE_CONNECT_API_KEY', () => {
      process.env.HOME = '/Users/testuser';
      process.env.APP_STORE_CONNECT_API_KEY = '$HOME/credentials/app-store.json';

      loadEnvWithExpansion('/test/dir');

      expect(process.env.APP_STORE_CONNECT_API_KEY).toBe('/Users/testuser/credentials/app-store.json');
    });

    test('handles missing credential variables gracefully', () => {
      delete process.env.MASTER_FIREBASE_SERVICE_ACCOUNT;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      delete process.env.GOOGLE_PLAY_JSON_KEY;
      delete process.env.APP_STORE_CONNECT_API_KEY;

      expect(() => loadEnvWithExpansion('/test/dir')).not.toThrow();
    });
  });
});
