const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');
const logger = require('../../shared/utils/logger');

class GitBranchManager {
  constructor(repoPath) {
    this.repoPath = repoPath || process.cwd();
    this.git = simpleGit(this.repoPath);
  }

  // Check if git repository exists
  async isGitRepo() {
    try {
      await this.git.status();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get current branch
  async getCurrentBranch() {
    const status = await this.git.status();
    return status.current;
  }

  // Check if branch exists
  async branchExists(branchName) {
    try {
      const branches = await this.git.branch();
      return branches.all.includes(branchName);
    } catch (error) {
      return false;
    }
  }

  // Create new branch
  async createBranch(branchName, fromBranch = 'main') {
    logger.startSpinner(`Creating branch: ${branchName}...`);

    try {
      // Check if branch already exists
      if (await this.branchExists(branchName)) {
        logger.warn(`Branch ${branchName} already exists`);
        await this.git.checkout(branchName);
        logger.succeedSpinner(`Checked out existing branch: ${branchName}`);
        return { exists: true, branchName };
      }

      // Ensure we're on the base branch
      await this.git.checkout(fromBranch);
      await this.git.pull('origin', fromBranch);

      // Create and checkout new branch
      await this.git.checkoutLocalBranch(branchName);

      logger.succeedSpinner(`Branch created: ${branchName}`);
      return { exists: false, branchName };
    } catch (error) {
      logger.failSpinner('Failed to create branch');
      throw error;
    }
  }

  // Stage files
  async stageFiles(files = []) {
    logger.startSpinner('Staging files...');

    try {
      if (files.length > 0) {
        await this.git.add(files);
      } else {
        await this.git.add('.');
      }

      logger.succeedSpinner('Files staged');
      return true;
    } catch (error) {
      logger.failSpinner('Failed to stage files');
      throw error;
    }
  }

  // Commit changes
  async commit(message) {
    logger.startSpinner('Creating commit...');

    try {
      const result = await this.git.commit(message);
      logger.succeedSpinner(`Commit created: ${result.commit.substring(0, 7)}`);
      return result.commit;
    } catch (error) {
      logger.failSpinner('Failed to create commit');
      throw error;
    }
  }

  // Push branch to remote
  async pushBranch(branchName, setUpstream = true) {
    logger.startSpinner(`Pushing branch to remote...`);

    try {
      if (setUpstream) {
        await this.git.push('origin', branchName, ['--set-upstream']);
      } else {
        await this.git.push('origin', branchName);
      }

      logger.succeedSpinner(`Branch pushed: ${branchName}`);
      return true;
    } catch (error) {
      logger.failSpinner('Failed to push branch');
      throw error;
    }
  }

  // Create tag
  async createTag(tagName, message) {
    logger.startSpinner(`Creating tag: ${tagName}...`);

    try {
      await this.git.addTag(tagName, message);
      logger.succeedSpinner(`Tag created: ${tagName}`);
      return tagName;
    } catch (error) {
      logger.failSpinner('Failed to create tag');
      throw error;
    }
  }

  // Push tag to remote
  async pushTag(tagName) {
    logger.startSpinner(`Pushing tag to remote...`);

    try {
      await this.git.pushTags('origin');
      logger.succeedSpinner(`Tag pushed: ${tagName}`);
      return true;
    } catch (error) {
      logger.failSpinner('Failed to push tag');
      throw error;
    }
  }

  // List tags for a branch
  async listTags(pattern = null) {
    try {
      const tags = await this.git.tags(pattern ? [pattern] : []);
      return tags.all;
    } catch (error) {
      logger.error(`Failed to list tags: ${error.message}`);
      return [];
    }
  }

  // Checkout tag
  async checkoutTag(tagName) {
    logger.startSpinner(`Checking out tag: ${tagName}...`);

    try {
      await this.git.checkout(tagName);
      logger.succeedSpinner(`Checked out tag: ${tagName}`);
      return true;
    } catch (error) {
      logger.failSpinner('Failed to checkout tag');
      throw error;
    }
  }

  // Commit client configuration to main branch
  async commitClientToMain(clientName) {
    try {
      logger.section('Committing Client to Main Branch');

      // Step 1: Get current branch
      const currentBranch = await this.getCurrentBranch();
      logger.info(`Current branch: ${currentBranch}`);

      // Step 2: Ensure we're on main
      if (currentBranch !== 'main') {
        logger.startSpinner('Switching to main branch...');
        await this.git.checkout('main');
        logger.succeedSpinner('Switched to main');
      }

      // Step 3: Pull latest changes
      logger.startSpinner('Pulling latest changes...');
      await this.git.pull('origin', 'main');
      logger.succeedSpinner('Main branch updated');

      // Step 4: Stage client folder
      logger.startSpinner('Staging client configuration...');
      const clientFolder = `clients/${clientName}`;
      await this.git.add(`${clientFolder}/**`);
      logger.succeedSpinner('Client configuration staged');

      // Step 5: Commit
      logger.startSpinner('Creating commit...');
      const commitMessage = `Add ${clientName} client configuration\n\n- Client config and assets\n- Firebase configuration files\n- App metadata\n- Business type specific assets`;
      const result = await this.git.commit(commitMessage);
      const commitHash = result.commit.substring(0, 7);
      logger.succeedSpinner(`Commit created: ${commitHash}`);

      // Step 6: Push to remote
      logger.startSpinner('Pushing to remote...');
      await this.git.push('origin', 'main');
      logger.succeedSpinner('Main branch pushed');

      logger.blank();
      logger.success('✓ Client configuration saved to main!');
      logger.keyValue('  Client', clientName);
      logger.keyValue('  Folder', clientFolder);
      logger.keyValue('  Commit', commitHash);
      logger.info('  Note: Deploy branch will be created during build phase');
      logger.blank();

      return {
        success: true,
        commitHash: result.commit,
      };
    } catch (error) {
      logger.error(`Failed to commit client to main: ${error.message}`);
      throw error;
    }
  }

  // Complete client branch setup (DEPRECATED - will be moved to deploy phase)
  async setupClientBranch(config) {
    const { clientName } = config;

    logger.warn('⚠️  setupClientBranch is deprecated');
    logger.info('   Using simplified commitClientToMain instead');
    logger.info('   Deploy branch creation moved to build phase');
    logger.blank();

    return await this.commitClientToMain(clientName);
  }

  // Create deployment tag
  async createDeploymentTag(clientName, version, buildNumber, message = null) {
    const tagName = `${clientName}/v${version}+${buildNumber}`;
    const tagMessage = message || `Release v${version} build ${buildNumber} for ${clientName}`;

    await this.createTag(tagName, tagMessage);
    await this.pushTag(tagName);

    return tagName;
  }
}

module.exports = GitBranchManager;

// Allow running directly for testing
if (require.main === module) {
  const test = async () => {
    try {
      const gitManager = new GitBranchManager();

      // Test: Check if git repo
      const isRepo = await gitManager.isGitRepo();
      logger.info(`Is git repository: ${isRepo}`);

      if (!isRepo) {
        logger.error('Not a git repository');
        process.exit(1);
      }

      // Test: Get current branch
      const currentBranch = await gitManager.getCurrentBranch();
      logger.info(`Current branch: ${currentBranch}`);

      // Test: List tags
      const tags = await gitManager.listTags();
      logger.info(`Total tags: ${tags.length}`);

      logger.success('Git operations test completed!');
      process.exit(0);
    } catch (error) {
      logger.error(`Test failed: ${error.message}`);
      process.exit(1);
    }
  };

  test();
}
