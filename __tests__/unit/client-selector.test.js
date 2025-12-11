/**
 * Tests for shared/utils/client-selector.js
 * Tests client selection and validation utilities
 */

// Mock fs before requiring the module
const mockFs = {
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  readFileSync: jest.fn(),
};
jest.mock('fs', () => mockFs);

// Mock inquirer
const mockInquirer = {
  prompt: jest.fn(),
};
jest.mock('inquirer', () => mockInquirer);

// Mock logger
jest.mock('../../shared/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

describe('ClientSelector', () => {
  let clientSelector;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Re-require after reset to get fresh instance with mocks
    clientSelector = require('../../shared/utils/client-selector');
    logger = require('../../shared/utils/logger');
  });

  describe('listClients()', () => {
    test('returns empty array if clients directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = clientSelector.listClients();

      expect(result).toEqual([]);
    });

    test('returns clients with valid config.json', () => {
      mockFs.existsSync.mockImplementation((p) => {
        // First call is for clientsPath directory
        if (p.endsWith('clients')) return true;
        // Then for each client's config.json
        return true;
      });
      mockFs.readdirSync.mockReturnValue(['demo', 'test', '.hidden']);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });

      const result = clientSelector.listClients();

      expect(result).toContain('demo');
      expect(result).toContain('test');
      // .hidden should be filtered out because statSync returns isDirectory true
      // but the implementation doesn't filter hidden files by name
    });

    test('excludes directories without config.json', () => {
      mockFs.existsSync.mockImplementation((p) => {
        if (p.endsWith('clients')) return true;
        if (p.includes('demo') && p.includes('config.json')) return true;
        if (p.includes('invalid') && p.includes('config.json')) return false;
        return false;
      });
      mockFs.readdirSync.mockReturnValue(['demo', 'invalid']);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });

      const result = clientSelector.listClients();

      expect(result).toContain('demo');
      expect(result).not.toContain('invalid');
    });
  });

  describe('loadClientConfig()', () => {
    test('loads and parses config.json', () => {
      const mockConfig = { clientName: 'Demo', clientCode: 'demo' };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = clientSelector.loadClientConfig('demo');

      expect(result).toEqual(mockConfig);
    });

    test('throws error if config not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => clientSelector.loadClientConfig('nonexistent')).toThrow('Config file not found');
    });

    test('throws error if config is invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      expect(() => clientSelector.loadClientConfig('demo')).toThrow('Failed to parse config');
    });
  });

  describe('getClientConfigPath()', () => {
    test('returns path to config.json', () => {
      const result = clientSelector.getClientConfigPath('demo');

      expect(result).toContain('clients');
      expect(result).toContain('demo');
      expect(result).toContain('config.json');
    });
  });

  describe('getClientDir()', () => {
    test('returns path to client directory', () => {
      const result = clientSelector.getClientDir('demo');

      expect(result).toContain('clients');
      expect(result).toContain('demo');
    });
  });

  describe('validateClientName()', () => {
    test('returns true for valid name', () => {
      expect(clientSelector.validateClientName('demo')).toBe(true);
      expect(clientSelector.validateClientName('my-client')).toBe(true);
      expect(clientSelector.validateClientName('client_123')).toBe(true);
    });

    test('returns false for null or undefined', () => {
      expect(clientSelector.validateClientName(null)).toBe(false);
      expect(clientSelector.validateClientName(undefined)).toBe(false);
    });

    test('returns false for non-string', () => {
      expect(clientSelector.validateClientName(123)).toBe(false);
      expect(clientSelector.validateClientName({})).toBe(false);
    });

    test('returns false for path traversal attempts', () => {
      expect(clientSelector.validateClientName('../etc')).toBe(false);
      expect(clientSelector.validateClientName('demo/../secret')).toBe(false);
    });

    test('returns false for paths with separators', () => {
      expect(clientSelector.validateClientName('demo/sub')).toBe(false);
      expect(clientSelector.validateClientName('demo\\sub')).toBe(false);
    });
  });

  describe('clientExists()', () => {
    test('returns true if client in list', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['demo']);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });

      const result = clientSelector.clientExists('demo');

      expect(result).toBe(true);
    });

    test('returns false if client not in list', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['other']);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });

      const result = clientSelector.clientExists('demo');

      expect(result).toBe(false);
    });
  });

  describe('selectClient()', () => {
    test('throws error if no clients available', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(clientSelector.selectClient()).rejects.toThrow('No clients available');
      expect(logger.error).toHaveBeenCalled();
    });

    test('prompts user to select client', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['demo']);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ clientName: 'Demo', clientCode: 'demo' }));
      mockInquirer.prompt.mockResolvedValue({ clientName: 'demo' });

      const result = await clientSelector.selectClient();

      expect(result).toBe('demo');
      expect(mockInquirer.prompt).toHaveBeenCalled();
    });

    test('uses custom message', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['demo']);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ clientName: 'Demo', clientCode: 'demo' }));
      mockInquirer.prompt.mockResolvedValue({ clientName: 'demo' });

      await clientSelector.selectClient({ message: 'Choose client:' });

      expect(mockInquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Choose client:' }),
        ])
      );
    });

    test('uses custom format function', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['demo']);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ clientName: 'Demo', clientCode: 'demo' }));
      mockInquirer.prompt.mockResolvedValue({ clientName: 'demo' });

      const format = (name, config) => `Custom: ${config.clientName}`;
      await clientSelector.selectClient({ format });

      expect(mockInquirer.prompt).toHaveBeenCalled();
    });

    test('handles config load error gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['demo']);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read failed');
      });
      mockInquirer.prompt.mockResolvedValue({ clientName: 'demo' });

      await clientSelector.selectClient();

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('selectClientOrPrompt()', () => {
    test('uses argument if valid and exists', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['demo']);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });

      const result = await clientSelector.selectClientOrPrompt('demo');

      expect(result).toBe('demo');
      expect(mockInquirer.prompt).not.toHaveBeenCalled();
    });

    test('throws error if argument is invalid', async () => {
      await expect(clientSelector.selectClientOrPrompt('../invalid')).rejects.toThrow('Invalid client name');
    });

    test('falls back to prompt if client not found', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['other']);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ clientName: 'Other', clientCode: 'other' }));
      mockInquirer.prompt.mockResolvedValue({ clientName: 'other' });

      const result = await clientSelector.selectClientOrPrompt('nonexistent');

      expect(result).toBe('other');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    test('falls back to prompt if no argument', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['demo']);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ clientName: 'Demo', clientCode: 'demo' }));
      mockInquirer.prompt.mockResolvedValue({ clientName: 'demo' });

      const result = await clientSelector.selectClientOrPrompt();

      expect(result).toBe('demo');
    });
  });
});
