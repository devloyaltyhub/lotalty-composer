/**
 * Tests for create-git-branch.js (GitBranchManager)
 * Tests Git operations for client branch management
 */

// Mock dependencies before requiring module
jest.mock('simple-git', () => {
  const mockGit = {
    status: jest.fn(),
    branch: jest.fn(),
    checkout: jest.fn(),
    checkoutLocalBranch: jest.fn(),
    pull: jest.fn(),
    add: jest.fn(),
    commit: jest.fn(),
    push: jest.fn(),
    addTag: jest.fn(),
    pushTags: jest.fn(),
    tags: jest.fn(),
  };
  return jest.fn(() => mockGit);
});

jest.mock('../../shared/utils/logger', () => ({
  section: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  success: jest.fn(),
  blank: jest.fn(),
  keyValue: jest.fn(),
  startSpinner: jest.fn(),
  succeedSpinner: jest.fn(),
  failSpinner: jest.fn(),
}));

const simpleGit = require('simple-git');
const GitBranchManager = require('../../01-client-setup/steps/create-git-branch');

describe('GitBranchManager', () => {
  let gitManager;
  let mockGit;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGit = simpleGit();
    gitManager = new GitBranchManager('/test/repo');
  });

  describe('constructor', () => {
    test('initializes with provided repo path', () => {
      const manager = new GitBranchManager('/custom/path');
      expect(manager.repoPath).toBe('/custom/path');
    });

    test('defaults to cwd when no path provided', () => {
      const manager = new GitBranchManager();
      expect(manager.repoPath).toBe(process.cwd());
    });
  });

  describe('isGitRepo()', () => {
    test('returns true for valid git repository', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });

      const result = await gitManager.isGitRepo();
      expect(result).toBe(true);
    });

    test('returns false when not a git repository', async () => {
      mockGit.status.mockRejectedValue(new Error('not a git repository'));

      const result = await gitManager.isGitRepo();
      expect(result).toBe(false);
    });
  });

  describe('getCurrentBranch()', () => {
    test('returns current branch name', async () => {
      mockGit.status.mockResolvedValue({ current: 'feature-branch' });

      const result = await gitManager.getCurrentBranch();
      expect(result).toBe('feature-branch');
    });

    test('returns main when on main branch', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });

      const result = await gitManager.getCurrentBranch();
      expect(result).toBe('main');
    });
  });

  describe('branchExists()', () => {
    test('returns true if branch exists', async () => {
      mockGit.branch.mockResolvedValue({
        all: ['main', 'develop', 'feature/test'],
      });

      const result = await gitManager.branchExists('develop');
      expect(result).toBe(true);
    });

    test('returns false if branch does not exist', async () => {
      mockGit.branch.mockResolvedValue({
        all: ['main', 'develop'],
      });

      const result = await gitManager.branchExists('nonexistent');
      expect(result).toBe(false);
    });

    test('returns false on error', async () => {
      mockGit.branch.mockRejectedValue(new Error('git error'));

      const result = await gitManager.branchExists('any');
      expect(result).toBe(false);
    });
  });

  describe('createBranch()', () => {
    test('checks out existing branch if it exists', async () => {
      mockGit.branch.mockResolvedValue({ all: ['main', 'deploy/test'] });
      mockGit.checkout.mockResolvedValue();

      const result = await gitManager.createBranch('deploy/test');

      expect(result.exists).toBe(true);
      expect(result.branchName).toBe('deploy/test');
      expect(mockGit.checkout).toHaveBeenCalledWith('deploy/test');
    });

    test('creates new branch from main if not exists', async () => {
      mockGit.branch.mockResolvedValue({ all: ['main'] });
      mockGit.checkout.mockResolvedValue();
      mockGit.pull.mockResolvedValue();
      mockGit.checkoutLocalBranch.mockResolvedValue();

      const result = await gitManager.createBranch('deploy/new-client');

      expect(result.exists).toBe(false);
      expect(result.branchName).toBe('deploy/new-client');
      expect(mockGit.checkout).toHaveBeenCalledWith('main');
      expect(mockGit.pull).toHaveBeenCalledWith('origin', 'main');
      expect(mockGit.checkoutLocalBranch).toHaveBeenCalledWith('deploy/new-client');
    });

    test('creates branch from specified base branch', async () => {
      mockGit.branch.mockResolvedValue({ all: ['main', 'develop'] });
      mockGit.checkout.mockResolvedValue();
      mockGit.pull.mockResolvedValue();
      mockGit.checkoutLocalBranch.mockResolvedValue();

      await gitManager.createBranch('feature/test', 'develop');

      expect(mockGit.checkout).toHaveBeenCalledWith('develop');
      expect(mockGit.pull).toHaveBeenCalledWith('origin', 'develop');
    });

    test('throws error on git failure', async () => {
      mockGit.branch.mockResolvedValue({ all: ['main'] });
      mockGit.checkout.mockRejectedValue(new Error('checkout failed'));

      await expect(gitManager.createBranch('test')).rejects.toThrow('checkout failed');
    });
  });

  describe('stageFiles()', () => {
    test('stages specific files when provided', async () => {
      mockGit.add.mockResolvedValue();

      await gitManager.stageFiles(['file1.js', 'file2.js']);

      expect(mockGit.add).toHaveBeenCalledWith(['file1.js', 'file2.js']);
    });

    test('stages all files when no files specified', async () => {
      mockGit.add.mockResolvedValue();

      await gitManager.stageFiles([]);

      expect(mockGit.add).toHaveBeenCalledWith('.');
    });

    test('throws error on failure', async () => {
      mockGit.add.mockRejectedValue(new Error('add failed'));

      await expect(gitManager.stageFiles(['test.js'])).rejects.toThrow('add failed');
    });
  });

  describe('commit()', () => {
    test('creates commit with message', async () => {
      mockGit.commit.mockResolvedValue({ commit: 'abc1234567890' });

      const result = await gitManager.commit('Test commit message');

      expect(result).toBe('abc1234567890');
      expect(mockGit.commit).toHaveBeenCalledWith('Test commit message');
    });

    test('throws error on failure', async () => {
      mockGit.commit.mockRejectedValue(new Error('nothing to commit'));

      await expect(gitManager.commit('test')).rejects.toThrow('nothing to commit');
    });
  });

  describe('pushBranch()', () => {
    test('pushes branch with upstream by default', async () => {
      mockGit.push.mockResolvedValue();

      await gitManager.pushBranch('feature/test');

      expect(mockGit.push).toHaveBeenCalledWith('origin', 'feature/test', ['--set-upstream']);
    });

    test('pushes branch without upstream when specified', async () => {
      mockGit.push.mockResolvedValue();

      await gitManager.pushBranch('feature/test', false);

      expect(mockGit.push).toHaveBeenCalledWith('origin', 'feature/test');
    });

    test('throws error on failure', async () => {
      mockGit.push.mockRejectedValue(new Error('push rejected'));

      await expect(gitManager.pushBranch('test')).rejects.toThrow('push rejected');
    });
  });

  describe('createTag()', () => {
    test('creates tag with name and message', async () => {
      mockGit.addTag.mockResolvedValue();

      const result = await gitManager.createTag('v1.0.0', 'Release version 1.0.0');

      expect(result).toBe('v1.0.0');
      expect(mockGit.addTag).toHaveBeenCalledWith('v1.0.0', 'Release version 1.0.0');
    });

    test('throws error on failure', async () => {
      mockGit.addTag.mockRejectedValue(new Error('tag exists'));

      await expect(gitManager.createTag('v1.0.0', 'test')).rejects.toThrow('tag exists');
    });
  });

  describe('pushTag()', () => {
    test('pushes tags to origin', async () => {
      mockGit.pushTags.mockResolvedValue();

      const result = await gitManager.pushTag('v1.0.0');

      expect(result).toBe(true);
      expect(mockGit.pushTags).toHaveBeenCalledWith('origin');
    });

    test('throws error on failure', async () => {
      mockGit.pushTags.mockRejectedValue(new Error('push failed'));

      await expect(gitManager.pushTag('v1.0.0')).rejects.toThrow('push failed');
    });
  });

  describe('listTags()', () => {
    test('returns all tags when no pattern', async () => {
      mockGit.tags.mockResolvedValue({
        all: ['v1.0.0', 'v1.0.1', 'v2.0.0'],
      });

      const result = await gitManager.listTags();

      expect(result).toEqual(['v1.0.0', 'v1.0.1', 'v2.0.0']);
      expect(mockGit.tags).toHaveBeenCalledWith([]);
    });

    test('returns filtered tags when pattern provided', async () => {
      mockGit.tags.mockResolvedValue({
        all: ['client/v1.0.0', 'client/v1.0.1'],
      });

      const result = await gitManager.listTags('client/*');

      expect(mockGit.tags).toHaveBeenCalledWith(['client/*']);
    });

    test('returns empty array on error', async () => {
      mockGit.tags.mockRejectedValue(new Error('git error'));

      const result = await gitManager.listTags();

      expect(result).toEqual([]);
    });
  });

  describe('checkoutTag()', () => {
    test('checks out specified tag', async () => {
      mockGit.checkout.mockResolvedValue();

      const result = await gitManager.checkoutTag('v1.0.0');

      expect(result).toBe(true);
      expect(mockGit.checkout).toHaveBeenCalledWith('v1.0.0');
    });

    test('throws error on failure', async () => {
      mockGit.checkout.mockRejectedValue(new Error('tag not found'));

      await expect(gitManager.checkoutTag('nonexistent')).rejects.toThrow('tag not found');
    });
  });

  describe('createDeploymentTag()', () => {
    test('creates deployment tag with correct format', async () => {
      mockGit.addTag.mockResolvedValue();
      mockGit.pushTags.mockResolvedValue();

      const result = await gitManager.createDeploymentTag('demo', '1.0.0', 1);

      expect(result).toBe('demo/v1.0.0+1');
      expect(mockGit.addTag).toHaveBeenCalledWith(
        'demo/v1.0.0+1',
        'Release v1.0.0 build 1 for demo'
      );
    });

    test('uses custom message when provided', async () => {
      mockGit.addTag.mockResolvedValue();
      mockGit.pushTags.mockResolvedValue();

      await gitManager.createDeploymentTag('demo', '1.0.0', 1, 'Custom release message');

      expect(mockGit.addTag).toHaveBeenCalledWith('demo/v1.0.0+1', 'Custom release message');
    });

    test('handles complex version strings', async () => {
      mockGit.addTag.mockResolvedValue();
      mockGit.pushTags.mockResolvedValue();

      const result = await gitManager.createDeploymentTag('my-client', '2.1.3-beta', 123);

      expect(result).toBe('my-client/v2.1.3-beta+123');
    });
  });

  describe('commitClientToMain()', () => {
    test('commits client folder to main branch', async () => {
      mockGit.status.mockResolvedValue({ current: 'feature' });
      mockGit.checkout.mockResolvedValue();
      mockGit.pull.mockResolvedValue();
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue({ commit: 'abc123def456' });
      mockGit.push.mockResolvedValue();

      const result = await gitManager.commitClientToMain('test-client');

      expect(result.success).toBe(true);
      expect(result.commitHash).toBe('abc123def456');
      expect(mockGit.checkout).toHaveBeenCalledWith('main');
      expect(mockGit.add).toHaveBeenCalledWith('clients/test-client/**');
    });

    test('stays on main if already on main', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });
      mockGit.pull.mockResolvedValue();
      mockGit.add.mockResolvedValue();
      mockGit.commit.mockResolvedValue({ commit: 'abc123' });
      mockGit.push.mockResolvedValue();

      await gitManager.commitClientToMain('test');

      // Should not call checkout to switch branches (only pull)
      expect(mockGit.checkout).not.toHaveBeenCalled();
    });

    test('throws error on failure', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });
      mockGit.pull.mockRejectedValue(new Error('pull failed'));

      await expect(gitManager.commitClientToMain('test')).rejects.toThrow('pull failed');
    });
  });
});
