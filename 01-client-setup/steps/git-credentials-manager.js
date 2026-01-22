const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const gitExecutor = require('./git-executor');
const commitMessages = require('./git-commit-messages');

/**
 * Git Credentials Manager
 *
 * Manages git operations for the loyalty-credentials repository.
 * Handles committing Android keystores and iOS certificates.
 */

class GitCredentialsManager {
  constructor() {
    this.credentialsRepoPath = this.getCredentialsRepoPath();
  }

  getCredentialsRepoPath() {
    const automationRoot = path.resolve(__dirname, '../..');
    const loyaltyAppRoot = path.resolve(automationRoot, '..');
    const credentialsPath = path.join(loyaltyAppRoot, '..', 'loyalty-credentials');

    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`loyalty-credentials repository not found at: ${credentialsPath}`);
    }

    return credentialsPath;
  }

  execGit(command, options = {}) {
    return gitExecutor.execGit(command, this.credentialsRepoPath, options);
  }

  ensureGitInitialized() {
    if (!gitExecutor.isGitInitialized(this.credentialsRepoPath)) {
      console.log(chalk.yellow('\n  Git not initialized in loyalty-credentials'));
      console.log(chalk.cyan('   Initializing git repository...'));

      this.execGit('git init');
      this.execGit('git branch -M main');

      console.log(chalk.green('   Git initialized'));
    }
  }

  async commitAndroidKeystores(clientCode, clientName) {
    console.log(chalk.blue('\n Committing Android keystores to loyalty-credentials...'));
    console.log(chalk.gray('-'.repeat(50)));

    try {
      this.ensureGitInitialized();

      const androidPath = `clients/${clientCode}/android`;
      const fullPath = path.join(this.credentialsRepoPath, androidPath);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`Android keystore directory not found: ${fullPath}`);
      }

      const files = fs.readdirSync(fullPath);
      if (files.length === 0) {
        console.log(chalk.yellow('    No keystore files to commit'));
        return false;
      }

      console.log(chalk.cyan(`   Files to commit:`));
      files.forEach((file) => {
        console.log(chalk.gray(`     - ${file}`));
      });

      this.execGit(`git add ${androidPath}/*`);

      const stagedChanges = gitExecutor.getStagedChanges(this.credentialsRepoPath);
      if (!stagedChanges) {
        console.log(chalk.yellow('    No changes to commit (files already committed)'));
        return false;
      }

      const message = commitMessages.androidKeystoreCommitMessage(clientCode, clientName);
      this.execGit(`git commit -m "${commitMessages.escapeCommitMessage(message)}"`);
      console.log(chalk.green('    Keystores committed locally'));

      this.pushToRemote();

      console.log(chalk.green('\n Android keystores committed successfully!'));
      return true;
    } catch (error) {
      console.error(chalk.red('\n Failed to commit keystores:'), error.message);
      this.logManualCommitInstructions(clientCode, clientName, 'android');
      return false;
    }
  }

  async commitIOSProfiles(clientCode, clientName) {
    console.log(chalk.blue('\n Committing iOS profiles to loyalty-credentials...'));

    try {
      this.ensureGitInitialized();

      const iosPath = `clients/${clientCode}/ios`;
      const fullPath = path.join(this.credentialsRepoPath, iosPath);

      if (!fs.existsSync(fullPath) || fs.readdirSync(fullPath).length === 0) {
        console.log(chalk.yellow('    No iOS profiles to commit'));
        return false;
      }

      this.execGit(`git add ${iosPath}/*`);

      const message = commitMessages.iosProfilesCommitMessage(clientCode, clientName);
      this.execGit(`git commit -m "${message}"`);
      console.log(chalk.green('    iOS profiles committed'));

      this.pushToRemote();

      return true;
    } catch (error) {
      console.error(chalk.red('    Failed to commit iOS profiles:'), error.message);
      return false;
    }
  }

  pushToRemote() {
    try {
      if (gitExecutor.hasRemote(this.credentialsRepoPath)) {
        console.log(chalk.cyan('\n   Pushing to remote...'));
        this.execGit('git push -u origin main');
        console.log(chalk.green('    Pushed to remote'));
      } else {
        console.log(chalk.yellow('\n    No git remote configured'));
        console.log(
          chalk.yellow('      Add remote: cd loyalty-credentials && git remote add origin <url>')
        );
      }
    } catch (error) {
      console.log(chalk.yellow('\n    Failed to push to remote'));
      console.log(chalk.gray(`      ${error.message}`));
      console.log(chalk.yellow('      You can push manually later: cd loyalty-credentials && git push'));
    }
  }

  logManualCommitInstructions(clientCode, clientName, platform) {
    console.log(chalk.yellow('\n   You can commit manually:'));
    console.log(chalk.gray(`   cd ${this.credentialsRepoPath}`));
    console.log(chalk.gray(`   git add clients/${clientCode}/${platform}/`));
    console.log(chalk.gray(`   git commit -m "Add ${platform} credentials for ${clientName}"`));
    console.log(chalk.gray(`   git push`));
  }

  verifyCredentialsCommitted(clientCode) {
    console.log(chalk.cyan(`\n Verifying credentials for ${clientCode}...`));

    const results = {
      android: false,
      uncommittedFiles: [],
    };

    try {
      this.ensureGitInitialized();

      const androidFiles = gitExecutor.getTrackedFiles(
        this.credentialsRepoPath,
        `clients/${clientCode}/android/`
      );
      results.android = androidFiles.length > 0;

      if (gitExecutor.hasUncommittedChanges(this.credentialsRepoPath)) {
        const status = this.execGit('git status --porcelain', { silent: true });
        results.uncommittedFiles = status.split('\n').filter(Boolean);
      }

      this.logVerificationResults(results);

      return results;
    } catch (error) {
      console.error(chalk.red('    Verification failed:'), error.message);
      return results;
    }
  }

  logVerificationResults(results) {
    if (results.android) {
      console.log(chalk.green('    Android keystores are committed'));
    } else {
      console.log(chalk.yellow('    Android keystores not committed'));
    }

    if (results.uncommittedFiles.length > 0) {
      console.log(
        chalk.yellow(
          `\n    ${results.uncommittedFiles.length} uncommitted files in loyalty-credentials`
        )
      );
    } else {
      console.log(chalk.green('    All files committed'));
    }
  }

  async createInitialCommit() {
    console.log(chalk.blue('\n Creating initial commit in loyalty-credentials...'));

    try {
      this.ensureGitInitialized();

      if (gitExecutor.hasAnyCommits(this.credentialsRepoPath)) {
        console.log(chalk.yellow('    Repository already has commits, skipping initial commit'));
        return true;
      }

      this.createFolderStructure();
      this.execGit('git add .');

      const message = commitMessages.initialCommitMessage();
      this.execGit(`git commit -m "${commitMessages.escapeCommitMessage(message)}"`);
      console.log(chalk.green('    Initial commit created'));

      return true;
    } catch (error) {
      console.error(chalk.red('    Failed to create initial commit:'), error.message);
      return false;
    }
  }

  createFolderStructure() {
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

      const gitkeepPath = path.join(folderPath, '.gitkeep');
      if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, '');
      }
    });
  }
}

module.exports = GitCredentialsManager;
