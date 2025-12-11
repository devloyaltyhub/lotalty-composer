const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// loyalty-compose root and loyalty-app root (sibling directories)
const composeRoot = path.resolve(__dirname, '..');
const loyaltyAppRoot = path.resolve(composeRoot, '../loyalty-app');

// Resolve credential paths (expand $HOME and resolve relative paths)
const automationRoot = composeRoot;

function resolveCredentialPath(envVar) {
  let value = process.env[envVar];
  if (!value) {return;}

  // Expand environment variables like $HOME, $USER, etc.
  value = value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    return process.env[varName] || match;
  });

  // Resolve relative paths
  if (!path.isAbsolute(value)) {
    value = path.resolve(automationRoot, value);
  }

  process.env[envVar] = value;
}

// Resolve all credential-related environment variables
resolveCredentialPath('GOOGLE_PLAY_JSON_KEY');
resolveCredentialPath('APP_STORE_CONNECT_API_KEY');
resolveCredentialPath('MASTER_FIREBASE_SERVICE_ACCOUNT');
resolveCredentialPath('GOOGLE_APPLICATION_CREDENTIALS');

const logger = require('../shared/utils/logger');
const telegram = require('../shared/utils/telegram');
const GitBranchManager = require('../01-client-setup/steps/create-git-branch');

// Constants
const JSON_INDENT_SPACES = 2;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const CLI_ARGS_SKIP_COUNT = 2; // Skip node and script name in process.argv

class ClientBuilder {
  constructor(repoPath) {
    // Default to loyalty-app root (not current working directory)
    this.repoPath = repoPath || loyaltyAppRoot;
    this.gitManager = new GitBranchManager(this.repoPath);
    this.startTime = null;
  }

  exec(command, options = {}) {
    try {
      // Ensure Ruby/CocoaPods paths are in PATH for iOS builds
      const rubyPaths = '/usr/local/bin:/usr/local/opt/ruby/bin:/usr/local/lib/ruby/gems/3.4.0/bin';
      const currentPath = process.env.PATH || '/usr/bin:/bin';
      const fullPath = `${rubyPaths}:${currentPath}`;

      const result = execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: options.cwd || this.repoPath,
        env: {
          ...process.env,
          // Required for CocoaPods to work correctly
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8',
          // Ensure Ruby/CocoaPods are found
          PATH: fullPath,
          GEM_HOME: '/usr/local/lib/ruby/gems/3.4.0',
          GEM_PATH: '/usr/local/lib/ruby/gems/3.4.0',
        },
        ...options,
      });
      // When stdio is 'inherit', execSync returns null
      return result ? result.trim() : '';
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  loadClientConfig() {
    // During deploy, config.json is already in white_label_app/ (copied by white-label setup)
    const configPath = path.join(this.repoPath, 'white_label_app', 'config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error(`Client config not found: ${configPath}. Run white-label setup first.`);
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  saveClientConfig(config) {
    // Save to white_label_app/config.json (the source of truth during deploy)
    const configPath = path.join(this.repoPath, 'white_label_app', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, JSON_INDENT_SPACES), 'utf8');
  }

  async checkoutBranch(branchName) {
    logger.startSpinner(`Checking out branch: ${branchName}...`);
    try {
      await this.gitManager.git.checkout(branchName);
      await this.gitManager.git.pull('origin', branchName);
      logger.succeedSpinner(`Branch checked out: ${branchName}`);
      return true;
    } catch (error) {
      logger.failSpinner('Failed to checkout branch');
      throw error;
    }
  }

  async checkUncommittedChanges() {
    const status = await this.gitManager.git.status();
    const hasChanges =
      status.modified.length > 0 ||
      status.not_added.length > 0 ||
      status.staged.length > 0 ||
      status.created.length > 0 ||
      status.deleted.length > 0;

    if (hasChanges) {
      const changedFiles = [
        ...status.modified,
        ...status.not_added,
        ...status.staged,
        ...status.created,
        ...status.deleted,
      ];

      logger.error('');
      logger.error('═'.repeat(70));
      logger.error('ERRO: Existem alterações não commitadas no repositório!');
      logger.error('═'.repeat(70));
      logger.error('');
      logger.error('Arquivos modificados:');
      changedFiles.slice(0, 10).forEach((file) => {
        logger.error(`  - ${file}`);
      });
      if (changedFiles.length > 10) {
        logger.error(`  ... e mais ${changedFiles.length - 10} arquivo(s)`);
      }
      logger.error('');
      logger.error('Por favor, commite ou descarte as alterações antes de fazer deploy.');
      logger.error('');
      logger.error('Opções:');
      logger.error('  git stash        # Para guardar temporariamente');
      logger.error('  git commit -am "mensagem"  # Para commitar');
      logger.error('  git checkout .   # Para descartar (CUIDADO!)');
      logger.error('');
      throw new Error('Deploy cancelado: existem alterações não commitadas');
    }

    return false;
  }

  async stashChangesIfNeeded() {
    // DEPRECATED: This method is no longer used.
    // We now require clean working directory before deploy.
    // Keeping for backwards compatibility but it now just checks and errors.
    await this.checkUncommittedChanges();
    return false;
  }

  async checkoutExistingBranch(branchName) {
    // Stash any local changes first
    await this.stashChangesIfNeeded();

    // Check if branch exists locally
    const branches = await this.gitManager.git.branchLocal();
    const existsLocally = branches.all.includes(branchName);

    if (existsLocally) {
      // Branch exists locally, just checkout
      await this.gitManager.git.checkout(branchName);
    } else {
      // Branch only exists remotely, create local tracking branch
      await this.gitManager.git.checkout(['-b', branchName, `origin/${branchName}`]);
    }

    try {
      await this.gitManager.git.pull('origin', branchName);
    } catch {
      // Pull might fail if branch doesn't exist on remote yet - that's OK
      logger.info('Branch not on remote yet, skipping pull');
    }
    logger.success(`Checked out existing branch: ${branchName}`);
  }

  async createNewDeployBranch(branchName) {
    // Stash any local changes first
    await this.stashChangesIfNeeded();

    await this.gitManager.git.checkout('main');
    await this.gitManager.git.pull('origin', 'main');
    try {
      await this.gitManager.git.checkoutLocalBranch(branchName);
    } catch {
      // Branch might already exist locally, just checkout
      await this.gitManager.git.checkout(branchName);
    }
    logger.success(`Created new branch: ${branchName}`);
  }

  async returnToMainBranch(clientCode) {
    const deployBranch = `deploy/${clientCode}`;
    logger.section('Returning to main branch');
    logger.info(`Leaving deploy branch: ${deployBranch}`);

    try {
      await this.gitManager.git.checkout('main');
      logger.success('Switched back to main branch');
      logger.warn('You are now on main branch - deploy branch changes are preserved');
    } catch (error) {
      logger.error(`Failed to return to main: ${error.message}`);
      logger.warn(`You may still be on branch: ${deployBranch}`);
      // Don't throw - this is a cleanup step, not critical
    }
  }

  async createDeployBranch(clientCode) {
    const branchName = `deploy/${clientCode}`;
    logger.section(`Setting up deploy branch: ${branchName}`);

    // Check for uncommitted changes FIRST - fail fast
    await this.checkUncommittedChanges();

    try {
      const exists = await this.gitManager.branchExists(branchName);
      if (exists) {
        logger.info('Deploy branch already exists, checking out...');
        await this.checkoutExistingBranch(branchName);
      } else {
        logger.info('Creating new deploy branch from main...');
        await this.createNewDeployBranch(branchName);
      }
      return branchName;
    } catch (error) {
      logger.error(`Failed to setup deploy branch: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run white-label setup for a client
   * @param {string} clientName - The client code
   * @param {boolean} deployMode - If true, only validates existing setup (skips redundant operations)
   */
  runWhiteLabelSetup(clientName, deployMode = false) {
    const modeLabel = deployMode ? 'validation' : 'setup';
    logger.startSpinner(`Running white-label ${modeLabel}...`);
    try {
      const modeFlag = deployMode ? ' --deploy-mode' : '';
      this.exec(`npm run start -- ${clientName}${modeFlag}`, { silent: false });
      logger.succeedSpinner(`White-label ${modeLabel} completed`);
      return true;
    } catch (error) {
      logger.failSpinner(`White-label ${modeLabel} failed`);
      throw error;
    }
  }

  // NOTE: createShorebirdConfig moved to Phase 01 (Client Setup)
  // The shorebird.yaml is now created during client creation and copied during white-label setup
  // See: automation/01-client-setup/cli/create-client.js
  // See: automation/01-client-setup/steps/setup-white-label.js

  validateAssets() {
    logger.startSpinner('Validating assets...');
    try {
      this.exec('npm run validate-assets', { silent: true });
      logger.succeedSpinner('Assets validated');
      return true;
    } catch (error) {
      logger.failSpinner('Asset validation failed');
      throw error;
    }
  }

  incrementBuildNumber() {
    logger.startSpinner('Incrementing build number...');
    try {
      this.exec('npm run increment-build', { silent: true });
      logger.succeedSpinner('Build number incremented');
      return true;
    } catch (error) {
      logger.failSpinner('Failed to increment build number');
      throw error;
    }
  }

  /**
   * Set a specific version in pubspec.yaml
   * @param {string} version - Version string in format "X.Y.Z+B" (e.g., "1.2.3+45")
   */
  setVersion(version) {
    const versionRegex = /^([0-9]+)\.([0-9]+)\.([0-9]+)\+([0-9]+)$/;
    const match = version.match(versionRegex);

    if (!match) {
      throw new Error(`Formato de versao invalido: "${version}". Use o formato X.Y.Z+B (ex: 1.2.3+45)`);
    }

    logger.startSpinner(`Setting version to ${version}...`);
    try {
      const pubspecPath = path.join(this.repoPath, 'white_label_app', 'pubspec.yaml');
      let pubspec = fs.readFileSync(pubspecPath, 'utf8');

      const pubspecVersionRegex = /^version:\s*[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+/m;
      if (!pubspecVersionRegex.test(pubspec)) {
        throw new Error('Version line not found in pubspec.yaml');
      }

      pubspec = pubspec.replace(pubspecVersionRegex, `version: ${version}`);
      fs.writeFileSync(pubspecPath, pubspec, 'utf8');

      // Stage the change
      this.exec('git add white_label_app/pubspec.yaml', { silent: true });

      logger.succeedSpinner(`Version set to ${version}`);
      return true;
    } catch (error) {
      logger.failSpinner(`Failed to set version: ${error.message}`);
      throw error;
    }
  }

  buildAndroid(clientName) {
    logger.startSpinner('Building Android app...');
    try {
      this.exec(`fastlane android build client:${clientName}`, {
        cwd: path.join(__dirname, 'fastlane'),
        silent: false,
      });
      logger.succeedSpinner('Android build completed');
      return true;
    } catch (error) {
      logger.failSpinner('Android build failed');
      throw error;
    }
  }

  buildIos(clientName) {
    if (process.platform !== 'darwin') {
      logger.warn('Skipping iOS build (not on macOS)');
      return false;
    }
    logger.startSpinner('Building iOS app...');
    try {
      this.exec(`fastlane ios build client:${clientName}`, {
        cwd: path.join(__dirname, 'fastlane'),
        silent: false,
      });
      logger.succeedSpinner('iOS build completed');
      return true;
    } catch (error) {
      logger.failSpinner('iOS build failed');
      throw error;
    }
  }

  deployAndroid(clientName, track = 'internal') {
    logger.startSpinner(`Deploying Android to ${track}...`);
    try {
      this.exec(`fastlane android deploy_${track} client:${clientName}`, {
        cwd: path.join(__dirname, 'fastlane'),
        silent: false,
      });
      logger.succeedSpinner(`Android deployed to ${track}`);
      return true;
    } catch (error) {
      logger.failSpinner('Android deployment failed');
      throw error;
    }
  }

  deployIos(clientName, target = 'testflight') {
    if (process.platform !== 'darwin') {
      logger.warn('Skipping iOS deployment (not on macOS)');
      return false;
    }
    logger.startSpinner(`Deploying iOS to ${target}...`);
    try {
      this.exec(`fastlane ios deploy_${target} client:${clientName}`, {
        cwd: path.join(__dirname, 'fastlane'),
        silent: false,
      });
      logger.succeedSpinner(`iOS deployed to ${target}`);
      return true;
    } catch (error) {
      logger.failSpinner('iOS deployment failed');
      throw error;
    }
  }

  async createDeploymentTag(clientName, version, buildNumber) {
    const tagName = `${clientName}/v${version}+${buildNumber}`;
    const message = `Release v${version} build ${buildNumber} for ${clientName}`;
    await this.gitManager.createTag(tagName, message);
    await this.gitManager.pushTag(tagName);
    return tagName;
  }

  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / MS_PER_SECOND);
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const remainingSeconds = seconds % SECONDS_PER_MINUTE;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  async prepareBuildEnvironment(clientName) {
    logger.section(`Building Client: ${clientName}`);
    // Validate that white-label setup was already done for this client
    // Deploy mode only validates existing setup, skipping redundant operations
    this.runWhiteLabelSetup(clientName, true);
    // Now load config from white_label_app/ (the source of truth during deploy)
    const config = this.loadClientConfig();
    logger.info(`Client: ${config.clientName} (${config.clientCode})`);
    logger.info(`Bundle ID: ${config.bundleId}`);
    logger.blank();
    // NOTE: shorebird.yaml is now copied by white-label setup from clients/<client>/shorebird.yaml
    this.validateAssets();
    this.incrementBuildNumber();
    return config;
  }

  getVersionInfo() {
    const pubspecPath = path.join(this.repoPath, 'white_label_app', 'pubspec.yaml');
    const pubspec = fs.readFileSync(pubspecPath, 'utf8');
    const versionRegex = /^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)/m;
    const match = pubspec.match(versionRegex);

    if (!match) {
      throw new Error('Version not found in pubspec.yaml. Expected format: version: X.Y.Z+BUILD');
    }

    const version = match[1];
    const buildNumber = parseInt(match[2], 10);
    return { version, buildNumber };
  }

  async performBuilds(clientName, platforms, config) {
    const builtPlatforms = [];
    if (platforms.includes('android')) {
      this.buildAndroid(clientName);
      builtPlatforms.push('android');
    }
    if (platforms.includes('ios') && process.platform === 'darwin') {
      this.buildIos(clientName);
      builtPlatforms.push('ios');
    }
    const { version, buildNumber } = this.getVersionInfo();
    await telegram.buildCompleted(config.clientName, version, buildNumber, builtPlatforms);
    return { builtPlatforms, version, buildNumber };
  }

  async performDeployments(deployOptions) {
    const { clientName, platforms, androidTrack, iosTarget, config, builtPlatforms } =
      deployOptions;
    await telegram.deploymentStarted(config.clientName, builtPlatforms);
    if (platforms.includes('android')) {
      this.deployAndroid(clientName, androidTrack);
    }
    if (platforms.includes('ios') && process.platform === 'darwin') {
      this.deployIos(clientName, iosTarget);
    }
  }

  async finalizeBuildProcess(finalizeOptions) {
    const { clientName, config, version, buildNumber, builtPlatforms, deploy } = finalizeOptions;
    const tagName = await this.createDeploymentTag(clientName, version, buildNumber);
    const duration = this.formatDuration(Date.now() - this.startTime);
    if (deploy) {
      await telegram.deploymentCompleted(
        config.clientName,
        version,
        buildNumber,
        builtPlatforms,
        tagName,
        duration
      );
    }

    logger.blank();
    logger.summaryBox({
      Client: `${config.clientName} (${config.clientCode})`,
      Version: `${version}+${buildNumber}`,
      'Git Tag': tagName,
      Platforms: builtPlatforms,
      Deployed: deploy ? 'Yes' : 'No (build only)',
      Duration: duration,
    });
    return {
      success: true,
      clientName,
      version,
      buildNumber,
      gitTag: tagName,
      platforms: builtPlatforms,
      duration,
    };
  }

  async buildAndDeploy(options) {
    this.startTime = Date.now();
    const {
      clientName,
      platforms = ['android', 'ios'],
      deploy = true,
      androidTrack = 'internal',
      iosTarget = 'testflight',
    } = options;

    try {
      await telegram.buildStarted(clientName, platforms);
      const config = await this.prepareBuildEnvironment(clientName);
      const { builtPlatforms, version, buildNumber } = await this.performBuilds(
        clientName,
        platforms,
        config
      );

      if (deploy) {
        await this.performDeployments({
          clientName,
          platforms,
          androidTrack,
          iosTarget,
          config,
          builtPlatforms,
        });
      }

      return await this.finalizeBuildProcess({
        clientName,
        config,
        version,
        buildNumber,
        builtPlatforms,
        deploy,
      });
    } catch (error) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      logger.error(`Build failed after ${duration}`);
      logger.error(error.message);
      await telegram.error(clientName, error.message, 'Build & Deploy');

      throw error;
    }
  }
}

module.exports = ClientBuilder;

if (require.main === module) {
  (async () => {
    try {
      require('dotenv').config({ path: path.join(__dirname, '../../.env') });
      const args = process.argv.slice(CLI_ARGS_SKIP_COUNT);
      const clientName = args.find((arg) => arg.startsWith('--client='))?.split('=')[1];
      const platforms = args
        .find((arg) => arg.startsWith('--platforms='))
        ?.split('=')[1]
        ?.split(',') || ['android', 'ios'];
      const noDeploy = args.includes('--no-deploy');
      if (!clientName) {
        logger.error(
          'Usage: node build-client.js --client=<name> [--platforms=android,ios] [--no-deploy]'
        );
        process.exit(1);
      }
      const builder = new ClientBuilder();
      await builder.buildAndDeploy({ clientName, platforms, deploy: !noDeploy });
      process.exit(0);
    } catch (error) {
      logger.error(`Build failed: ${error.message}`);
      process.exit(1);
    }
  })();
}
