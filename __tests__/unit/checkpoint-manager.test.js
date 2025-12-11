/**
 * Tests for shared/utils/checkpoint-manager.js
 * Tests checkpoint management for long-running wizards
 */

// Mock fs before requiring the module
const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  readdirSync: jest.fn(),
};
jest.mock('fs', () => mockFs);

// Mock logger
jest.mock('../../shared/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  blank: jest.fn(),
  keyValue: jest.fn(),
}));

describe('CheckpointManager', () => {
  let CheckpointManager;
  let manager;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    CheckpointManager = require('../../shared/utils/checkpoint-manager');
    logger = require('../../shared/utils/logger');
    manager = new CheckpointManager('client-creation', 'demo');
  });

  describe('constructor', () => {
    test('initializes with wizard type and identifier', () => {
      expect(manager.wizardType).toBe('client-creation');
      expect(manager.identifier).toBe('demo');
    });

    test('sets correct checkpoint file path', () => {
      expect(manager.checkpointFile).toContain('client-creation-demo.json');
    });
  });

  describe('_ensureDir()', () => {
    test('creates directory if not exists', () => {
      mockFs.existsSync.mockReturnValue(false);

      manager._ensureDir();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    test('does nothing if directory exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      manager._ensureDir();

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('saveCheckpoint()', () => {
    test('saves checkpoint to file', () => {
      mockFs.existsSync.mockReturnValue(true);

      manager.saveCheckpoint('firebase_created', { projectId: 'demo-123' });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('client-creation-demo.json'),
        expect.stringContaining('firebase_created'),
        'utf8'
      );
    });

    test('includes wizard type and identifier', () => {
      mockFs.existsSync.mockReturnValue(true);

      manager.saveCheckpoint('step1', {});

      // Find the checkpoint write (not the lock file write)
      const checkpointWriteCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0].endsWith('.json') && !call[0].endsWith('.lock')
      );
      expect(checkpointWriteCall).toBeDefined();

      const written = checkpointWriteCall[1];
      const parsed = JSON.parse(written);

      expect(parsed.wizardType).toBe('client-creation');
      expect(parsed.identifier).toBe('demo');
    });

    test('includes timestamp', () => {
      mockFs.existsSync.mockReturnValue(true);

      manager.saveCheckpoint('step1', {});

      // Find the checkpoint write (not the lock file write)
      const checkpointWriteCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0].endsWith('.json') && !call[0].endsWith('.lock')
      );
      expect(checkpointWriteCall).toBeDefined();

      const written = checkpointWriteCall[1];
      const parsed = JSON.parse(written);

      expect(parsed.timestamp).toBeDefined();
    });

    test('handles write error gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      expect(() => manager.saveCheckpoint('step1', {})).not.toThrow();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('getLastCheckpoint()', () => {
    test('returns null if no checkpoint file', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = manager.getLastCheckpoint();

      expect(result).toBeNull();
    });

    test('returns parsed checkpoint', () => {
      const checkpoint = {
        wizardType: 'client-creation',
        identifier: 'demo',
        stepName: 'firebase_created',
        state: { projectId: 'demo-123' },
        timestamp: '2024-01-01T00:00:00.000Z',
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(checkpoint));

      const result = manager.getLastCheckpoint();

      expect(result).toEqual(checkpoint);
    });

    test('handles read error gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read failed');
      });

      const result = manager.getLastCheckpoint();

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('exists()', () => {
    test('returns true if checkpoint file exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      expect(manager.exists()).toBe(true);
    });

    test('returns false if checkpoint file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(manager.exists()).toBe(false);
    });
  });

  describe('clear()', () => {
    test('deletes checkpoint file if exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      manager.clear();

      expect(mockFs.unlinkSync).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Checkpoint cleared'));
    });

    test('does nothing if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      manager.clear();

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });

    test('handles delete error gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      expect(() => manager.clear()).not.toThrow();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('listCheckpoints() static', () => {
    test('returns empty array if directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = CheckpointManager.listCheckpoints('client-creation');

      expect(result).toEqual([]);
    });

    test('returns checkpoints matching wizard type', () => {
      const checkpoint1 = { wizardType: 'client-creation', identifier: 'demo1' };
      const checkpoint2 = { wizardType: 'client-creation', identifier: 'demo2' };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'client-creation-demo1.json',
        'client-creation-demo2.json',
        'other-type-demo.json',
      ]);
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify(checkpoint1))
        .mockReturnValueOnce(JSON.stringify(checkpoint2));

      const result = CheckpointManager.listCheckpoints('client-creation');

      expect(result).toHaveLength(2);
    });

    test('handles read error gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Read failed');
      });

      const result = CheckpointManager.listCheckpoints('client-creation');

      expect(result).toEqual([]);
    });
  });

  describe('getSummary()', () => {
    test('returns null if no checkpoint', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = manager.getSummary();

      expect(result).toBeNull();
    });

    test('returns summary with step name and age', () => {
      const checkpoint = {
        stepName: 'firebase_created',
        timestamp: new Date().toISOString(),
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(checkpoint));

      const result = manager.getSummary();

      expect(result.stepName).toBe('firebase_created');
      expect(result.age).toBeDefined();
    });
  });

  describe('_getAge()', () => {
    test('returns "just now" for recent timestamps', () => {
      const now = new Date().toISOString();

      const result = manager._getAge(now);

      expect(result).toBe('just now');
    });

    test('returns minutes for timestamps < 1 hour', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const result = manager._getAge(fiveMinutesAgo);

      expect(result).toMatch(/\d+ minutes? ago/);
    });

    test('returns hours for timestamps < 24 hours', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const result = manager._getAge(twoHoursAgo);

      expect(result).toMatch(/\d+ hours? ago/);
    });

    test('returns days for timestamps >= 24 hours', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      const result = manager._getAge(twoDaysAgo);

      expect(result).toMatch(/\d+ days? ago/);
    });

    test('handles singular forms', () => {
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

      expect(manager._getAge(oneMinuteAgo)).toMatch(/1 minute ago/);
      expect(manager._getAge(oneHourAgo)).toMatch(/1 hour ago/);
      expect(manager._getAge(oneDayAgo)).toMatch(/1 day ago/);
    });
  });

  describe('promptResume()', () => {
    test('returns false if no checkpoint', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await manager.promptResume({});

      expect(result).toBe(false);
    });

    test('prompts user to resume', async () => {
      const checkpoint = {
        stepName: 'step1',
        timestamp: new Date().toISOString(),
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(checkpoint));

      const mockInquirer = {
        prompt: jest.fn().mockResolvedValue({ shouldResume: true }),
      };

      const result = await manager.promptResume(mockInquirer);

      expect(result).toBe(true);
      expect(mockInquirer.prompt).toHaveBeenCalled();
    });

    test('clears checkpoint if user declines', async () => {
      const checkpoint = {
        stepName: 'step1',
        timestamp: new Date().toISOString(),
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(checkpoint));

      const mockInquirer = {
        prompt: jest.fn().mockResolvedValue({ shouldResume: false }),
      };

      await manager.promptResume(mockInquirer);

      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });
  });
});
