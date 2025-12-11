/**
 * Tests for git-credentials-manager.js
 * Tests Git operations for the loyalty-credentials repository
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

const { execSync } = require('child_process');
const fs = require('fs');
const GitCredentialsManager = require('../../01-client-setup/steps/git-credentials-manager');

describe('GitCredentialsManager', () => {
  let manager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Default: credentials repo exists
    fs.existsSync.mockReturnValue(true);
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

    test('executes git command in credentials repo', () => {
      execSync.mockReturnValue('output');

      const result = manager.execGit('git status');

      expect(execSync).toHaveBeenCalledWith(
        'git status',
        expect.objectContaining({
          cwd: manager.credentialsRepoPath,
          encoding: 'utf8',
        })
      );
      expect(result).toBe('output');
    });

    test('trims output', () => {
      execSync.mockReturnValue('  output with spaces  ');

      const result = manager.execGit('git status');

      expect(result).toBe('output with spaces');
    });

    test('returns empty string when output is null', () => {
      execSync.mockReturnValue(null);

      const result = manager.execGit('git status');

      expect(result).toBe('');
    });

    test('uses silent stdio when silent option is true', () => {
      execSync.mockReturnValue('');

      manager.execGit('git status', { silent: true });

      expect(execSync).toHaveBeenCalledWith(
        'git status',
        expect.objectContaining({
          stdio: 'pipe',
        })
      );
    });

    test('throws GitError on failure', () => {
      const error = new Error('git failed');
      error.status = 1;
      error.stderr = 'error output';
      execSync.mockImplementation(() => {
        throw error;
      });

      expect(() => manager.execGit('git status')).toThrow();
    });
  });

  describe('isGitInitialized()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
    });

    test('returns true when git repo is initialized', () => {
      execSync.mockReturnValue('.git');

      const result = manager.isGitInitialized();

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        'git rev-parse --git-dir',
        expect.anything()
      );
    });

    test('returns false when not a git repo', () => {
      execSync.mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = manager.isGitInitialized();

      expect(result).toBe(false);
    });
  });

  describe('ensureGitInitialized()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
    });

    test('does nothing if already initialized', () => {
      execSync.mockReturnValue('.git');

      manager.ensureGitInitialized();

      // Only called once for isGitInitialized check
      expect(execSync).toHaveBeenCalledTimes(1);
    });

    test('initializes git if not initialized', () => {
      execSync
        .mockImplementationOnce(() => {
          throw new Error('not a git repo');
        })
        .mockReturnValue('');

      manager.ensureGitInitialized();

      expect(execSync).toHaveBeenCalledWith('git init', expect.anything());
      expect(execSync).toHaveBeenCalledWith('git branch -M main', expect.anything());
    });
  });

  describe('hasUncommittedChanges()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
    });

    test('returns true when there are uncommitted changes', () => {
      execSync.mockReturnValue('M file.txt');

      const result = manager.hasUncommittedChanges();

      expect(result).toBe(true);
    });

    test('returns false when no uncommitted changes', () => {
      execSync.mockReturnValue('');

      const result = manager.hasUncommittedChanges();

      expect(result).toBe(false);
    });

    test('returns false on error', () => {
      execSync.mockImplementation(() => {
        throw new Error('git error');
      });

      const result = manager.hasUncommittedChanges();

      expect(result).toBe(false);
    });
  });

  describe('commitAndroidKeystores()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
      fs.readdirSync.mockReturnValue(['keystore-debug.jks', 'keystore-release.jks']);
      execSync.mockReturnValue('');
    });

    test('commits keystore files when they exist', async () => {
      execSync.mockReturnValueOnce('.git') // isGitInitialized
        .mockReturnValue('staged changes'); // other calls

      const result = await manager.commitAndroidKeystores('demo', 'Demo Client');

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('git add clients/demo/android'),
        expect.anything()
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
      execSync
        .mockReturnValueOnce('.git') // isGitInitialized
        .mockReturnValueOnce('') // git add
        .mockReturnValueOnce(''); // git diff --cached (no staged changes)

      const result = await manager.commitAndroidKeystores('demo', 'Demo Client');

      expect(result).toBe(false);
    });

    test('handles push failure gracefully', async () => {
      execSync
        .mockReturnValueOnce('.git') // isGitInitialized
        .mockReturnValueOnce('') // git add
        .mockReturnValueOnce('staged file') // git diff --cached
        .mockReturnValueOnce('') // git commit
        .mockReturnValueOnce('origin') // git remote
        .mockImplementation(() => {
          throw new Error('push failed');
        }); // git push

      const result = await manager.commitAndroidKeystores('demo', 'Demo Client');

      expect(result).toBe(true);
    });
  });

  describe('commitIOSProfiles()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
      fs.readdirSync.mockReturnValue(['profile.mobileprovision']);
      execSync.mockReturnValue('');
    });

    test('commits iOS profiles when they exist', async () => {
      execSync.mockReturnValueOnce('.git'); // isGitInitialized

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
      execSync
        .mockReturnValueOnce('.git') // isGitInitialized
        .mockReturnValueOnce('') // git add
        .mockReturnValueOnce('') // git commit
        .mockReturnValueOnce('origin') // git remote
        .mockImplementation(() => {
          throw new Error('push failed');
        });

      const result = await manager.commitIOSProfiles('demo', 'Demo Client');

      expect(result).toBe(true);
    });
  });

  describe('verifyCredentialsCommitted()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
      execSync.mockReturnValue('');
    });

    test('returns android true when files are tracked', () => {
      execSync
        .mockReturnValueOnce('.git') // isGitInitialized
        .mockReturnValueOnce('keystore-debug.jks\nkeystore-release.jks') // git ls-files
        .mockReturnValueOnce(''); // git status

      const result = manager.verifyCredentialsCommitted('demo');

      expect(result.android).toBe(true);
      expect(result.uncommittedFiles).toEqual([]);
    });

    test('returns android false when files not tracked', () => {
      execSync
        .mockReturnValueOnce('.git') // isGitInitialized
        .mockReturnValueOnce('') // git ls-files (empty)
        .mockReturnValueOnce(''); // git status

      const result = manager.verifyCredentialsCommitted('demo');

      expect(result.android).toBe(false);
    });

    test('returns uncommitted files when present', () => {
      execSync
        .mockReturnValueOnce('.git')
        .mockReturnValueOnce('keystore.jks')
        .mockReturnValueOnce('M file1.txt\nA file2.txt');

      const result = manager.verifyCredentialsCommitted('demo');

      expect(result.uncommittedFiles).toEqual(['M file1.txt', 'A file2.txt']);
    });
  });

  describe('createInitialCommit()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
      fs.existsSync.mockReturnValue(true);
      execSync.mockReturnValue('');
    });

    test('skips if repository already has commits', async () => {
      execSync
        .mockReturnValueOnce('.git') // isGitInitialized
        .mockReturnValueOnce('abc123'); // git log -1 (has commits)

      const result = await manager.createInitialCommit();

      expect(result).toBe(true);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    test('creates folder structure and initial commit', async () => {
      // Mock fs.existsSync to:
      // - Return true for loyalty-credentials base path (for constructor)
      // - Return false for subfolders (shared, profiles, clients) so they get created
      // - Return false for .gitkeep files so they get written
      fs.existsSync.mockImplementation((p) => {
        // The base loyalty-credentials path exists
        if (p.endsWith('loyalty-credentials')) return true;
        // Subfolders and .gitkeep files don't exist yet
        return false;
      });

      execSync
        .mockReturnValueOnce('.git') // isGitInitialized
        .mockImplementationOnce(() => {
          throw new Error('no commits');
        }) // git log -1 (no commits)
        .mockReturnValue(''); // other git commands

      const result = await manager.createInitialCommit();

      expect(result).toBe(true);
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('hasAnyCommits()', () => {
    beforeEach(() => {
      manager = new GitCredentialsManager();
    });

    test('returns true when commits exist', async () => {
      execSync.mockReturnValue('abc123');

      const result = await manager.hasAnyCommits();

      expect(result).toBe(true);
    });

    test('returns false when no commits', async () => {
      execSync.mockImplementation(() => {
        throw new Error('no commits');
      });

      const result = await manager.hasAnyCommits();

      expect(result).toBe(false);
    });
  });
});
