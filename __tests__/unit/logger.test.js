/**
 * Tests for shared/utils/logger.js
 * Tests the Logger class for console and file logging
 */

// Create chalk mock with all needed methods
const mockChalkFn = (str) => str;
const createChalkChain = () => {
  const fn = Object.assign(jest.fn(mockChalkFn), {
    bold: Object.assign(jest.fn(mockChalkFn), {
      green: jest.fn(mockChalkFn),
      cyan: jest.fn(mockChalkFn),
      white: jest.fn(mockChalkFn),
    }),
  });
  return fn;
};

jest.mock('chalk', () => ({
  green: Object.assign(jest.fn((str) => str), { bold: jest.fn((str) => str) }),
  red: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  blue: jest.fn((str) => str),
  cyan: jest.fn((str) => str),
  gray: jest.fn((str) => str),
  white: jest.fn((str) => str),
  bold: Object.assign(jest.fn((str) => str), {
    cyan: jest.fn((str) => str),
    white: jest.fn((str) => str),
    green: jest.fn((str) => str),
  }),
}));

jest.mock('ora', () => {
  const mockSpinner = {
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: '',
  };
  return jest.fn(() => mockSpinner);
});

jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    log: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    printf: jest.fn(),
  },
  transports: {
    File: jest.fn(),
  },
}));

// Mock fs before requiring the module
const mockFs = {
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
};
jest.mock('fs', () => mockFs);

describe('Logger', () => {
  let Logger;
  let logger;
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Re-require to get fresh instance
    Logger = require('../../shared/utils/logger');
    logger = Logger;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('setupWinston()', () => {
    test('creates logs directory if not exists', () => {
      mockFs.existsSync.mockReturnValue(false);

      jest.resetModules();
      require('../../shared/utils/logger');

      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });

    test('configures winston logger', () => {
      const winston = require('winston');

      expect(winston.createLogger).toHaveBeenCalled();
    });
  });

  describe('success()', () => {
    test('logs success message to console', () => {
      logger.success('Operation completed');

      expect(consoleSpy).toHaveBeenCalled();
    });

    test('logs to file via winston', () => {
      logger.success('Operation completed');

      expect(logger.winstonLogger.log).toHaveBeenCalledWith('info', expect.stringContaining('Operation completed'));
    });
  });

  describe('error()', () => {
    test('logs error message to console', () => {
      logger.error('Something went wrong');

      expect(consoleSpy).toHaveBeenCalled();
    });

    test('logs to file with error level', () => {
      logger.error('Something went wrong');

      expect(logger.winstonLogger.log).toHaveBeenCalledWith('error', expect.stringContaining('Something went wrong'));
    });
  });

  describe('warn()', () => {
    test('logs warning message to console', () => {
      logger.warn('Deprecation warning');

      expect(consoleSpy).toHaveBeenCalled();
    });

    test('logs to file with warn level', () => {
      logger.warn('Deprecation warning');

      expect(logger.winstonLogger.log).toHaveBeenCalledWith('warn', expect.stringContaining('Deprecation warning'));
    });
  });

  describe('info()', () => {
    test('logs info message to console', () => {
      logger.info('Processing...');

      expect(consoleSpy).toHaveBeenCalled();
    });

    test('logs to file with info level', () => {
      logger.info('Processing...');

      expect(logger.winstonLogger.log).toHaveBeenCalledWith('info', expect.stringContaining('Processing...'));
    });
  });

  describe('section()', () => {
    test('logs section header with border', () => {
      logger.section('Build Started');

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('subSection()', () => {
    test('logs subsection header', () => {
      logger.subSection('Step 1');

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('spinner methods', () => {
    test('startSpinner creates and starts spinner', () => {
      const ora = require('ora');

      logger.startSpinner('Loading...');

      expect(ora).toHaveBeenCalled();
      expect(logger.spinner.start).toHaveBeenCalled();
    });

    test('updateSpinner updates spinner text', () => {
      logger.startSpinner('Loading...');
      logger.updateSpinner('Still loading...');

      expect(logger.spinner.text).toBeDefined();
    });

    test('succeedSpinner stops spinner with success', () => {
      logger.startSpinner('Loading...');
      logger.succeedSpinner('Done!');

      expect(logger.spinner).toBeNull();
    });

    test('failSpinner stops spinner with error', () => {
      logger.startSpinner('Loading...');
      logger.failSpinner('Failed!');

      expect(logger.spinner).toBeNull();
    });

    test('stopSpinner stops spinner without status', () => {
      logger.startSpinner('Loading...');
      logger.stopSpinner();

      expect(logger.spinner).toBeNull();
    });

    test('updateSpinner does nothing if no spinner', () => {
      logger.spinner = null;
      logger.updateSpinner('Text');
      // Should not throw
    });

    test('succeedSpinner does nothing if no spinner', () => {
      logger.spinner = null;
      logger.succeedSpinner('Done');
      // Should not throw
    });

    test('failSpinner does nothing if no spinner', () => {
      logger.spinner = null;
      logger.failSpinner('Failed');
      // Should not throw
    });

    test('stopSpinner does nothing if no spinner', () => {
      logger.spinner = null;
      logger.stopSpinner();
      // Should not throw
    });
  });

  describe('keyValue()', () => {
    test('logs key-value pair', () => {
      logger.keyValue('Name', 'Demo Client');

      expect(consoleSpy).toHaveBeenCalled();
    });

    test('supports indentation', () => {
      logger.keyValue('Name', 'Demo Client', 4);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('credentialsBox()', () => {
    test('displays credentials box', () => {
      logger.credentialsBox('demo', 'admin@test.com', 'password123');

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('summaryBox()', () => {
    test('displays summary with simple values', () => {
      logger.summaryBox({
        'Client Name': 'Demo',
        'Version': '1.0.0',
      });

      expect(consoleSpy).toHaveBeenCalled();
    });

    test('displays summary with nested objects', () => {
      logger.summaryBox({
        'Firebase': {
          projectId: 'demo-project',
          region: 'us-central1',
        },
      });

      expect(consoleSpy).toHaveBeenCalled();
    });

    test('displays summary with arrays', () => {
      logger.summaryBox({
        'Platforms': ['android', 'ios'],
      });

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('blank()', () => {
    test('logs empty line', () => {
      logger.blank();

      expect(consoleSpy).toHaveBeenCalledWith('');
    });
  });

  describe('log()', () => {
    test('logs raw message', () => {
      logger.log('Raw message');

      expect(consoleSpy).toHaveBeenCalledWith('Raw message');
    });
  });

  describe('logToFile()', () => {
    test('strips ANSI color codes', () => {
      logger.logToFile('info', '\u001b[32mColored text\u001b[0m');

      expect(logger.winstonLogger.log).toHaveBeenCalledWith('info', 'Colored text');
    });

    test('does nothing if winstonLogger is null', () => {
      logger.winstonLogger = null;
      logger.logToFile('info', 'Message');
      // Should not throw
    });
  });
});
