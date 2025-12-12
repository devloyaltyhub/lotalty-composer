/**
 * AdminBuilder - Build and deploy automation for loyalty-admin-main
 *
 * Reutiliza utilitários existentes (logger, telegram) mas com lógica específica
 * para o projeto admin, que não é um cliente white-label.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Paths
const COMPOSE_ROOT = path.resolve(__dirname, '..');
const ADMIN_ROOT = path.resolve(COMPOSE_ROOT, '../loyalty-admin-main');
const FASTLANE_PATH = path.join(__dirname, 'fastlane');

// Resolve credential paths
function resolveCredentialPath(envVar) {
  let value = process.env[envVar];
  if (!value) return;

  value = value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    return process.env[varName] || match;
  });

  if (!path.isAbsolute(value)) {
    value = path.resolve(COMPOSE_ROOT, value);
  }

  process.env[envVar] = value;
}

resolveCredentialPath('GOOGLE_PLAY_JSON_KEY');

const logger = require('../shared/utils/logger');
const telegram = require('../shared/utils/telegram');

// Constants
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const ADMIN_CONFIG = {
  appName: 'Loyalty Hub Admin',
  packageName: 'club.loyaltyhub.admin',
};

class AdminBuilder {
  constructor() {
    this.adminRoot = ADMIN_ROOT;
    this.startTime = null;
  }

  /**
   * Execute shell command
   */
  exec(command, options = {}) {
    const rubyPaths = '/usr/local/bin:/usr/local/opt/ruby/bin:/usr/local/lib/ruby/gems/3.4.0/bin';
    const currentPath = process.env.PATH || '/usr/bin:/bin';

    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: options.cwd || this.adminRoot,
        env: {
          ...process.env,
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8',
          PATH: `${rubyPaths}:${currentPath}`,
          GEM_HOME: '/usr/local/lib/ruby/gems/3.4.0',
          GEM_PATH: '/usr/local/lib/ruby/gems/3.4.0',
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

    // Check Shorebird
    try {
      this.exec('which shorebird', { silent: true });
    } catch {
      errors.push('Shorebird CLI not installed. Install: curl --proto "=https" --tlsv1.2 https://raw.githubusercontent.com/shorebirdtech/install/main/install.sh -sSf | bash');
    }

    // Check shorebird.yaml
    const shorebirdYaml = path.join(this.adminRoot, 'shorebird.yaml');
    if (!fs.existsSync(shorebirdYaml)) {
      errors.push(`shorebird.yaml not found at ${shorebirdYaml}`);
    }

    // Check Google Play credentials
    const googlePlayKey = process.env.GOOGLE_PLAY_JSON_KEY;
    if (!googlePlayKey) {
      errors.push('GOOGLE_PLAY_JSON_KEY not configured in .env');
    } else if (!fs.existsSync(googlePlayKey)) {
      errors.push(`Google Play key not found: ${googlePlayKey}`);
    }

    // Check keystore
    const keystoreProps = path.resolve(COMPOSE_ROOT, '../loyalty-credentials/admin/android/keystore.properties');
    if (!fs.existsSync(keystoreProps)) {
      errors.push(`Keystore properties not found: ${keystoreProps}`);
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
   * Set version in pubspec.yaml
   */
  setVersion(versionString) {
    const match = versionString.match(/^([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)$/);
    if (!match) {
      throw new Error(`Invalid version format: ${versionString}. Use X.Y.Z+B`);
    }

    const pubspecPath = path.join(this.adminRoot, 'pubspec.yaml');
    let pubspec = fs.readFileSync(pubspecPath, 'utf8');
    pubspec = pubspec.replace(/^version:\s*[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+/m, `version: ${versionString}`);
    fs.writeFileSync(pubspecPath, pubspec, 'utf8');

    logger.success(`Version set to ${versionString}`);
    return true;
  }

  /**
   * Increment build number
   */
  incrementBuildNumber() {
    const { version, buildNumber } = this.getVersionInfo();
    const newBuildNumber = parseInt(buildNumber, 10) + 1;
    const newVersion = `${version}+${newBuildNumber}`;
    this.setVersion(newVersion);
    return { oldVersion: `${version}+${buildNumber}`, newVersion };
  }

  /**
   * Build Android with Shorebird
   */
  buildAndroid() {
    logger.info('Building Android with Shorebird...');

    // Create debug symbols directory
    const { full: version } = this.getVersionInfo();
    const symbolsPath = path.join(this.adminRoot, 'build', 'debug-symbols', version.replace('+', '_'), 'android');
    fs.mkdirSync(symbolsPath, { recursive: true });

    // Step 1: Generate debug symbols
    logger.info('Generating debug symbols...');
    this.exec(`flutter build appbundle --release --obfuscate --split-debug-info=${symbolsPath}`);

    // Step 2: Shorebird release
    logger.info('Creating Shorebird release...');
    this.exec('shorebird release android --flutter-version=3.35.5 --no-confirm');

    logger.success('Android build completed');
    return { symbolsPath };
  }

  /**
   * Deploy Android to Play Store
   */
  deployAndroid(track = 'internal') {
    logger.info(`Deploying Android to ${track}...`);

    const lane = track === 'production' ? 'admin:deploy_production' : 'admin:deploy_internal';
    this.exec(`bundle exec fastlane ${lane}`, { cwd: FASTLANE_PATH });

    logger.success(`Android deployed to ${track}`);
    return true;
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
    const { track = 'internal', skipBuild = false } = options;
    this.startTime = Date.now();

    try {
      logger.section('Admin Deploy Pipeline');

      // Validate
      this.checkPrerequisites();

      // Version
      const versionInfo = this.getVersionInfo();
      logger.keyValue('Current version', versionInfo.full);

      if (!skipBuild) {
        // Increment and build
        const { newVersion } = this.incrementBuildNumber();
        logger.keyValue('New version', newVersion);

        await telegram.buildStarted('admin', ['android']);
        this.buildAndroid();
      }

      // Deploy
      this.deployAndroid(track);

      // Finalize
      const finalVersion = this.getVersionInfo();
      const duration = this.formatDuration(Date.now() - this.startTime);

      await telegram.deploymentCompleted(
        ADMIN_CONFIG.appName,
        finalVersion.version,
        finalVersion.buildNumber,
        ['android'],
        `admin/v${finalVersion.full}`,
        duration
      );

      logger.blank();
      logger.summaryBox({
        App: ADMIN_CONFIG.appName,
        Version: finalVersion.full,
        Track: track,
        Duration: duration,
      });

      return { success: true, version: finalVersion.full, track, duration };

    } catch (error) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      logger.error(`Deploy failed after ${duration}: ${error.message}`);
      await telegram.error('admin', error.message, 'Admin Deploy');
      throw error;
    }
  }
}

module.exports = AdminBuilder;
