/**
 * AdminWebBuilder - Build and deploy automation for loyalty-admin-main (Web)
 *
 * Builds Flutter Web and deploys to GitHub Pages (devloyaltyhub.github.io)
 * No Shorebird needed for web - just build and push to GitHub.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Paths
const COMPOSE_ROOT = path.resolve(__dirname, '..');
const ADMIN_ROOT = path.resolve(COMPOSE_ROOT, '../loyalty-admin-main');
const WEB_REPO = path.resolve(COMPOSE_ROOT, '../devloyaltyhub.github.io');
const BUILD_OUTPUT = path.join(ADMIN_ROOT, 'build', 'web');

const logger = require('../shared/utils/logger');
const telegram = require('../shared/utils/telegram');

// Constants
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

// Files to preserve in the web repo during deploy
const PRESERVE_FILES = ['.git', 'CNAME', 'CORS_FIX.md', '.nojekyll'];

class AdminWebBuilder {
  constructor() {
    this.adminRoot = ADMIN_ROOT;
    this.webRepo = WEB_REPO;
    this.buildOutput = BUILD_OUTPUT;
    this.startTime = null;
  }

  /**
   * Execute shell command
   */
  exec(command, options = {}) {
    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: options.cwd || this.adminRoot,
        env: {
          ...process.env,
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8',
        },
        ...options,
      });
      return result ? result.trim() : '';
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  /**
   * Check prerequisites for build/deploy
   */
  checkPrerequisites() {
    const errors = [];

    // Check Flutter
    try {
      const flutterVersion = this.exec('flutter --version', { silent: true });
      logger.info(`Flutter: ${flutterVersion.split('\n')[0]}`);
    } catch {
      errors.push('Flutter not installed or not in PATH');
    }

    // Check Git
    try {
      this.exec('git --version', { silent: true });
    } catch {
      errors.push('Git not installed or not in PATH');
    }

    // Check loyalty-admin-main exists
    if (!fs.existsSync(this.adminRoot)) {
      errors.push(`loyalty-admin-main not found at ${this.adminRoot}`);
    }

    // Check devloyaltyhub.github.io repo exists
    if (!fs.existsSync(this.webRepo)) {
      errors.push(`devloyaltyhub.github.io repo not found at ${this.webRepo}`);
    }

    // Check it's a git repo
    if (!fs.existsSync(path.join(this.webRepo, '.git'))) {
      errors.push(`${this.webRepo} is not a git repository`);
    }

    if (errors.length > 0) {
      errors.forEach(e => logger.error(e));
      throw new Error('Prerequisites check failed');
    }

    logger.success('Prerequisites validated');
    return true;
  }

  /**
   * Get version info from pubspec.yaml
   */
  getVersionInfo() {
    const pubspecPath = path.join(this.adminRoot, 'pubspec.yaml');
    const pubspec = fs.readFileSync(pubspecPath, 'utf8');
    const match = pubspec.match(/^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)/m);

    if (!match) {
      throw new Error('Version not found in pubspec.yaml');
    }

    return {
      version: match[1],
      buildNumber: match[2],
      full: `${match[1]}+${match[2]}`,
    };
  }

  /**
   * Get dart-define flags for web build
   * Reads sensitive config from .master_password file or environment variables
   */
  getDartDefines() {
    const defines = [];

    // Master Firebase password (required for web builds)
    // Priority: 1) .master_password file in admin root, 2) .env variable
    let masterPassword = null;

    // Try to read from .master_password file first (same as Flutter app does)
    const masterPasswordFile = path.join(this.adminRoot, '.master_password');
    if (fs.existsSync(masterPasswordFile)) {
      masterPassword = fs.readFileSync(masterPasswordFile, 'utf8').trim();
      if (masterPassword) {
        logger.info('MASTER_FIREBASE_PASSWORD loaded from .master_password file');
      }
    }

    // Fallback to environment variable
    if (!masterPassword && process.env.MASTER_FIREBASE_PASSWORD) {
      masterPassword = process.env.MASTER_FIREBASE_PASSWORD;
      logger.info('MASTER_FIREBASE_PASSWORD loaded from environment');
    }

    if (masterPassword) {
      defines.push(`--dart-define=MASTER_FIREBASE_PASSWORD=${masterPassword}`);
    } else {
      logger.warning('MASTER_FIREBASE_PASSWORD not set - login will fail on web');
      logger.warning('Create .master_password file in loyalty-admin-main or set MASTER_FIREBASE_PASSWORD in .env');
    }

    // Cloud Service API Key (optional)
    // Priority: 1) .cloud_service_api_key file, 2) .env variable
    let cloudServiceApiKey = null;

    const apiKeyFile = path.join(this.adminRoot, '.cloud_service_api_key');
    if (fs.existsSync(apiKeyFile)) {
      cloudServiceApiKey = fs.readFileSync(apiKeyFile, 'utf8').trim();
      if (cloudServiceApiKey) {
        logger.info('CLOUD_SERVICE_API_KEY loaded from .cloud_service_api_key file');
      }
    }

    if (!cloudServiceApiKey && process.env.CLOUD_SERVICE_API_KEY) {
      cloudServiceApiKey = process.env.CLOUD_SERVICE_API_KEY;
      logger.info('CLOUD_SERVICE_API_KEY loaded from environment');
    }

    if (cloudServiceApiKey) {
      defines.push(`--dart-define=CLOUD_SERVICE_API_KEY=${cloudServiceApiKey}`);
    }

    return defines.length > 0 ? ' ' + defines.join(' ') : '';
  }

  /**
   * Build Flutter Web
   */
  buildWeb() {
    logger.info('Building Flutter Web...');

    // Clean previous build
    logger.info('Cleaning previous build...');
    this.exec('flutter clean');

    // Get dependencies
    logger.info('Getting dependencies...');
    this.exec('flutter pub get');

    // Build web with release optimizations
    // Note: --obfuscate is NOT supported for web builds
    // Release mode automatically minifies the code
    // Note: --web-renderer was removed in Flutter 3.35+, CanvasKit is now the default
    logger.info('Building web release...');

    // Get dart-define flags for sensitive environment variables
    const dartDefines = this.getDartDefines();
    this.exec(`flutter build web --release --base-href "/" --no-source-maps --no-wasm-dry-run${dartDefines}`);

    // Verify build output exists
    if (!fs.existsSync(this.buildOutput)) {
      throw new Error(`Build output not found at ${this.buildOutput}`);
    }

    const indexPath = path.join(this.buildOutput, 'index.html');
    if (!fs.existsSync(indexPath)) {
      throw new Error('index.html not found in build output');
    }

    logger.success('Flutter Web build completed');
    return true;
  }

  /**
   * Copy build output to web repo
   */
  copyBuildToRepo() {
    logger.info('Copying build to GitHub Pages repo...');

    // Get list of files to preserve
    const preservedFiles = {};

    // Backup preserved files
    for (const file of PRESERVE_FILES) {
      const filePath = path.join(this.webRepo, file);
      if (fs.existsSync(filePath)) {
        if (file === '.git') {
          // Don't copy .git, just skip it during clean
          preservedFiles[file] = true;
        } else {
          preservedFiles[file] = fs.readFileSync(filePath);
        }
      }
    }

    // Clean web repo (except preserved files)
    const files = fs.readdirSync(this.webRepo);
    for (const file of files) {
      if (!PRESERVE_FILES.includes(file)) {
        const filePath = path.join(this.webRepo, file);
        fs.removeSync(filePath);
      }
    }

    // Copy build output
    const buildFiles = fs.readdirSync(this.buildOutput);
    for (const file of buildFiles) {
      const src = path.join(this.buildOutput, file);
      const dest = path.join(this.webRepo, file);
      fs.copySync(src, dest);
    }

    // Restore preserved files (except .git which was never removed)
    for (const [file, content] of Object.entries(preservedFiles)) {
      if (file !== '.git' && content) {
        const filePath = path.join(this.webRepo, file);
        fs.writeFileSync(filePath, content);
      }
    }

    // Ensure .nojekyll exists (prevents GitHub Pages from ignoring _ prefixed files)
    const nojekyllPath = path.join(this.webRepo, '.nojekyll');
    if (!fs.existsSync(nojekyllPath)) {
      fs.writeFileSync(nojekyllPath, '');
    }

    logger.success('Build copied to GitHub Pages repo');
    return true;
  }

  /**
   * Get the git remote name (usually 'origin' or 'site')
   */
  getGitRemote() {
    try {
      const remotes = this.exec('git remote', { cwd: this.webRepo, silent: true });
      const remoteList = remotes.split('\n').filter(r => r.trim());
      // Prefer 'origin', fallback to first available remote
      if (remoteList.includes('origin')) return 'origin';
      if (remoteList.includes('site')) return 'site';
      return remoteList[0] || 'origin';
    } catch {
      return 'origin';
    }
  }

  /**
   * Commit and push to GitHub
   */
  commitAndPush(message) {
    logger.info('Committing and pushing to GitHub...');

    const version = this.getVersionInfo();
    const date = new Date().toISOString().split('T')[0];
    const commitMessage = message || `Deploy Admin Web v${version.full} - ${date}`;

    // Check if there are changes to commit
    const status = this.exec('git status --porcelain', { cwd: this.webRepo, silent: true });

    if (!status) {
      logger.warning('No changes to commit');
      return false;
    }

    // Add all changes
    this.exec('git add .', { cwd: this.webRepo });

    // Commit
    this.exec(`git commit -m "${commitMessage}"`, { cwd: this.webRepo });

    // Get the correct remote name
    const remote = this.getGitRemote();

    // Pull before push to avoid conflicts
    logger.info(`Pulling from ${remote}/master...`);
    try {
      this.exec(`git pull ${remote} master --rebase`, { cwd: this.webRepo });
    } catch (pullError) {
      // If pull fails, it might be a new repo or no remote history - continue anyway
      logger.warning(`Pull failed (may be ok for new repo): ${pullError.message}`);
    }

    // Push
    logger.info(`Pushing to ${remote}/master...`);
    this.exec(`git push ${remote} master`, { cwd: this.webRepo });

    logger.success('Pushed to GitHub');
    return true;
  }

  /**
   * Get current git status of web repo
   */
  getGitStatus() {
    try {
      const status = this.exec('git status --porcelain', { cwd: this.webRepo, silent: true });
      return status ? status.split('\n').length : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Format duration for display
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / MS_PER_SECOND);
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const remainingSeconds = seconds % SECONDS_PER_MINUTE;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
  }

  /**
   * Full build and deploy pipeline
   */
  async buildAndDeploy(options = {}) {
    const { skipBuild = false, message = null } = options;
    this.startTime = Date.now();

    try {
      logger.section('Admin Web Deploy Pipeline');

      // Validate
      this.checkPrerequisites();

      // Version
      const versionInfo = this.getVersionInfo();
      logger.keyValue('Version', versionInfo.full);

      if (!skipBuild) {
        await telegram.buildStarted('admin-web', ['web']);
        this.buildWeb();
      } else {
        logger.info('Skipping build (using existing build)');

        // Verify build exists
        if (!fs.existsSync(this.buildOutput)) {
          throw new Error(`No existing build found at ${this.buildOutput}. Run without --skip-build first.`);
        }
      }

      // Copy to repo
      this.copyBuildToRepo();

      // Commit and push
      const pushed = this.commitAndPush(message);

      // Finalize
      const duration = this.formatDuration(Date.now() - this.startTime);

      if (pushed) {
        await telegram.deploymentCompleted(
          'Loyalty Hub Admin Web',
          versionInfo.version,
          versionInfo.buildNumber,
          ['web'],
          'https://devloyaltyhub.github.io',
          duration
        );
      }

      logger.blank();
      logger.summaryBox({
        App: 'Loyalty Hub Admin Web',
        Version: versionInfo.full,
        URL: 'https://devloyaltyhub.github.io',
        Duration: duration,
        Status: pushed ? 'Deployed' : 'No changes',
      });

      return { success: true, version: versionInfo.full, duration, pushed };

    } catch (error) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      logger.error(`Deploy failed after ${duration}: ${error.message}`);
      await telegram.error('admin-web', error.message, 'Admin Web Deploy');
      throw error;
    }
  }

  /**
   * Build only (no deploy)
   */
  async buildOnly() {
    this.startTime = Date.now();

    try {
      logger.section('Admin Web Build');

      // Validate
      this.checkPrerequisites();

      // Version
      const versionInfo = this.getVersionInfo();
      logger.keyValue('Version', versionInfo.full);

      // Build
      this.buildWeb();

      // Finalize
      const duration = this.formatDuration(Date.now() - this.startTime);

      logger.blank();
      logger.summaryBox({
        App: 'Loyalty Hub Admin Web',
        Version: versionInfo.full,
        'Build Path': this.buildOutput,
        Duration: duration,
      });

      return { success: true, version: versionInfo.full, duration, buildPath: this.buildOutput };

    } catch (error) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      logger.error(`Build failed after ${duration}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AdminWebBuilder;
