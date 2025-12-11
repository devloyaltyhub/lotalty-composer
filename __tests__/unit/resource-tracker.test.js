/**
 * Tests for shared/utils/resource-tracker.js
 * Tests resource tracking and rollback functionality
 */

// Mock fs before requiring the module
const mockFs = {
  existsSync: jest.fn(),
  rmSync: jest.fn(),
  unlinkSync: jest.fn(),
};
jest.mock('fs', () => mockFs);

jest.mock('../../shared/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn(),
}));

describe('ResourceTracker', () => {
  let ResourceTracker;
  let tracker;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    ResourceTracker = require('../../shared/utils/resource-tracker');
    tracker = new ResourceTracker();
    logger = require('../../shared/utils/logger');
  });

  describe('constructor', () => {
    test('initializes with empty resources array', () => {
      expect(tracker.resources).toEqual([]);
    });
  });

  describe('trackFirebaseProject()', () => {
    test('adds Firebase project to tracked resources', () => {
      tracker.trackFirebaseProject('demo-project-123');

      expect(tracker.resources).toHaveLength(1);
      expect(tracker.resources[0].type).toBe('firebase_project');
      expect(tracker.resources[0].projectId).toBe('demo-project-123');
    });

    test('logs tracking info', () => {
      tracker.trackFirebaseProject('demo-project-123');

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('demo-project-123'));
    });
  });

  describe('trackDirectory()', () => {
    test('adds directory to tracked resources', () => {
      tracker.trackDirectory('/path/to/dir');

      expect(tracker.resources).toHaveLength(1);
      expect(tracker.resources[0].type).toBe('directory');
      expect(tracker.resources[0].path).toBe('/path/to/dir');
    });

    test('rollback removes directory', async () => {
      mockFs.existsSync.mockReturnValue(true);
      tracker.trackDirectory('/path/to/dir');

      await tracker.resources[0].rollback();

      expect(mockFs.rmSync).toHaveBeenCalledWith('/path/to/dir', { recursive: true, force: true });
    });

    test('rollback skips if directory does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      tracker.trackDirectory('/path/to/dir');

      await tracker.resources[0].rollback();

      expect(mockFs.rmSync).not.toHaveBeenCalled();
    });
  });

  describe('trackFile()', () => {
    test('adds file to tracked resources', () => {
      tracker.trackFile('/path/to/file.txt');

      expect(tracker.resources).toHaveLength(1);
      expect(tracker.resources[0].type).toBe('file');
      expect(tracker.resources[0].path).toBe('/path/to/file.txt');
    });

    test('rollback removes file', async () => {
      mockFs.existsSync.mockReturnValue(true);
      tracker.trackFile('/path/to/file.txt');

      await tracker.resources[0].rollback();

      expect(mockFs.unlinkSync).toHaveBeenCalledWith('/path/to/file.txt');
    });

    test('rollback skips if file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      tracker.trackFile('/path/to/file.txt');

      await tracker.resources[0].rollback();

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('trackGitBranch()', () => {
    test('adds git branch to tracked resources', () => {
      const mockGitManager = { git: {} };
      tracker.trackGitBranch('feature/demo', mockGitManager);

      expect(tracker.resources).toHaveLength(1);
      expect(tracker.resources[0].type).toBe('git_branch');
      expect(tracker.resources[0].branchName).toBe('feature/demo');
    });

    test('rollback deletes branch', async () => {
      const mockGitManager = {
        git: {
          checkout: jest.fn().mockResolvedValue(),
          deleteLocalBranch: jest.fn().mockResolvedValue(),
          push: jest.fn().mockResolvedValue(),
        },
      };
      tracker.trackGitBranch('feature/demo', mockGitManager);

      await tracker.resources[0].rollback();

      expect(mockGitManager.git.checkout).toHaveBeenCalledWith('main');
      expect(mockGitManager.git.deleteLocalBranch).toHaveBeenCalledWith('feature/demo', true);
    });

    test('rollback handles push error gracefully', async () => {
      const mockGitManager = {
        git: {
          checkout: jest.fn().mockResolvedValue(),
          deleteLocalBranch: jest.fn().mockResolvedValue(),
          push: jest.fn().mockRejectedValue(new Error('remote not found')),
        },
      };
      tracker.trackGitBranch('feature/demo', mockGitManager);

      await tracker.resources[0].rollback();

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('trackGitTag()', () => {
    test('adds git tag to tracked resources', () => {
      const mockGitManager = { git: {} };
      tracker.trackGitTag('v1.0.0', mockGitManager);

      expect(tracker.resources).toHaveLength(1);
      expect(tracker.resources[0].type).toBe('git_tag');
      expect(tracker.resources[0].tagName).toBe('v1.0.0');
    });

    test('rollback deletes tag', async () => {
      const mockGitManager = {
        git: {
          tag: jest.fn().mockResolvedValue(),
          push: jest.fn().mockResolvedValue(),
        },
      };
      tracker.trackGitTag('v1.0.0', mockGitManager);

      await tracker.resources[0].rollback();

      expect(mockGitManager.git.tag).toHaveBeenCalledWith(['-d', 'v1.0.0']);
    });
  });

  describe('trackMasterFirebaseEntry()', () => {
    test('adds master Firebase entry to tracked resources', () => {
      const mockFirebaseClient = {};
      tracker.trackMasterFirebaseEntry('demo', mockFirebaseClient);

      expect(tracker.resources).toHaveLength(1);
      expect(tracker.resources[0].type).toBe('master_firebase_entry');
      expect(tracker.resources[0].clientCode).toBe('demo');
    });

    test('rollback deletes entry from master Firebase', async () => {
      const mockDelete = jest.fn().mockResolvedValue();
      const mockFirebaseClient = {
        getMasterFirestore: jest.fn().mockResolvedValue({
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
              delete: mockDelete,
            }),
          }),
        }),
      };
      tracker.trackMasterFirebaseEntry('demo', mockFirebaseClient);

      await tracker.resources[0].rollback();

      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('trackFirestoreCollection()', () => {
    test('adds Firestore collection to tracked resources', () => {
      const mockFirebaseClient = {};
      tracker.trackFirestoreCollection('demo', 'users', mockFirebaseClient);

      expect(tracker.resources).toHaveLength(1);
      expect(tracker.resources[0].type).toBe('firestore_collection');
      expect(tracker.resources[0].collectionName).toBe('users');
    });
  });

  describe('getSummary()', () => {
    test('returns counts by type', () => {
      tracker.trackFirebaseProject('project1');
      tracker.trackDirectory('/dir1');
      tracker.trackDirectory('/dir2');
      tracker.trackFile('/file1');

      const summary = tracker.getSummary();

      expect(summary.firebase_project).toBe(1);
      expect(summary.directory).toBe(2);
      expect(summary.file).toBe(1);
    });

    test('returns empty object when no resources', () => {
      const summary = tracker.getSummary();

      expect(summary).toEqual({});
    });
  });

  describe('printSummary()', () => {
    test('prints summary to logger', () => {
      tracker.trackFirebaseProject('project1');
      tracker.trackDirectory('/dir1');

      tracker.printSummary();

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Tracked Resources'));
    });
  });

  describe('rollback()', () => {
    test('returns counts when no resources', async () => {
      const result = await tracker.rollback();

      expect(result).toEqual({ success: 0, failed: 0, total: 0 });
    });

    test('executes rollbacks in reverse order', async () => {
      const order = [];
      tracker.resources = [
        { type: 'first', rollback: async () => order.push(1) },
        { type: 'second', rollback: async () => order.push(2) },
        { type: 'third', rollback: async () => order.push(3) },
      ];

      await tracker.rollback();

      expect(order).toEqual([3, 2, 1]);
    });

    test('continues on rollback error', async () => {
      const successRollback = jest.fn().mockResolvedValue();
      tracker.resources = [
        { type: 'success1', rollback: successRollback },
        {
          type: 'failing',
          rollback: async () => {
            throw new Error('rollback failed');
          },
        },
        { type: 'success2', rollback: successRollback },
      ];

      const result = await tracker.rollback();

      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
      expect(successRollback).toHaveBeenCalledTimes(2);
    });

    test('clears resources after rollback', async () => {
      tracker.resources = [{ type: 'test', rollback: jest.fn().mockResolvedValue() }];

      await tracker.rollback();

      expect(tracker.resources).toEqual([]);
    });
  });

  describe('clear()', () => {
    test('clears all resources', () => {
      tracker.trackFirebaseProject('project1');
      tracker.trackDirectory('/dir1');

      tracker.clear();

      expect(tracker.resources).toEqual([]);
    });
  });

  describe('count()', () => {
    test('returns number of tracked resources', () => {
      tracker.trackFirebaseProject('project1');
      tracker.trackDirectory('/dir1');
      tracker.trackFile('/file1');

      expect(tracker.count()).toBe(3);
    });

    test('returns 0 when no resources', () => {
      expect(tracker.count()).toBe(0);
    });
  });
});
