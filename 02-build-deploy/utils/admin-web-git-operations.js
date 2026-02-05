const fs = require('fs-extra');
const path = require('path');
const logger = require('../../shared/utils/logger');

const PRESERVE_FILES = ['.git', 'CNAME', 'CORS_FIX.md', '.nojekyll'];

class AdminWebGitOperations {
  constructor(adminRoot, webRepo, buildOutput, execFn) {
    this.adminRoot = adminRoot;
    this.webRepo = webRepo;
    this.buildOutput = buildOutput;
    this.exec = execFn;
  }

  createGitTag(versionInfo) {
    const tagName = `admin-web-v${versionInfo.full}`;
    logger.info(`Creating git tag: ${tagName}...`);

    try {
      this.exec(`git tag -a ${tagName} -m "Admin Web Deploy v${versionInfo.full}"`, {
        cwd: this.adminRoot,
      });
      this.exec(`git push origin ${tagName}`, { cwd: this.adminRoot });
      logger.success(`Git tag created and pushed: ${tagName}`);
      return tagName;
    } catch (error) {
      if (error.message.includes('already exists')) {
        logger.warn(`Tag ${tagName} already exists, skipping...`);
        return null;
      }
      throw error;
    }
  }

  commitVersionBump(versionInfo) {
    logger.info('Committing version bump...');

    const status = this.exec('git status --porcelain pubspec.yaml', {
      cwd: this.adminRoot,
      silent: true,
    });

    if (!status) {
      logger.warn('No version changes to commit');
      return false;
    }

    this.exec('git add pubspec.yaml', { cwd: this.adminRoot });
    this.exec(`git commit -m "chore: bump build number to ${versionInfo.buildNumber}"`, {
      cwd: this.adminRoot,
    });
    this.exec('git push origin HEAD', { cwd: this.adminRoot });

    logger.success('Version bump committed and pushed');
    return true;
  }

  copyBuildToRepo() {
    logger.info('Copying build to GitHub Pages repo...');

    // Safety check: remove stray .git from build output if present
    const strayGit = path.join(this.buildOutput, '.git');
    if (fs.existsSync(strayGit)) {
      logger.warn('Found .git in build output - removing to prevent corruption');
      fs.removeSync(strayGit);
    }

    const preservedFiles = {};

    for (const file of PRESERVE_FILES) {
      const filePath = path.join(this.webRepo, file);
      if (fs.existsSync(filePath)) {
        if (file === '.git') {
          preservedFiles[file] = true;
        } else {
          preservedFiles[file] = fs.readFileSync(filePath);
        }
      }
    }

    const files = fs.readdirSync(this.webRepo);
    for (const file of files) {
      if (!PRESERVE_FILES.includes(file)) {
        const filePath = path.join(this.webRepo, file);
        fs.removeSync(filePath);
      }
    }

    const buildFiles = fs.readdirSync(this.buildOutput);
    for (const file of buildFiles) {
      if (file === '.git') {
        logger.warn('Skipping .git found in build output (should not exist)');
        continue;
      }
      const src = path.join(this.buildOutput, file);
      const dest = path.join(this.webRepo, file);
      fs.copySync(src, dest);
    }

    for (const [file, content] of Object.entries(preservedFiles)) {
      if (file !== '.git' && content) {
        const filePath = path.join(this.webRepo, file);
        fs.writeFileSync(filePath, content);
      }
    }

    const nojekyllPath = path.join(this.webRepo, '.nojekyll');
    if (!fs.existsSync(nojekyllPath)) {
      fs.writeFileSync(nojekyllPath, '');
    }

    logger.success('Build copied to GitHub Pages repo');
    return true;
  }

  getGitRemote() {
    try {
      const remotes = this.exec('git remote', { cwd: this.webRepo, silent: true });
      const remoteList = remotes.split('\n').filter((r) => r.trim());
      if (remoteList.includes('origin')) return 'origin';
      if (remoteList.includes('site')) return 'site';
      return remoteList[0] || 'origin';
    } catch {
      return 'origin';
    }
  }

  commitAndPush(message, versionInfo) {
    logger.info('Committing and pushing to GitHub...');

    const date = new Date().toISOString().split('T')[0];
    const commitMessage = message || `Deploy Admin Web v${versionInfo.full} - ${date}`;

    const remote = this.getGitRemote();

    try {
      this.exec('git rebase --abort', { cwd: this.webRepo, silent: true });
    } catch {
      /* No rebase in progress */
    }
    try {
      this.exec('git merge --abort', { cwd: this.webRepo, silent: true });
    } catch {
      /* No merge in progress */
    }

    const status = this.exec('git status --porcelain', { cwd: this.webRepo, silent: true });

    if (!status) {
      logger.warn('No changes to commit');
      return false;
    }

    this.exec('git add .', { cwd: this.webRepo });
    this.exec(`git commit -m "${commitMessage}"`, { cwd: this.webRepo });

    logger.info(`Pushing to ${remote}/master...`);
    this.exec(`git push ${remote} master --force`, { cwd: this.webRepo });

    logger.success('Pushed to GitHub');
    return true;
  }

  getGitStatus() {
    try {
      const status = this.exec('git status --porcelain', { cwd: this.webRepo, silent: true });
      return status ? status.split('\n').length : 0;
    } catch {
      return 0;
    }
  }
}

module.exports = AdminWebGitOperations;
