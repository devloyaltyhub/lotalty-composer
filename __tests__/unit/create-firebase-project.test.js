/**
 * Tests for create-firebase-project.js (FirebaseProjectCreator)
 * Tests Firebase project creation and configuration
 */

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  copyFileSync: jest.fn(),
}));

jest.mock('../../shared/utils/logger', () => ({
  startSpinner: jest.fn(),
  updateSpinner: jest.fn(),
  succeedSpinner: jest.fn(),
  failSpinner: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn(),
  blank: jest.fn(),
}));

jest.mock('../../01-client-setup/shared/firebase-manager', () => ({}));

const { execSync } = require('child_process');
const fs = require('fs');
const FirebaseProjectCreator = require('../../01-client-setup/steps/create-firebase-project');
const logger = require('../../shared/utils/logger');

describe('FirebaseProjectCreator', () => {
  let creator;

  beforeEach(() => {
    jest.clearAllMocks();
    creator = new FirebaseProjectCreator();
    fs.existsSync.mockReturnValue(true);
  });

  describe('constructor', () => {
    test('initializes with null projectId', () => {
      expect(creator.projectId).toBeNull();
    });

    test('initializes with null clientFolder', () => {
      expect(creator.clientFolder).toBeNull();
    });
  });

  describe('exec()', () => {
    test('executes command and returns output', () => {
      execSync.mockReturnValue('  output  ');

      const result = creator.exec('test command');

      expect(result).toBe('output');
      expect(execSync).toHaveBeenCalledWith(
        'test command',
        expect.objectContaining({
          encoding: 'utf8',
          stdio: 'pipe',
        })
      );
    });

    test('throws error on command failure', () => {
      execSync.mockImplementation(() => {
        throw new Error('command failed');
      });

      expect(() => creator.exec('bad command')).toThrow('Command failed');
    });

    test('throws timeout error when command times out', () => {
      const error = new Error('timeout');
      error.killed = true;
      error.signal = 'SIGTERM';
      execSync.mockImplementation(() => {
        throw error;
      });

      expect(() => creator.exec('slow command')).toThrow('timed out');
    });
  });

  describe('createProject()', () => {
    test('creates Firebase project', async () => {
      execSync.mockReturnValue('');

      const result = await creator.createProject('test-project', 'Test Project');

      expect(result).toBe('test-project');
      expect(creator.projectId).toBe('test-project');
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('firebase projects:create test-project'),
        expect.anything()
      );
    });

    test('continues if project already exists', async () => {
      execSync.mockImplementation(() => {
        throw new Error('already exists');
      });

      const result = await creator.createProject('existing-project', 'Existing');

      expect(result).toBe('existing-project');
      expect(logger.warn).toHaveBeenCalled();
    });

    test('throws error for other failures', async () => {
      execSync.mockImplementation(() => {
        throw new Error('some other error');
      });

      await expect(creator.createProject('test', 'Test')).rejects.toThrow();
    });
  });

  describe('addAndroidApp()', () => {
    beforeEach(() => {
      creator.projectId = 'test-project';
    });

    test('adds Android app to project', async () => {
      execSync
        .mockReturnValueOnce(JSON.stringify({ result: [] })) // apps:list
        .mockReturnValueOnce(''); // apps:create

      const result = await creator.addAndroidApp('com.example.app', 'My App');

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('firebase apps:create android'),
        expect.anything()
      );
    });

    test('returns true if app already exists', async () => {
      execSync.mockReturnValueOnce(
        JSON.stringify({
          result: [{ packageName: 'com.example.app', displayName: 'My App' }],
        })
      );

      const result = await creator.addAndroidApp('com.example.app', 'My App');

      expect(result).toBe(true);
      expect(logger.succeedSpinner).toHaveBeenCalled();
    });

    test('handles already exists error', async () => {
      execSync
        .mockReturnValueOnce(JSON.stringify({ result: [] }))
        .mockImplementation(() => {
          throw new Error('already exists');
        });

      const result = await creator.addAndroidApp('com.example.app', 'My App');

      expect(result).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('addIosApp()', () => {
    beforeEach(() => {
      creator.projectId = 'test-project';
    });

    test('adds iOS app to project', async () => {
      execSync
        .mockReturnValueOnce(JSON.stringify({ result: [] }))
        .mockReturnValueOnce('');

      const result = await creator.addIosApp('com.example.app', 'My App');

      expect(result).toBe(true);
    });

    test('returns true if app already exists', async () => {
      execSync.mockReturnValueOnce(
        JSON.stringify({
          result: [{ bundleId: 'com.example.app' }],
        })
      );

      const result = await creator.addIosApp('com.example.app', 'My App');

      expect(result).toBe(true);
    });

    test('returns false on failure (non-critical)', async () => {
      execSync
        .mockReturnValueOnce(JSON.stringify({ result: [] }))
        .mockImplementation(() => {
          throw new Error('some error');
        });

      const result = await creator.addIosApp('com.example.app', 'My App');

      expect(result).toBe(false);
    });
  });

  describe('addWebApp()', () => {
    beforeEach(() => {
      creator.projectId = 'test-project';
    });

    test('adds Web app to project', async () => {
      execSync
        .mockReturnValueOnce(JSON.stringify({ result: [] }))
        .mockReturnValueOnce('');

      const result = await creator.addWebApp('My App (Web)');

      expect(result).toBe(true);
    });

    test('returns true if similar app exists', async () => {
      execSync.mockReturnValueOnce(
        JSON.stringify({
          result: [{ displayName: 'My App (Web)' }],
        })
      );

      const result = await creator.addWebApp('My App (Web)');

      expect(result).toBe(true);
    });
  });

  describe('downloadAndroidConfig()', () => {
    beforeEach(() => {
      creator.projectId = 'test-project';
    });

    test('downloads google-services.json', async () => {
      execSync
        .mockReturnValueOnce(JSON.stringify({ result: [{ appId: 'app-123' }] }))
        .mockReturnValueOnce('{"project_info": {}}');

      await creator.downloadAndroidConfig('/path/to/google-services.json');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/path/to/google-services.json',
        expect.any(String)
      );
    });

    test('creates directory if not exists', async () => {
      fs.existsSync.mockReturnValue(false);
      execSync
        .mockReturnValueOnce(JSON.stringify({ result: [{ appId: 'app-123' }] }))
        .mockReturnValueOnce('{}');

      await creator.downloadAndroidConfig('/new/path/google-services.json');

      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    test('throws error when no Android app found', async () => {
      execSync.mockReturnValueOnce(JSON.stringify({ result: [] }));

      await expect(creator.downloadAndroidConfig('/path/config.json')).rejects.toThrow(
        'No Android app found'
      );
    });
  });

  describe('downloadIosConfig()', () => {
    beforeEach(() => {
      creator.projectId = 'test-project';
    });

    test('downloads GoogleService-Info.plist', async () => {
      execSync
        .mockReturnValueOnce(JSON.stringify({ result: [{ appId: 'app-123' }] }))
        .mockReturnValueOnce('<plist></plist>');

      const result = await creator.downloadIosConfig('/path/to/GoogleService-Info.plist');

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('returns false when no iOS app found', async () => {
      execSync.mockReturnValueOnce(JSON.stringify({ result: [] }));

      const result = await creator.downloadIosConfig('/path/config.plist');

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('enableFirestore()', () => {
    beforeEach(() => {
      creator.projectId = 'test-project';
    });

    test('enables Firestore', async () => {
      execSync.mockReturnValue('');

      const result = await creator.enableFirestore();

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('firebase firestore:databases:create'),
        expect.anything()
      );
    });

    test('returns true if Firestore already enabled', async () => {
      execSync.mockImplementation(() => {
        throw new Error('already exists');
      });

      const result = await creator.enableFirestore();

      expect(result).toBe(true);
    });
  });

  describe('parseFirebaseOptions()', () => {
    test('parses firebase_options.dart content', () => {
      const content = `
        static const FirebaseOptions android = FirebaseOptions(
          apiKey: 'android-api-key',
          appId: 'android-app-id',
          messagingSenderId: '123456',
          projectId: 'test-project',
          storageBucket: 'test-project.appspot.com',
        );
        static const FirebaseOptions ios = FirebaseOptions(
          apiKey: 'ios-api-key',
          appId: 'ios-app-id',
          messagingSenderId: '123456',
          projectId: 'test-project',
          storageBucket: 'test-project.appspot.com',
        );
      `;
      fs.readFileSync.mockReturnValue(content);

      const options = creator.parseFirebaseOptions('/path/firebase_options.dart');

      expect(options.projectId).toBe('test-project');
      expect(options.messagingSenderId).toBe('123456');
    });
  });

  describe('grantServiceAccountAccess()', () => {
    beforeEach(() => {
      creator.projectId = 'test-project';
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/credentials.json';
      fs.readFileSync.mockReturnValue(
        JSON.stringify({ client_email: 'sa@test.iam.gserviceaccount.com' })
      );
    });

    afterEach(() => {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    });

    test('grants service account access', () => {
      execSync.mockReturnValue('');

      creator.grantServiceAccountAccess();

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('gcloud projects add-iam-policy-binding'),
        expect.anything()
      );
    });

    test('handles missing credentials gracefully', () => {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      creator.grantServiceAccountAccess();

      expect(logger.warn).toHaveBeenCalled();
    });

    test('handles gcloud errors gracefully', () => {
      execSync.mockImplementation(() => {
        throw new Error('gcloud error');
      });

      // Should not throw
      creator.grantServiceAccountAccess();

      expect(logger.failSpinner).toHaveBeenCalled();
    });
  });

  describe('createClientServiceAccountKey()', () => {
    beforeEach(() => {
      creator.projectId = 'test-project';
    });

    test('creates service account key', async () => {
      execSync.mockReturnValue('');
      fs.existsSync.mockReturnValue(true);

      const result = await creator.createClientServiceAccountKey('/path/service-account.json');

      expect(result).toBe('/path/service-account.json');
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('gcloud iam service-accounts keys create'),
        expect.anything()
      );
    });

    test('throws error when key not created', async () => {
      execSync.mockReturnValue('');
      fs.existsSync.mockReturnValue(false);

      await expect(
        creator.createClientServiceAccountKey('/path/service-account.json')
      ).rejects.toThrow('Service account key was not created');
    });
  });
});
