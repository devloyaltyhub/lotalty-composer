/**
 * Tests for git-credentials-manager.js
 * Tests Git operations for the loyalty-credentials repository
 *
 * Note: The manager delegates low-level git operations to git-executor.js.
 * Methods like isGitInitialized, hasUncommittedChanges, hasAnyCommits
 * are on the git-executor module, not on the manager instance.
 */

const path = require('path');

// Mock dependencies before requiring module
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  chmodSync: jest.fn(),
}));

jest.mock('chalk', () => ({
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  red: jest.fn((str) => str),
  cyan: jest.fn((str) => str),
  gray: jest.fn((str) => str),
  white: jest.fn((str) => str),
}));

jest.mock('../../01-client-setup/config', () => ({
  git: {
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
  },
}));

jest.mock('../../shared/utils/error-handler', () => ({
  ErrorHandler: {
    retry: jest.fn((fn) => fn()),
  },
  GitError: class GitError extends Error {
    constructor(message, command, details) {
      super(message);
      this.command = command;
      this.details = details;
    }
  },
}));

// Mock git-executor (the sub-module that GitCredentialsManager now delegates to)
jest.mock('../../01-client-setup/steps/git-executor', () => ({
  execGit: jest.fn(),
  isGitInitialized: jest.fn(),
  hasUncommittedChanges: jest.fn(),
  hasAnyCommits: jest.fn(),
  hasRemote: jest.fn(),
  getTrackedFiles: jest.fn(),
  getStagedChanges: jest.fn(),
}));

// Mock git-commit-messages
jest.mock('../../01-client-setup/steps/git-commit-messages', () => ({
  androidKeystoreCommitMessage: jest.fn((code, name) => `Add Android keystores for ${name}`),
  iosProfilesCommitMessage: jest.fn((code, name) => `Add iOS profiles for ${name}`),
  initialCommitMessage: jest.fn(() => 'Initial commit'),
  escapeCommitMessage: jest.fn((msg) => msg),
}));

const { execSync } = require('child_process');
const fs = require('fs');
const gitExecutor = require('../../01-client-setup/steps/git-executor');
const GitCredentialsManager = require('../../01-client-setup/steps/git-credentials-manager');

describe('GitCredentialsManager', () => {
  let manager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Default: credentials repo exists
    fs.existsSync.mockReturnValue(true);

    // Default: git-executor mocks
    gitExecutor.execGit.mockReturnValue('');
    gitExecutor.isGitInitialized.mockReturnValue(true);
    gitExecutor.hasUncommittedChanges.mockReturnValue(false);
    gitExecutor.hasAnyCommits.mockReturnValue(true);
    gitExecutor.hasRemote.mockReturnValue(false);
    gitExecutor.getTrackedFiles.mockReturnValue('');
    gitExecutor.getStagedChanges.mockReturnValue('');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('initializes with credentials repo path', () => {
      manager = new GitCredentialsManager();
      expect(manager.credentialsRepoPath).toBeDefined();
    });

    test('throws error if credentials repo not found', () => {
      fs.existsSync.mockReturnValue(false);

      expect(() => new GitCredentialsManager()).toThrow('loyalty-credentials repository not found');
    });
  });

  describe('getCredentialsRepoPath()', () => {
    test('returns path to loyalty-credentials', () => {
      manager = new GitCredentialsManager();
      expect(manager.credentialsRepoPath).toContain('loyalty-credentials');
    });
  });

  describe('execGit()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
    });

    test('executes git command via gitExecutor', () => {
      gitExecutor.execGit.mockReturnValue('output');

      const result = manager.execGit('git status');

      expect(gitExecutor.execGit).toHaveBeenCalledWith(
        'git status',
        manager.credentialsRepoPath,
        expect.any(Object)
      );
      expect(result).toBe('output');
    });
  });

  describe('ensureGitInitialized()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
    });

    test('does nothing if already initialized', () => {
      gitExecutor.isGitInitialized.mockReturnValue(true);

      manager.ensureGitInitialized();

      // Should only check, not init
      expect(gitExecutor.isGitInitialized).toHaveBeenCalledWith(manager.credentialsRepoPath);
    });

    test('initializes git if not initialized', () => {
      gitExecutor.isGitInitialized.mockReturnValue(false);
      gitExecutor.execGit.mockReturnValue('');

      manager.ensureGitInitialized();

      expect(gitExecutor.execGit).toHaveBeenCalledWith(
        'git init',
        manager.credentialsRepoPath,
        expect.any(Object)
      );
      expect(gitExecutor.execGit).toHaveBeenCalledWith(
        'git branch -M main',
        manager.credentialsRepoPath,
        expect.any(Object)
      );
    });
  });

  describe('commitAndroidKeystores()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
      fs.readdirSync.mockReturnValue(['keystore-debug.jks', 'keystore-release.jks']);
      gitExecutor.isGitInitialized.mockReturnValue(true);
      gitExecutor.getStagedChanges.mockReturnValue('staged changes');
      gitExecutor.hasRemote.mockReturnValue(false);
    });

    test('commits keystore files when they exist', async () => {
      const result = await manager.commitAndroidKeystores('demo', 'Demo Client');

      expect(result).toBe(true);
      expect(gitExecutor.execGit).toHaveBeenCalledWith(
        expect.stringContaining('git add clients/demo/android'),
        manager.credentialsRepoPath,
        expect.any(Object)
      );
    });

    test('returns false when directory does not exist', async () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.includes('clients/demo/android')) return false;
        return true;
      });

      const result = await manager.commitAndroidKeystores('demo', 'Demo Client');

      expect(result).toBe(false);
    });

    test('returns false when no files to commit', async () => {
      fs.readdirSync.mockReturnValue([]);

      const result = await manager.commitAndroidKeystores('demo', 'Demo Client');

      expect(result).toBe(false);
    });

    test('returns false when files already committed', async () => {
      gitExecutor.getStagedChanges.mockReturnValue('');

      const result = await manager.commitAndroidKeystores('demo', 'Demo Client');

      expect(result).toBe(false);
    });

    test('handles push failure gracefully', async () => {
      gitExecutor.hasRemote.mockReturnValue(true);
      gitExecutor.execGit.mockImplementation((cmd) => {
        if (cmd.includes('git push')) {
          throw new Error('push failed');
        }
        return '';
      });

      const result = await manager.commitAndroidKeystores('demo', 'Demo Client');

      expect(result).toBe(true);
    });
  });

  describe('commitIOSProfiles()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
      fs.readdirSync.mockReturnValue(['profile.mobileprovision']);
      gitExecutor.isGitInitialized.mockReturnValue(true);
      gitExecutor.hasRemote.mockReturnValue(false);
    });

    test('commits iOS profiles when they exist', async () => {
      const result = await manager.commitIOSProfiles('demo', 'Demo Client');

      expect(result).toBe(true);
    });

    test('returns false when directory does not exist', async () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.includes('clients/demo/ios')) return false;
        return true;
      });

      const result = await manager.commitIOSProfiles('demo', 'Demo Client');

      expect(result).toBe(false);
    });

    test('returns false when no files in directory', async () => {
      fs.readdirSync.mockReturnValue([]);

      const result = await manager.commitIOSProfiles('demo', 'Demo Client');

      expect(result).toBe(false);
    });

    test('handles push failure gracefully', async () => {
      gitExecutor.hasRemote.mockReturnValue(true);
      gitExecutor.execGit.mockImplementation((cmd) => {
        if (cmd.includes('git push')) {
          throw new Error('push failed');
        }
        return '';
      });

      const result = await manager.commitIOSProfiles('demo', 'Demo Client');

      expect(result).toBe(true);
    });
  });

  describe('verifyCredentialsCommitted()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
      gitExecutor.isGitInitialized.mockReturnValue(true);
    });

    test('returns android true when files are tracked', () => {
      gitExecutor.getTrackedFiles.mockReturnValue('keystore-debug.jks\nkeystore-release.jks');
      gitExecutor.hasUncommittedChanges.mockReturnValue(false);

      const result = manager.verifyCredentialsCommitted('demo');

      expect(result.android).toBe(true);
      expect(result.uncommittedFiles).toEqual([]);
    });

    test('returns android false when files not tracked', () => {
      gitExecutor.getTrackedFiles.mockReturnValue('');
      gitExecutor.hasUncommittedChanges.mockReturnValue(false);

      const result = manager.verifyCredentialsCommitted('demo');

      expect(result.android).toBe(false);
    });

    test('returns uncommitted files when present', () => {
      gitExecutor.getTrackedFiles.mockReturnValue('keystore.jks');
      gitExecutor.hasUncommittedChanges.mockReturnValue(true);
      gitExecutor.execGit.mockReturnValue('M file1.txt\nA file2.txt');

      const result = manager.verifyCredentialsCommitted('demo');

      expect(result.uncommittedFiles).toEqual(['M file1.txt', 'A file2.txt']);
    });
  });

  describe('createInitialCommit()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
      fs.existsSync.mockReturnValue(true);
      gitExecutor.isGitInitialized.mockReturnValue(true);
    });

    test('skips if repository already has commits', async () => {
      gitExecutor.hasAnyCommits.mockReturnValue(true);

      const result = await manager.createInitialCommit();

      expect(result).toBe(true);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    test('creates folder structure and initial commit', async () => {
      // Mock fs.existsSync to:
      // - Return true for loyalty-credentials base path (for constructor)
      // - Return false for subfolders so they get created
      fs.existsSync.mockImplementation((p) => {
        if (p.endsWith('loyalty-credentials')) return true;
        return false;
      });

      gitExecutor.hasAnyCommits.mockReturnValue(false);

      const result = await manager.createInitialCommit();

      expect(result).toBe(true);
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });
});
