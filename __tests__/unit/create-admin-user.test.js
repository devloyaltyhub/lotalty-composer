/**
 * Tests for create-admin-user.js (AdminUserCreator)
 * Tests admin user creation in Firestore
 */

jest.mock('crypto', () => ({
  randomInt: jest.fn(),
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'hashed-password'),
    })),
  })),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const mockAdd = jest.fn().mockResolvedValue({ id: 'test-user-id' });

jest.mock('firebase-admin', () => {
  const mockFirestore = {
    collection: jest.fn(() => ({
      add: mockAdd,
    })),
  };

  const mockAdmin = {
    firestore: jest.fn(() => mockFirestore),
  };

  // Add FieldValue.serverTimestamp to firestore
  mockAdmin.firestore.FieldValue = {
    serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
  };

  return mockAdmin;
});

jest.mock('../../shared/utils/logger', () => ({
  startSpinner: jest.fn(),
  succeedSpinner: jest.fn(),
  failSpinner: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  blank: jest.fn(),
  credentialsBox: jest.fn(),
}));

jest.mock('../../shared/utils/telegram', () => ({
  adminCredentials: jest.fn().mockResolvedValue(),
}));

const crypto = require('crypto');
const fs = require('fs');
const admin = require('firebase-admin');
const AdminUserCreator = require('../../01-client-setup/steps/create-admin-user');
const logger = require('../../shared/utils/logger');
const telegram = require('../../shared/utils/telegram');

describe('AdminUserCreator', () => {
  let creator;
  let mockFirebaseApp;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFirebaseApp = { name: 'test-app' };
    creator = new AdminUserCreator(mockFirebaseApp);

    // Setup crypto mock to return predictable characters
    crypto.randomInt.mockImplementation((min, max) => min);
  });

  describe('constructor', () => {
    test('initializes with Firebase app', () => {
      expect(creator.app).toBe(mockFirebaseApp);
    });

    test('initializes Firestore', () => {
      expect(admin.firestore).toHaveBeenCalledWith(mockFirebaseApp);
    });
  });

  describe('generatePassword()', () => {
    test('generates password of default length (12)', () => {
      const password = creator.generatePassword();

      expect(password.length).toBe(12);
    });

    test('generates password of custom length', () => {
      const password = creator.generatePassword(16);

      expect(password.length).toBe(16);
    });

    test('uses secure random for each character', () => {
      creator.generatePassword(5);

      expect(crypto.randomInt).toHaveBeenCalledTimes(5);
    });

    test('only uses safe characters (no ambiguous chars)', () => {
      // Safe charset excludes: 0, O, I, l, 1
      const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

      crypto.randomInt.mockImplementation((min, max) => {
        expect(max).toBe(charset.length);
        return 0;
      });

      creator.generatePassword(3);
    });
  });

  describe('hashPassword()', () => {
    test('hashes password with SHA-256', () => {
      const result = creator.hashPassword('test-password');

      expect(result).toBe('hashed-password');
      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
    });
  });

  describe('createAdminUser()', () => {
    test('creates admin user in Firestore', async () => {
      const result = await creator.createAdminUser('admin@test.com', 'Admin', 'demo');

      expect(result.success).toBe(true);
      expect(result.userId).toBe('test-user-id');
      expect(result.email).toBe('admin@test.com');
      expect(result.password).toBeDefined();
    });

    test('uses default name if not provided', async () => {
      await creator.createAdminUser('admin@test.com', null, 'demo');

      expect(logger.succeedSpinner).toHaveBeenCalled();
    });

    test('returns plain password for display', async () => {
      const result = await creator.createAdminUser('admin@test.com', 'Admin', 'demo');

      // Password should be plaintext, not hashed
      expect(result.password).not.toBe('hashed-password');
    });

    test('shows spinner while creating', async () => {
      await creator.createAdminUser('admin@test.com', 'Admin', 'demo');

      expect(logger.startSpinner).toHaveBeenCalledWith('Creating admin user...');
    });

    test('handles Firestore error', async () => {
      mockAdd.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(creator.createAdminUser('admin@test.com', 'Admin', 'demo')).rejects.toThrow();
      expect(logger.failSpinner).toHaveBeenCalled();
    });
  });

  describe('saveCredentialsToFile()', () => {
    test('saves credentials to file', () => {
      fs.existsSync.mockReturnValue(true);

      const result = creator.saveCredentialsToFile('/clients/demo', 'demo', 'admin@test.com', 'pass123');

      expect(result).toContain('admin-credentials.txt');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('creates directory if not exists', () => {
      fs.existsSync.mockReturnValue(false);

      creator.saveCredentialsToFile('/clients/demo', 'demo', 'admin@test.com', 'pass123');

      expect(fs.mkdirSync).toHaveBeenCalledWith('/clients/demo', { recursive: true });
    });

    test('includes all required information', () => {
      fs.existsSync.mockReturnValue(true);

      creator.saveCredentialsToFile('/clients/demo', 'demo', 'admin@test.com', 'pass123');

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('demo');
      expect(writtenContent).toContain('admin@test.com');
      expect(writtenContent).toContain('pass123');
    });

    test('handles write error gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('write failed');
      });

      const result = creator.saveCredentialsToFile('/clients/demo', 'demo', 'admin@test.com', 'pass');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('displayCredentials()', () => {
    test('displays credentials box', () => {
      creator.displayCredentials('demo', 'admin@test.com', 'pass123', 'Demo Client');

      expect(logger.credentialsBox).toHaveBeenCalledWith('demo', 'admin@test.com', 'pass123');
    });

    test('shows file path info', () => {
      creator.displayCredentials('demo', 'admin@test.com', 'pass123', 'demo-client');

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('clients/demo-client/admin-credentials.txt')
      );
    });
  });

  describe('sendCredentialsViaTelegram()', () => {
    test('sends credentials via Telegram', async () => {
      await creator.sendCredentialsViaTelegram('Demo Client', 'demo', 'admin@test.com', 'pass123');

      expect(telegram.adminCredentials).toHaveBeenCalledWith(
        'Demo Client',
        'demo',
        'admin@test.com',
        'pass123'
      );
    });

    test('handles Telegram error gracefully', async () => {
      telegram.adminCredentials.mockRejectedValue(new Error('Telegram error'));

      await creator.sendCredentialsViaTelegram('Demo', 'demo', 'admin@test.com', 'pass');

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('createAndNotify()', () => {
    test('creates user and saves credentials', async () => {
      fs.existsSync.mockReturnValue(true);

      const result = await creator.createAndNotify({
        email: 'admin@test.com',
        name: 'Admin',
        clientCode: 'demo',
        clientName: 'Demo Client',
        clientFolder: '/clients/demo',
        sendTelegram: false,
        displayNow: false,
      });

      expect(result.success).toBe(true);
      expect(result.credentialsFile).toContain('admin-credentials.txt');
    });

    test('sends Telegram when enabled', async () => {
      fs.existsSync.mockReturnValue(true);

      await creator.createAndNotify({
        email: 'admin@test.com',
        name: 'Admin',
        clientCode: 'demo',
        clientName: 'Demo Client',
        clientFolder: '/clients/demo',
        sendTelegram: true,
        displayNow: false,
      });

      expect(telegram.adminCredentials).toHaveBeenCalled();
    });

    test('displays credentials when displayNow is true', async () => {
      fs.existsSync.mockReturnValue(true);

      await creator.createAndNotify({
        email: 'admin@test.com',
        name: 'Admin',
        clientCode: 'demo',
        clientName: 'demo',
        clientFolder: '/clients/demo',
        sendTelegram: false,
        displayNow: true,
      });

      expect(logger.credentialsBox).toHaveBeenCalled();
    });

    test('does not display when displayNow is false', async () => {
      fs.existsSync.mockReturnValue(true);

      await creator.createAndNotify({
        email: 'admin@test.com',
        name: 'Admin',
        clientCode: 'demo',
        clientName: 'demo',
        clientFolder: '/clients/demo',
        sendTelegram: false,
        displayNow: false,
      });

      expect(logger.credentialsBox).not.toHaveBeenCalled();
    });
  });
});
