/**
 * Tests for shared/utils/error-handler.js
 * Tests error classes and error handling utilities
 */

jest.mock('../../shared/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  success: jest.fn(),
  blank: jest.fn(),
}));

jest.mock('../../shared/utils/telegram', () => ({
  sendMessage: jest.fn().mockResolvedValue(),
}));

describe('error-handler', () => {
  let errorHandler;
  let ErrorHandler;
  let AutomationError;
  let ValidationError;
  let FirebaseError;
  let GitError;
  let FileSystemError;
  let CommandError;
  let ConfigurationError;
  let ExternalServiceError;
  let TimeoutError;
  let RollbackError;
  let logger;
  let telegram;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    const module = require('../../shared/utils/error-handler');
    errorHandler = module;
    ErrorHandler = module.ErrorHandler;
    AutomationError = module.AutomationError;
    ValidationError = module.ValidationError;
    FirebaseError = module.FirebaseError;
    GitError = module.GitError;
    FileSystemError = module.FileSystemError;
    CommandError = module.CommandError;
    ConfigurationError = module.ConfigurationError;
    ExternalServiceError = module.ExternalServiceError;
    TimeoutError = module.TimeoutError;
    RollbackError = module.RollbackError;

    logger = require('../../shared/utils/logger');
    telegram = require('../../shared/utils/telegram');
  });

  describe('AutomationError', () => {
    test('creates error with message', () => {
      const error = new AutomationError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('AutomationError');
    });

    test('creates error with code', () => {
      const error = new AutomationError('Test error', 'CUSTOM_CODE');

      expect(error.code).toBe('CUSTOM_CODE');
    });

    test('creates error with metadata', () => {
      const error = new AutomationError('Test error', 'CODE', { key: 'value' });

      expect(error.metadata).toEqual({ key: 'value' });
    });

    test('has timestamp', () => {
      const error = new AutomationError('Test error');

      expect(error.timestamp).toBeDefined();
    });

    test('toJSON returns object representation', () => {
      const error = new AutomationError('Test error', 'CODE', { key: 'value' });
      const json = error.toJSON();

      expect(json.name).toBe('AutomationError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe('CODE');
      expect(json.metadata).toEqual({ key: 'value' });
      expect(json.timestamp).toBeDefined();
      expect(json.stack).toBeDefined();
    });
  });

  describe('ValidationError', () => {
    test('creates error with field', () => {
      const error = new ValidationError('Invalid email', 'email');

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.metadata.field).toBe('email');
    });
  });

  describe('FirebaseError', () => {
    test('creates error with operation', () => {
      const error = new FirebaseError('Failed to create project', 'createProject');

      expect(error.code).toBe('FIREBASE_ERROR');
      expect(error.metadata.operation).toBe('createProject');
    });
  });

  describe('GitError', () => {
    test('creates error with command', () => {
      const error = new GitError('Branch not found', 'git checkout feature');

      expect(error.code).toBe('GIT_ERROR');
      expect(error.metadata.command).toBe('git checkout feature');
    });
  });

  describe('FileSystemError', () => {
    test('creates error with path', () => {
      const error = new FileSystemError('File not found', '/path/to/file');

      expect(error.code).toBe('FILESYSTEM_ERROR');
      expect(error.metadata.path).toBe('/path/to/file');
    });
  });

  describe('CommandError', () => {
    test('creates error with command and exit code', () => {
      const error = new CommandError('Command failed', 'npm install', 1);

      expect(error.code).toBe('COMMAND_ERROR');
      expect(error.metadata.command).toBe('npm install');
      expect(error.metadata.exitCode).toBe(1);
    });
  });

  describe('ConfigurationError', () => {
    test('creates error with key', () => {
      const error = new ConfigurationError('Missing API key', 'API_KEY');

      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.metadata.key).toBe('API_KEY');
    });
  });

  describe('ExternalServiceError', () => {
    test('creates error with service', () => {
      const error = new ExternalServiceError('API unavailable', 'Firebase');

      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.metadata.service).toBe('Firebase');
    });
  });

  describe('TimeoutError', () => {
    test('creates error with operation and timeout', () => {
      const error = new TimeoutError('Operation timed out', 'download', 30000);

      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.metadata.operation).toBe('download');
      expect(error.metadata.timeout).toBe(30000);
    });
  });

  describe('RollbackError', () => {
    test('creates error with step', () => {
      const error = new RollbackError('Rollback failed', 'firebase_cleanup');

      expect(error.code).toBe('ROLLBACK_ERROR');
      expect(error.metadata.step).toBe('firebase_cleanup');
    });
  });

  describe('ErrorHandler instance', () => {
    describe('registerCleanup()', () => {
      test('registers cleanup function', () => {
        const handler = new ErrorHandler();
        const cleanupFn = jest.fn();

        handler.registerCleanup(cleanupFn, 'Test cleanup');

        expect(handler.cleanupFunctions).toHaveLength(1);
      });
    });

    describe('clearCleanups()', () => {
      test('clears all cleanup functions', () => {
        const handler = new ErrorHandler();
        handler.registerCleanup(jest.fn(), 'Test');

        handler.clearCleanups();

        expect(handler.cleanupFunctions).toHaveLength(0);
      });
    });

    describe('executeCleanups()', () => {
      test('executes cleanups in reverse order', async () => {
        const handler = new ErrorHandler();
        const order = [];

        handler.registerCleanup(async () => order.push(1), 'First');
        handler.registerCleanup(async () => order.push(2), 'Second');
        handler.registerCleanup(async () => order.push(3), 'Third');

        await handler.executeCleanups();

        expect(order).toEqual([3, 2, 1]);
      });

      test('continues on cleanup error', async () => {
        const handler = new ErrorHandler();
        const cleanupFn = jest.fn();

        handler.registerCleanup(async () => {
          throw new Error('Cleanup failed');
        }, 'Failing');
        handler.registerCleanup(cleanupFn, 'Success');

        await handler.executeCleanups();

        expect(cleanupFn).toHaveBeenCalled();
      });

      test('clears cleanups after execution', async () => {
        const handler = new ErrorHandler();
        handler.registerCleanup(jest.fn(), 'Test');

        await handler.executeCleanups();

        expect(handler.cleanupFunctions).toHaveLength(0);
      });

      test('does nothing if no cleanups registered', async () => {
        const handler = new ErrorHandler();

        await handler.executeCleanups();

        expect(logger.warn).not.toHaveBeenCalled();
      });
    });

    describe('wrapAsync()', () => {
      test('returns wrapped function result on success', async () => {
        const handler = new ErrorHandler();
        const fn = jest.fn().mockResolvedValue('result');

        const wrapped = handler.wrapAsync(fn);
        const result = await wrapped('arg1', 'arg2');

        expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
        expect(result).toBe('result');
      });
    });

    describe('withRetry()', () => {
      test('returns result on first success', async () => {
        const handler = new ErrorHandler();
        const fn = jest.fn().mockResolvedValue('success');

        const result = await handler.withRetry(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
      });

      test('retries on failure', async () => {
        const handler = new ErrorHandler();
        const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');

        const result = await handler.withRetry(fn, { delayMs: 1 });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      test('throws after max retries', async () => {
        const handler = new ErrorHandler();
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        await expect(handler.withRetry(fn, { maxRetries: 2, delayMs: 1 })).rejects.toThrow(
          'Failed after 2 attempts'
        );
      });

      test('calls onRetry callback', async () => {
        const handler = new ErrorHandler();
        const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');
        const onRetry = jest.fn();

        await handler.withRetry(fn, { delayMs: 1, onRetry });

        expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
      });
    });

    describe('makeSafe()', () => {
      test('returns result on success', async () => {
        const handler = new ErrorHandler();
        const fn = jest.fn().mockResolvedValue('result');

        const safeFn = handler.makeSafe(fn, 'Test op');
        const result = await safeFn();

        expect(result).toBe('result');
      });

      test('returns null on error without throwing', async () => {
        const handler = new ErrorHandler();
        const fn = jest.fn().mockRejectedValue(new Error('fail'));

        const safeFn = handler.makeSafe(fn, 'Test op');
        const result = await safeFn();

        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalled();
      });
    });

    describe('validateEnvVars()', () => {
      test('passes when all vars exist', () => {
        const handler = new ErrorHandler();
        process.env.TEST_VAR_1 = 'value1';
        process.env.TEST_VAR_2 = 'value2';

        expect(() => handler.validateEnvVars(['TEST_VAR_1', 'TEST_VAR_2'])).not.toThrow();

        delete process.env.TEST_VAR_1;
        delete process.env.TEST_VAR_2;
      });

      test('throws when vars missing', () => {
        const handler = new ErrorHandler();

        expect(() => handler.validateEnvVars(['MISSING_VAR'])).toThrow('Missing required environment variables');
      });
    });
  });

  describe('ErrorHandler static methods', () => {
    describe('handle()', () => {
      test('logs error message', () => {
        ErrorHandler.handle(new Error('Test error'));

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Test error'));
      });

      test('handles AutomationError', () => {
        const error = new AutomationError('Automation failed', 'CODE');

        const result = ErrorHandler.handle(error);

        expect(result.code).toBe('CODE');
      });

      test('handles regular Error', () => {
        const error = new Error('Regular error');

        const result = ErrorHandler.handle(error);

        expect(result.message).toBe('Regular error');
      });

      test('includes context in log', () => {
        ErrorHandler.handle(new Error('Test'), { context: 'MyFunction' });

        expect(logger.error).toHaveBeenCalledWith('[MyFunction] Test');
      });
    });

    describe('retry()', () => {
      test('returns result on success', async () => {
        const fn = jest.fn().mockResolvedValue('success');

        const result = await ErrorHandler.retry(fn);

        expect(result).toBe('success');
      });

      test('retries with exponential backoff', async () => {
        const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');

        const result = await ErrorHandler.retry(fn, { initialDelay: 1 });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      test('throws last error after max retries', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));

        await expect(ErrorHandler.retry(fn, { maxRetries: 1, initialDelay: 1 })).rejects.toThrow(
          'persistent failure'
        );
      });

      test('respects shouldRetry callback', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('non-retryable'));

        await expect(
          ErrorHandler.retry(fn, {
            initialDelay: 1,
            shouldRetry: () => false,
          })
        ).rejects.toThrow('non-retryable');

        expect(fn).toHaveBeenCalledTimes(1);
      });

      test('respects maxDelay', async () => {
        const fn = jest
          .fn()
          .mockRejectedValueOnce(new Error('fail'))
          .mockRejectedValueOnce(new Error('fail'))
          .mockResolvedValue('success');

        await ErrorHandler.retry(fn, {
          initialDelay: 100,
          maxDelay: 150,
          backoffFactor: 10,
        });

        expect(fn).toHaveBeenCalledTimes(3);
      });
    });

    describe('validateRequired()', () => {
      test('passes when all required params present', () => {
        expect(() =>
          ErrorHandler.validateRequired({ name: 'test', email: 'test@test.com' }, ['name', 'email'])
        ).not.toThrow();
      });

      test('throws ValidationError when params missing', () => {
        expect(() => ErrorHandler.validateRequired({ name: 'test' }, ['name', 'email'])).toThrow(
          ValidationError
        );
      });

      test('includes missing params in error', () => {
        try {
          ErrorHandler.validateRequired({}, ['name', 'email']);
        } catch (error) {
          expect(error.metadata.missing).toEqual(['name', 'email']);
        }
      });
    });
  });
});
