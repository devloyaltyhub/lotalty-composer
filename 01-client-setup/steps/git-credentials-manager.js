const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const config = require('../config');
const { ErrorHandler, GitError } = require('../../shared/utils/error-handler');

/**
 * Git Credentials Manager
 *
 * Manages git operations for the loyalty-credentials repository
 * Handles committing Android keystores and iOS certificates
 */

class GitCredentialsManager {
  constructor() {
    this.credentialsRepoPath = this.getCredentialsRepoPath();
  }

  /**
   * Get path to loyalty-credentials repository
   */
  getCredentialsRepoPath() {
    // From automation/01-client-setup/steps/ → loyaltyhub/loyalty-credentials
    const automationRoot = path.resolve(__dirname, '../..');
    const loyaltyAppRoot = path.resolve(automationRoot, '..');
    const credentialsPath = path.join(loyaltyAppRoot, '..', 'loyalty-credentials');

    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`loyalty-credentials repository not found at: ${credentialsPath}`);
    }

    return credentialsPath;
  }

  /**
   * Execute git command in credentials repo with improved error handling
   * SECURITY FIX: Captures stderr for better debugging
   */
  execGit(command, options = {}) {
    const { retryable = false, silent = false } = options;

    const executeCommand = () => {
      try {
        // SECURITY FIX: Capture both stdout and stderr for better error diagnostics
        const result = execSync(command, {
          cwd: this.credentialsRepoPath,
          encoding: 'utf8',
          stdio: silent ? 'pipe' : ['pipe', 'pipe', 'pipe'],
          timeout: config.git.timeout,
          ...options,
        });
        return result ? result.trim() : '';
      } catch (error) {
        // Enhanced error with stderr output
        const errorMessage = [
          `Git command failed: ${command}`,
          `Exit code: ${error.status}`,
          error.stderr ? `Stderr: ${error.stderr.trim()}` : '',
          error.stdout ? `Stdout: ${error.stdout.trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        throw new GitError(errorMessage, command, {
          exitCode: error.status,
          stderr: error.stderr,
          stdout: error.stdout,
        });
      }
    };

    // SECURITY FIX: Add retry logic for network operations
    if (retryable) {
      return ErrorHandler.retry(executeCommand, {
        maxRetries: config.git.maxRetries,
        initialDelay: config.git.retryDelay,
        shouldRetry: (error) => {
          // Retry on network errors
          const networkErrors = [
            'connection refused',
            'network',
            'timeout',
            'could not resolve host',
          ];
          const errorMsg = error.message.toLowerCase();
          return networkErrors.some((pattern) => errorMsg.includes(pattern));
        },
      });
    }

    return executeCommand();
  }

  /**
   * Check if git repo is initialized
   */
  isGitInitialized() {
    try {
      this.execGit('git rev-parse --git-dir', { silent: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize git repo if not already initialized
   */
  ensureGitInitialized() {
    if (!this.isGitInitialized()) {
      console.log(chalk.yellow('\n⚠️  Git not initialized in loyalty-credentials'));
      console.log(chalk.cyan('   Initializing git repository...'));

      this.execGit('git init');
      this.execGit('git branch -M main');

      console.log(chalk.green('   ✅ Git initialized'));
    }
  }

  /**
   * Check if there are uncommitted changes
   */
  hasUncommittedChanges() {
    try {
      const status = this.execGit('git status --porcelain', { silent: true });
      return status.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Commit Android keystores for a client
   */
  async commitAndroidKeystores(clientCode, clientName) {
    console.log(chalk.blue('\n🔐 Committing Android keystores to loyalty-credentials...'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
      // Ensure git is initialized
      this.ensureGitInitialized();

      const androidPath = `clients/${clientCode}/android`;
      const fullPath = path.join(this.credentialsRepoPath, androidPath);

      // Verify files exist
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Android keystore directory not found: ${fullPath}`);
      }

      const files = fs.readdirSync(fullPath);
      if (files.length === 0) {
        console.log(chalk.yellow('   ⚠️  No keystore files to commit'));
        return false;
      }

      console.log(chalk.cyan(`   Files to commit:`));
      files.forEach((file) => {
        console.log(chalk.gray(`     - ${file}`));
      });

      // Stage Android keystore files
      this.execGit(`git add ${androidPath}/*`);

      // Check if there are changes to commit
      const stagedChanges = this.execGit('git diff --cached --name-only', { silent: true });
      if (!stagedChanges) {
        console.log(chalk.yellow('   ⚠️  No changes to commit (files already committed)'));
        return false;
      }

      // Create commit
      const commitMessage = `Add Android keystores for ${clientName} (${clientCode})

- Generated debug keystore (android-debug-key)
- Generated release keystore (unique password)
- SHA-256 fingerprints for Firebase App Check

Client: ${clientName}
Code: ${clientCode}
Generated: ${new Date().toISOString()}`;

      this.execGit(`git commit -m "${commitMessage.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
      console.log(chalk.green('   ✅ Keystores committed locally'));

      // Push to remote (if remote is configured)
      try {
        const hasRemote = this.execGit('git remote', { silent: true });
        if (hasRemote) {
          console.log(chalk.cyan('\n   Pushing to remote...'));
          this.execGit('git push -u origin main');
          console.log(chalk.green('   ✅ Keystores pushed to remote'));
        } else {
          console.log(chalk.yellow('\n   ⚠️  No git remote configured'));
          console.log(
            chalk.yellow('      Add remote: cd loyalty-credentials && git remote add origin <url>')
          );
        }
      } catch (error) {
        console.log(chalk.yellow('\n   ⚠️  Failed to push to remote'));
        console.log(chalk.gray(`      ${error.message}`));
        console.log(
          chalk.yellow('      You can push manually later: cd loyalty-credentials && git push')
        );
      }

      console.log(chalk.green('\n✅ Android keystores committed successfully!'));
      return true;
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to commit keystores:'), error.message);
      console.log(chalk.yellow('\n   You can commit manually:'));
      console.log(chalk.gray(`   cd ${this.credentialsRepoPath}`));
      console.log(chalk.gray(`   git add clients/${clientCode}/android/`));
      console.log(chalk.gray(`   git commit -m "Add Android keystores for ${clientName}"`));
      console.log(chalk.gray(`   git push`));
      return false;
    }
  }

  /**
   * Commit iOS profiles for a client
   */
  async commitIOSProfiles(clientCode, clientName) {
    console.log(chalk.blue('\n📱 Committing iOS profiles to loyalty-credentials...'));

    try {
      this.ensureGitInitialized();

      const iosPath = `clients/${clientCode}/ios`;
      const fullPath = path.join(this.credentialsRepoPath, iosPath);

      if (!fs.existsSync(fullPath) || fs.readdirSync(fullPath).length === 0) {
        console.log(chalk.yellow('   ⚠️  No iOS profiles to commit'));
        return false;
      }

      this.execGit(`git add ${iosPath}/*`);

      const commitMessage = `Add iOS provisioning profiles for ${clientName} (${clientCode})`;
      this.execGit(`git commit -m "${commitMessage}"`);
      console.log(chalk.green('   ✅ iOS profiles committed'));

      // Push to remote
      try {
        const hasRemote = this.execGit('git remote', { silent: true });
        if (hasRemote) {
          this.execGit('git push');
          console.log(chalk.green('   ✅ iOS profiles pushed to remote'));
        }
      } catch (error) {
        console.log(chalk.yellow('   ⚠️  Failed to push (you can push manually later)'));
      }

      return true;
    } catch (error) {
      console.error(chalk.red('   ❌ Failed to commit iOS profiles:'), error.message);
      return false;
    }
  }

  /**
   * Verify all credentials are committed
   */
  verifyCredentialsCommitted(clientCode) {
    console.log(chalk.cyan(`\n📋 Verifying credentials for ${clientCode}...`));

    const results = {
      android: false,
      uncommittedFiles: [],
    };

    try {
      this.ensureGitInitialized();

      // Check if android files are tracked
      const androidFiles = this.execGit(`git ls-files clients/${clientCode}/android/`, {
        silent: true,
      });
      results.android = androidFiles.length > 0;

      // Check for uncommitted changes
      const status = this.execGit('git status --porcelain', { silent: true });
      if (status) {
        results.uncommittedFiles = status.split('\n').filter(Boolean);
      }

      // Summary
      if (results.android) {
        console.log(chalk.green('   ✅ Android keystores are committed'));
      } else {
        console.log(chalk.yellow('   ⚠️  Android keystores not committed'));
      }

      if (results.uncommittedFiles.length > 0) {
        console.log(
          chalk.yellow(
            `\n   ⚠️  ${results.uncommittedFiles.length} uncommitted files in loyalty-credentials`
          )
        );
      } else {
        console.log(chalk.green('   ✅ All files committed'));
      }

      return results;
    } catch (error) {
      console.error(chalk.red('   ❌ Verification failed:'), error.message);
      return results;
    }
  }

  /**
   * Create initial commit with folder structure
   */
  async createInitialCommit() {
    console.log(chalk.blue('\n🎬 Creating initial commit in loyalty-credentials...'));

    try {
      this.ensureGitInitialized();

      // Check if there are any commits
      const hasCommits = await this.hasAnyCommits();
      if (hasCommits) {
        console.log(chalk.yellow('   ⚠️  Repository already has commits, skipping initial commit'));
        return true;
      }

      // Create folder structure
      const folders = [
        'shared',
        'shared/ios/certs',
        'profiles/development',
        'profiles/appstore',
        'clients',
      ];

      folders.forEach((folder) => {
        const folderPath = path.join(this.credentialsRepoPath, folder);
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }

        // Create .gitkeep to track empty folders
        const gitkeepPath = path.join(folderPath, '.gitkeep');
        if (!fs.existsSync(gitkeepPath)) {
          fs.writeFileSync(gitkeepPath, '');
        }
      });

      // Stage all .gitkeep files
      this.execGit('git add .');

      // Create initial commit
      const commitMessage = `Initial commit: loyalty-credentials repository structure

Created folder structure:
- shared/ - Shared credentials (Firebase, App Store API)
- shared/ios/certs/ - iOS certificates (via Match)
- profiles/ - iOS provisioning profiles (via Match)
- clients/ - Client-specific credentials

Generated: ${new Date().toISOString()}`;

      this.execGit(`git commit -m "${commitMessage.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
      console.log(chalk.green('   ✅ Initial commit created'));

      return true;
    } catch (error) {
      console.error(chalk.red('   ❌ Failed to create initial commit:'), error.message);
      return false;
    }
  }

  /**
   * Check if repository has any commits
   */
  async hasAnyCommits() {
    try {
      this.execGit('git log -1', { silent: true });
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = GitCredentialsManager;
