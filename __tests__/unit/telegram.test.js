/**
 * Tests for shared/utils/telegram.js
 * Tests Telegram notification functionality
 */

const mockSendMessage = jest.fn().mockResolvedValue();
const mockTelegramBot = jest.fn().mockImplementation(() => ({
  sendMessage: mockSendMessage,
}));

jest.mock('node-telegram-bot-api', () => mockTelegramBot);

jest.mock('../../shared/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
}));

describe('TelegramNotifier', () => {
  let telegram;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set env vars before requiring module
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

    // Reset the implementation to the default working one
    mockTelegramBot.mockImplementation(() => ({
      sendMessage: mockSendMessage,
    }));

    jest.resetModules();
    telegram = require('../../shared/utils/telegram');
    logger = require('../../shared/utils/logger');
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  describe('initialize()', () => {
    test('initializes bot when credentials present', () => {
      expect(telegram.enabled).toBe(true);
      expect(mockTelegramBot).toHaveBeenCalledWith('test-token', { polling: false });
    });

    test('disables when token missing', () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      jest.resetModules();

      const telegram2 = require('../../shared/utils/telegram');

      expect(telegram2.enabled).toBe(false);
    });

    test('disables when chat ID missing', () => {
      delete process.env.TELEGRAM_CHAT_ID;
      jest.resetModules();

      const telegram2 = require('../../shared/utils/telegram');

      expect(telegram2.enabled).toBe(false);
    });

    test('handles initialization error', () => {
      // Make TelegramBot throw an error
      mockTelegramBot.mockImplementation(() => {
        throw new Error('Init failed');
      });

      jest.resetModules();
      const telegram2 = require('../../shared/utils/telegram');

      expect(telegram2.enabled).toBe(false);
    });
  });

  describe('send()', () => {
    test('sends message when enabled', async () => {
      await telegram.send('Test message');

      expect(mockSendMessage).toHaveBeenCalledWith('test-chat-id', 'Test message', { parse_mode: 'Markdown' });
    });

    test('does nothing when disabled', async () => {
      telegram.enabled = false;

      await telegram.send('Test message');

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    test('handles send error gracefully', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Send failed'));

      await telegram.send('Test message');

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('clientCreationStarted()', () => {
    test('sends client creation message', async () => {
      await telegram.clientCreationStarted('Demo Client', 'demo');

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Creating new client'),
        expect.any(Object)
      );
    });

    test('includes client name and code', async () => {
      await telegram.clientCreationStarted('Demo Client', 'demo');

      const message = mockSendMessage.mock.calls[0][1];
      expect(message).toContain('Demo Client');
      expect(message).toContain('demo');
    });
  });

  describe('firebaseProjectCreated()', () => {
    test('sends Firebase project created message', async () => {
      await telegram.firebaseProjectCreated('Demo Client', 'demo-123');

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Firebase Project Created'),
        expect.any(Object)
      );
    });

    test('includes project ID', async () => {
      await telegram.firebaseProjectCreated('Demo Client', 'demo-123');

      const message = mockSendMessage.mock.calls[0][1];
      expect(message).toContain('demo-123');
    });
  });

  describe('buildStarted()', () => {
    test('sends build started message', async () => {
      await telegram.buildStarted('Demo Client', ['android', 'ios']);

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Build Started'),
        expect.any(Object)
      );
    });

    test('includes platforms', async () => {
      await telegram.buildStarted('Demo Client', ['android', 'ios']);

      const message = mockSendMessage.mock.calls[0][1];
      expect(message).toContain('android');
      expect(message).toContain('ios');
    });
  });

  describe('buildCompleted()', () => {
    test('sends build completed message', async () => {
      await telegram.buildCompleted('Demo Client', '1.0.0', '1', ['android', 'ios']);

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Build Completed'),
        expect.any(Object)
      );
    });

    test('includes version and build number', async () => {
      await telegram.buildCompleted('Demo Client', '1.0.0', '42', ['android']);

      const message = mockSendMessage.mock.calls[0][1];
      expect(message).toContain('1.0.0');
      expect(message).toContain('42');
    });
  });

  describe('deploymentStarted()', () => {
    test('sends deployment started message', async () => {
      await telegram.deploymentStarted('Demo Client', ['android']);

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Deployment Started'),
        expect.any(Object)
      );
    });
  });

  describe('deploymentCompleted()', () => {
    test('sends deployment completed message', async () => {
      await telegram.deploymentCompleted('Demo', '1.0.0', '1', ['android', 'ios'], 'demo/v1.0.0+1', '5m 30s');

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Deployment Complete'),
        expect.any(Object)
      );
    });

    test('includes git tag and duration', async () => {
      await telegram.deploymentCompleted('Demo', '1.0.0', '1', ['android'], 'demo/v1.0.0+1', '5m 30s');

      const message = mockSendMessage.mock.calls[0][1];
      expect(message).toContain('demo/v1.0.0+1');
      expect(message).toContain('5m 30s');
    });
  });

  describe('adminCredentials()', () => {
    test('sends admin credentials message', async () => {
      await telegram.adminCredentials('Demo Client', 'demo', 'admin@test.com', 'pass123');

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Admin Credentials Created'),
        expect.any(Object)
      );
    });

    test('includes credentials', async () => {
      await telegram.adminCredentials('Demo Client', 'demo', 'admin@test.com', 'pass123');

      const message = mockSendMessage.mock.calls[0][1];
      expect(message).toContain('admin@test.com');
      expect(message).toContain('pass123');
    });
  });

  describe('clientCreationCompleted()', () => {
    test('sends client creation completed message', async () => {
      await telegram.clientCreationCompleted({
        clientName: 'Demo',
        clientCode: 'demo',
        version: '1.0.0',
        buildNumber: '1',
        platforms: ['android'],
        duration: '10m',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Client Created Successfully'),
        expect.any(Object)
      );
    });
  });

  describe('error()', () => {
    test('sends error message', async () => {
      await telegram.error('Demo Client', 'Something went wrong', 'Firebase Setup');

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Automation Failed'),
        expect.any(Object)
      );
    });

    test('includes error details', async () => {
      await telegram.error('Demo', 'Connection failed', 'Step 2');

      const message = mockSendMessage.mock.calls[0][1];
      expect(message).toContain('Connection failed');
      expect(message).toContain('Step 2');
    });
  });

  describe('rollbackStarted()', () => {
    test('sends rollback started message', async () => {
      await telegram.rollbackStarted('Demo', 'v1.0.1', 'v1.0.0');

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Rollback Started'),
        expect.any(Object)
      );
    });
  });

  describe('rollbackCompleted()', () => {
    test('sends rollback completed message', async () => {
      await telegram.rollbackCompleted('Demo', 'v1.0.0', 'demo/v1.0.0+1');

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Rollback Completed'),
        expect.any(Object)
      );
    });
  });

  describe('updateStarted()', () => {
    test('sends update started message', async () => {
      await telegram.updateStarted('Demo', 'v1.0.1');

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Update Started'),
        expect.any(Object)
      );
    });
  });

  describe('updateCompleted()', () => {
    test('sends update completed message', async () => {
      await telegram.updateCompleted('Demo', '1.0.1', '2', ['android', 'ios']);

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Update Completed'),
        expect.any(Object)
      );
    });
  });
});
