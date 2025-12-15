const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { COMPOSE_ROOT, LOYALTY_APP_ROOT, WHITE_LABEL_APP_ROOT } = require('./paths');

// Load environment variables
require('dotenv').config({ path: path.join(COMPOSE_ROOT, '.env') });

// Resolve credential paths to absolute paths (relative to automation root)
const automationRoot = COMPOSE_ROOT;

// Helper function to resolve credential paths
function resolveCredentialPath(envVar) {
  let value = process.env[envVar];
  if (!value) return;

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
resolveCredentialPath('MASTER_FIREBASE_SERVICE_ACCOUNT');
resolveCredentialPath('GOOGLE_APPLICATION_CREDENTIALS');
resolveCredentialPath('GOOGLE_PLAY_JSON_KEY');
resolveCredentialPath('APP_STORE_CONNECT_API_KEY');

class PreflightCheck {
  constructor() {
    this.checks = [];
    this.failed = false;
  }

  // Execute a command and return output
  execCommand(command) {
    try {
      return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
    } catch (error) {
      return null;
    }
  }

  // Check if command exists
  commandExists(command) {
    return this.execCommand(`which ${command}`) !== null;
  }

  // Check Flutter installation
  checkFlutter() {
    logger.startSpinner('Checking Flutter installation...');

    if (!this.commandExists('flutter')) {
      logger.failSpinner('Flutter not found');
      logger.error('Flutter is not installed or not in PATH');
      logger.info('Install: https://docs.flutter.dev/get-started/install');
      this.failed = true;
      return false;
    }

    const version = this.execCommand('flutter --version | head -n 1');
    logger.succeedSpinner(`Flutter found: ${version}`);
    return true;
  }

  // Check Firebase CLI
  checkFirebaseCLI() {
    logger.startSpinner('Checking Firebase CLI...');

    if (!this.commandExists('firebase')) {
      logger.failSpinner('Firebase CLI not found');
      logger.error('Firebase CLI is not installed');
      logger.info('Install: npm install -g firebase-tools');
      this.failed = true;
      return false;
    }

    const version = this.execCommand('firebase --version');
    logger.succeedSpinner(`Firebase CLI found: v${version}`);
    return true;
  }

  // Check Google Cloud SDK (gcloud CLI)
  checkGcloudCLI() {
    logger.startSpinner('Checking Google Cloud SDK...');

    if (!this.commandExists('gcloud')) {
      logger.failSpinner('Google Cloud SDK not found');
      logger.error('Google Cloud SDK is not installed');
      logger.info('Install: brew install google-cloud-sdk');
      logger.info('Or visit: https://cloud.google.com/sdk/docs/install');
      this.failed = true;
      return false;
    }

    const version = this.execCommand('gcloud --version | head -n 1');
    logger.succeedSpinner(`${version}`);
    return true;
  }

  // Check Git
  checkGit() {
    logger.startSpinner('Checking Git...');

    if (!this.commandExists('git')) {
      logger.failSpinner('Git not found');
      logger.error('Git is not installed');
      logger.info('Install: https://git-scm.com/downloads');
      this.failed = true;
      return false;
    }

    const version = this.execCommand('git --version');
    logger.succeedSpinner(`${version}`);
    return true;
  }

  // Check Node.js version
  checkNode() {
    logger.startSpinner('Checking Node.js...');

    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);

    if (major < 16) {
      logger.failSpinner(`Node.js ${version} is too old`);
      logger.error('Node.js 16 or higher is required');
      logger.info('Install: https://nodejs.org/');
      this.failed = true;
      return false;
    }

    logger.succeedSpinner(`Node.js ${version}`);
    return true;
  }

  // Check if on macOS (required for iOS builds)
  checkMacOS() {
    logger.startSpinner('Checking operating system...');

    if (process.platform !== 'darwin') {
      logger.failSpinner('Not running on macOS');
      logger.warn('macOS is required for iOS builds');
      logger.info('Android builds will work, but iOS builds will fail');
      // Don't fail entirely, just warn
      return false;
    }

    logger.succeedSpinner('Running on macOS');
    return true;
  }

  // Check Xcode (macOS only)
  checkXcode() {
    if (process.platform !== 'darwin') {
      return true; // Skip on non-macOS
    }

    logger.startSpinner('Checking Xcode...');

    if (!this.commandExists('xcodebuild')) {
      logger.failSpinner('Xcode not found');
      logger.warn('Xcode is required for iOS builds');
      logger.info('Install from App Store');
      return false;
    }

    const version = this.execCommand('xcodebuild -version | head -n 1');
    logger.succeedSpinner(`${version}`);
    return true;
  }

  // Check Android SDK
  checkAndroidSDK() {
    logger.startSpinner('Checking Android SDK...');

    const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

    if (!androidHome || !fs.existsSync(androidHome)) {
      logger.failSpinner('Android SDK not found');
      logger.warn('ANDROID_HOME environment variable not set or path does not exist');
      logger.info('Set ANDROID_HOME to your Android SDK path');
      return false;
    }

    logger.succeedSpinner(`Android SDK found: ${androidHome}`);
    return true;
  }

  // Check Fastlane
  checkFastlane() {
    logger.startSpinner('Checking Fastlane...');

    if (!this.commandExists('fastlane')) {
      logger.failSpinner('Fastlane not found');
      logger.error('Fastlane is required for app store deployment');
      logger.info('Install: gem install fastlane');
      this.failed = true;
      return false;
    }

    const version = this.execCommand('fastlane --version | grep "fastlane [0-9]"');
    logger.succeedSpinner(`Fastlane found: ${version}`);
    return true;
  }

  // Check environment variables
  checkEnvVariables() {
    logger.startSpinner('Checking environment variables...');

    const required = ['MASTER_FIREBASE_PROJECT_ID', 'GOOGLE_APPLICATION_CREDENTIALS'];

    const missing = [];

    required.forEach((varName) => {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    });

    if (missing.length > 0) {
      logger.failSpinner('Missing environment variables');
      missing.forEach((varName) => {
        logger.error(`${varName} is not set`);
      });
      logger.info('Create a .env file with required variables');
      this.failed = true;
      return false;
    }

    logger.succeedSpinner('All required environment variables are set');
    return true;
  }

  // Check loyalty-credentials repository structure
  checkLoyaltyCredentialsRepo() {
    logger.startSpinner('Checking loyalty-credentials repository...');

    // Get path to loyalty-credentials (sibling to loyalty-compose)
    const loyaltyHubRoot = path.resolve(automationRoot, '..');
    const credentialsRepoPath = path.join(loyaltyHubRoot, 'loyalty-credentials');

    // Check if loyalty-credentials directory exists
    if (!fs.existsSync(credentialsRepoPath)) {
      logger.stopSpinner();
      logger.warn('loyalty-credentials repository not found');
      logger.info(`Expected path: ${credentialsRepoPath}`);
      logger.blank();
      logger.info('Attempting to clone loyalty-credentials repository...');

      // Get the Git URL from environment variable, or use default
      const gitUrl =
        process.env.MATCH_GIT_URL || 'git@github.com:devloyaltyhub/loyalty-credentials.git';
      const parentDir = loyaltyHubRoot;

      try {
        // Clone the repository
        const cloneCommand = `cd "${parentDir}" && git clone ${gitUrl}`;
        this.execCommand(cloneCommand);

        // Verify it was cloned successfully
        if (fs.existsSync(credentialsRepoPath)) {
          logger.success('✓ loyalty-credentials repository cloned successfully');
          logger.startSpinner('Verifying repository structure...');
        } else {
          logger.error('Failed to clone loyalty-credentials repository');
          logger.info('Structure should be:');
          logger.info('  loyaltyhub/');
          logger.info('    ├── loyalty-credentials/  ← Must exist here');
          logger.info('    └── loyalty-compose/');
          logger.blank();
          logger.info('To clone manually, run:');
          logger.info(`  cd ${parentDir}`);
          logger.info(`  git clone ${gitUrl}`);
          this.failed = true;
          return false;
        }
      } catch (error) {
        logger.error('Failed to clone loyalty-credentials repository');
        logger.error(`Error: ${error.message}`);
        logger.blank();
        logger.info('Please verify:');
        logger.info('  1. You have SSH access to the repository');
        logger.info('  2. Your SSH key is added to GitHub');
        logger.info('  3. The repository URL is correct in .env (MATCH_GIT_URL)');
        logger.blank();
        logger.info('To clone manually, run:');
        logger.info(`  cd ${parentDir}`);
        logger.info(`  git clone ${gitUrl}`);
        this.failed = true;
        return false;
      }
    }

    // Check required folders
    const requiredFolders = [
      path.join(credentialsRepoPath, 'shared'),
      path.join(credentialsRepoPath, 'shared', 'ios'),
      path.join(credentialsRepoPath, 'shared', 'ios', 'certs'),
      path.join(credentialsRepoPath, 'profiles'),
      path.join(credentialsRepoPath, 'profiles', 'development'),
      path.join(credentialsRepoPath, 'profiles', 'appstore'),
      path.join(credentialsRepoPath, 'clients'),
    ];

    const missingFolders = requiredFolders.filter((folder) => !fs.existsSync(folder));

    if (missingFolders.length > 0) {
      logger.stopSpinner();
      logger.warn('loyalty-credentials structure incomplete, creating folders...');

      // Create missing folders
      missingFolders.forEach((folder) => {
        fs.mkdirSync(folder, { recursive: true });

        // Create .gitkeep to track empty folders
        const gitkeepPath = path.join(folder, '.gitkeep');
        if (!fs.existsSync(gitkeepPath)) {
          fs.writeFileSync(gitkeepPath, '');
        }
      });

      logger.info('Created missing folders');
    }

    // Check if git is initialized
    const isGitInitialized = this.execCommand(
      `cd ${credentialsRepoPath} && git rev-parse --git-dir 2>/dev/null`
    );

    if (!isGitInitialized) {
      logger.info('Initializing git repository...');
      this.execCommand(`cd ${credentialsRepoPath} && git init && git branch -M main`);
    }

    // Check if repository has any commits
    const hasCommits = this.execCommand(`cd ${credentialsRepoPath} && git log -1 2>/dev/null`);

    if (!hasCommits) {
      logger.info('Creating initial commit...');

      // Create README.md
      const readmePath = path.join(credentialsRepoPath, 'README.md');
      const readmeContent = `# LoyaltyHub Credentials Repository

This repository stores all credentials for the LoyaltyHub white-label system.

## Structure

\`\`\`
loyalty-credentials/
├── shared/                   # Shared credentials (all clients)
│   ├── master-firebase-service-account.json
│   ├── master-gcloud-service-account.json
│   ├── google-play-service-account.json (optional)
│   ├── AuthKey_*.p8 (App Store Connect API)
│   └── ios/                  # Shared iOS certificates (via Match)
│       └── certs/
│           ├── development/
│           └── distribution/
├── profiles/                 # Match profiles (auto-organized by script)
│   ├── development/
│   └── appstore/
└── clients/                  # Per-client credentials
    └── {client-code}/
        ├── android/
        │   ├── keystore-debug.jks
        │   ├── keystore-release.jks
        │   └── keystore.properties
        └── ios/              # Client-specific iOS profiles (copied by script)
            ├── AppStore_*.mobileprovision
            └── Development_*.mobileprovision
\`\`\`

## Security

- ⚠️ **NEVER** commit this repository to a public repository
- ✅ Ensure repository is **PRIVATE**
- ✅ Limit access to trusted team members only
- ✅ Keep backups in secure locations

## Usage

Credentials are automatically managed by the LoyaltyHub automation system.

- Android keystores: Generated during client creation
- iOS certificates: Generated via Fastlane Match
- All credentials are automatically committed and pushed

See \`loyalty-compose/docs/credentials-and-signing.md\` for full documentation.
`;
      fs.writeFileSync(readmePath, readmeContent, 'utf8');

      // Stage all files
      this.execCommand(`cd ${credentialsRepoPath} && git add .`);

      // Create commit
      const commitMessage = `Initial commit: loyalty-credentials repository structure

Created folder structure:
- shared/ - Shared credentials (Firebase, App Store API, iOS certs)
- profiles/ - iOS provisioning profiles (via Match)
- clients/ - Client-specific credentials

Generated: ${new Date().toISOString()}`;

      this.execCommand(
        `cd ${credentialsRepoPath} && git commit -m "${commitMessage.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
      );

      logger.info('✓ Initial commit created');

      // Check if remote is configured
      const hasRemote = this.execCommand(`cd ${credentialsRepoPath} && git remote 2>/dev/null`);
      if (!hasRemote) {
        logger.warn('No git remote configured for loyalty-credentials');
        logger.info('Add remote: cd loyalty-credentials && git remote add origin <url>');
      } else {
        logger.info('Push commits: cd loyalty-credentials && git push -u origin main');
      }
    }

    logger.succeedSpinner('loyalty-credentials repository ready');
    return true;
  }

  // Check if credential files exist
  checkCredentialFiles() {
    logger.startSpinner('Checking credential files...');

    const files = [
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      process.env.MASTER_FIREBASE_SERVICE_ACCOUNT,
    ].filter(Boolean);

    const missing = [];

    files.forEach((file) => {
      // Resolve relative paths from automation directory
      const resolvedPath = path.isAbsolute(file) ? file : path.join(__dirname, '../../', file);

      if (!fs.existsSync(resolvedPath)) {
        missing.push(resolvedPath);
      }
    });

    if (missing.length > 0) {
      logger.failSpinner('Missing credential files');
      missing.forEach((file) => {
        logger.error(`File not found: ${file}`);
      });
      this.failed = true;
      return false;
    }

    logger.succeedSpinner('All credential files found');
    return true;
  }

  // Check Firebase authentication
  async checkFirebaseAuth() {
    logger.startSpinner('Checking Firebase authentication...');

    const currentProject = this.execCommand('firebase projects:list --json 2>/dev/null');

    if (!currentProject || currentProject.includes('error')) {
      logger.failSpinner('Firebase not authenticated');
      logger.error('Firebase CLI is not authenticated');
      logger.info('Run: firebase login');
      this.failed = true;
      return false;
    }

    logger.succeedSpinner('Firebase authenticated');
    return true;
  }

  // Check Firebase account email
  checkFirebaseAccount() {
    const expectedEmail = process.env.EXPECTED_GOOGLE_ACCOUNT;

    // Skip if no expected email is configured
    if (!expectedEmail) {
      return true;
    }

    logger.startSpinner('Checking Firebase account...');

    const output = this.execCommand('firebase login:list 2>/dev/null');

    if (!output) {
      logger.failSpinner('Could not get Firebase account info');
      logger.error('Unable to retrieve Firebase login information');
      this.failed = true;
      return false;
    }

    // Parse output - format is typically "Logged in as EMAIL"
    let activeAccount = null;

    // Try to extract email from "Logged in as EMAIL" format
    const loggedInMatch = output.match(
      /Logged in as\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/
    );
    if (loggedInMatch) {
      activeAccount = loggedInMatch[1];
    } else {
      // Fallback: try to find any email in the output
      const emailMatch = output.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) {
        activeAccount = emailMatch[1];
      }
    }

    if (!activeAccount) {
      logger.failSpinner('Could not detect active Firebase account');
      logger.error('Unable to determine which Firebase account is active');
      this.failed = true;
      return false;
    }

    if (activeAccount !== expectedEmail) {
      logger.failSpinner(`Wrong Firebase account: ${activeAccount}`);
      logger.error(`❌ Firebase CLI is logged in with: ${activeAccount}`);
      logger.error(`✓  Expected business account: ${expectedEmail}`);
      logger.blank();
      logger.info('To switch accounts, run:');
      logger.info('  firebase login --reauth');
      logger.blank();
      this.failed = true;
      return false;
    }

    logger.succeedSpinner(`Firebase account: ${activeAccount} ✓`);
    return true;
  }

  // Check gcloud account email
  checkGcloudAccount() {
    const expectedEmail = process.env.EXPECTED_GOOGLE_ACCOUNT;

    // Skip if no expected email is configured
    if (!expectedEmail) {
      return true;
    }

    logger.startSpinner('Checking gcloud account...');

    const output = this.execCommand(
      'gcloud auth list --format="value(account)" --filter="status:ACTIVE" 2>/dev/null'
    );

    if (!output) {
      logger.failSpinner('Could not get gcloud account info');
      logger.error('Unable to retrieve gcloud authentication information');
      this.failed = true;
      return false;
    }

    const activeAccount = output.trim();

    if (!activeAccount) {
      logger.failSpinner('No active gcloud account found');
      logger.error('gcloud CLI does not have an active account');
      logger.info('Run: gcloud auth login');
      this.failed = true;
      return false;
    }

    if (activeAccount !== expectedEmail) {
      logger.failSpinner(`Wrong gcloud account: ${activeAccount}`);
      logger.error(`❌ gcloud CLI is logged in with: ${activeAccount}`);
      logger.error(`✓  Expected business account: ${expectedEmail}`);
      logger.blank();
      logger.info('To switch accounts, run one of:');
      logger.info(`  gcloud config set account ${expectedEmail}`);
      logger.info('  gcloud auth login');
      logger.blank();
      this.failed = true;
      return false;
    }

    logger.succeedSpinner(`gcloud account: ${activeAccount} ✓`);
    return true;
  }

  // Check Android keystore setup
  checkAndroidKeystoreSetup(clientCode = null) {
    logger.startSpinner('Checking Android keystore setup...');

    // Check if keytool is available (required for keystore generation)
    if (!this.commandExists('keytool')) {
      logger.failSpinner('keytool not found');
      logger.warn('Java keytool is required for Android keystore generation');
      logger.info('Install: brew install openjdk');
      logger.info('Or visit: https://adoptium.net/');
      return false;
    }

    // If no specific client, just check keytool is available
    if (!clientCode) {
      logger.succeedSpinner('keytool available (Java installed)');
      return true;
    }

    // Check specific client keystores
    const { LOYALTY_CREDENTIALS_ROOT: credentialsRepoPath } = require('./paths');
    const androidDir = path.join(credentialsRepoPath, 'clients', clientCode, 'android');

    if (!fs.existsSync(androidDir)) {
      logger.failSpinner(`Android keystores not found for client: ${clientCode}`);
      logger.error('Client does not have Android keystores');
      logger.info('Generate keystores: npm run setup:keystore');
      this.failed = true;
      return false;
    }

    // Check for required files
    const keystoreDebug = path.join(androidDir, 'keystore-debug.jks');
    const keystoreRelease = path.join(androidDir, 'keystore-release.jks');
    const keystoreProps = path.join(androidDir, 'keystore.properties');

    const missingFiles = [];
    if (!fs.existsSync(keystoreDebug)) missingFiles.push('keystore-debug.jks');
    if (!fs.existsSync(keystoreRelease)) missingFiles.push('keystore-release.jks');
    if (!fs.existsSync(keystoreProps)) missingFiles.push('keystore.properties');

    if (missingFiles.length > 0) {
      logger.failSpinner(`Missing Android keystore files for ${clientCode}`);
      missingFiles.forEach((file) => logger.error(`  Missing: ${file}`));
      logger.info('Generate keystores: npm run setup:keystore');
      this.failed = true;
      return false;
    }

    logger.succeedSpinner(`Android keystores ready${clientCode ? ` for ${clientCode}` : ''}`);
    return true;
  }

  // Check iOS certificates setup
  checkIosCertificatesSetup(clientCode = null) {
    // Skip on non-macOS
    if (process.platform !== 'darwin') {
      return true;
    }

    logger.startSpinner('Checking iOS certificates setup...');

    // Check required environment variables for iOS certificate generation
    const requiredEnvVars = [
      'MATCH_GIT_URL',
      'MATCH_PASSWORD',
      'APPLE_TEAM_ID',
      'APP_STORE_CONNECT_API_KEY_ID',
      'APP_STORE_CONNECT_API_ISSUER_ID',
      'APP_STORE_CONNECT_API_KEY',
    ];

    const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingEnvVars.length > 0) {
      logger.failSpinner('iOS certificate environment variables not set');
      logger.warn('The following variables are required for iOS certificate generation:');
      missingEnvVars.forEach((varName) => logger.warn(`  - ${varName}`));
      logger.info('Add these to your .env file to enable iOS builds');
      // Don't fail the entire pre-flight for missing iOS vars
      return false;
    }

    // If no specific client, just check env vars
    if (!clientCode) {
      logger.succeedSpinner('iOS certificate environment variables set');
      return true;
    }

    // Check specific client iOS certificates
    const { LOYALTY_CREDENTIALS_ROOT: credentialsRepoPath2 } = require('./paths');
    const iosClientDir = path.join(credentialsRepoPath2, 'clients', clientCode, 'ios');

    if (!fs.existsSync(iosClientDir)) {
      logger.failSpinner(`iOS certificates not found for client: ${clientCode}`);
      logger.error('Client does not have iOS provisioning profiles');
      logger.info('Generate certificates: npm run setup:ios');
      this.failed = true;
      return false;
    }

    // Check for provisioning profiles
    const profiles = fs.readdirSync(iosClientDir).filter((f) => f.endsWith('.mobileprovision'));

    if (profiles.length === 0) {
      logger.failSpinner(`No iOS provisioning profiles for ${clientCode}`);
      logger.error('Client directory exists but no .mobileprovision files found');
      logger.info('Generate certificates: npm run setup:ios');
      this.failed = true;
      return false;
    }

    logger.succeedSpinner(
      `iOS certificates ready${clientCode ? ` for ${clientCode} (${profiles.length} profile${profiles.length > 1 ? 's' : ''})` : ''}`
    );
    return true;
  }

  // Check white_label_app configuration files (required for deploy)
  checkWhiteLabelAppConfig() {
    logger.startSpinner('Checking white_label_app configuration...');

    const whiteLabelPath = WHITE_LABEL_APP_ROOT;

    // Required files for deploy
    const requiredFiles = [
      { path: path.join(whiteLabelPath, 'config.json'), name: 'config.json' },
      { path: path.join(whiteLabelPath, 'pubspec.yaml'), name: 'pubspec.yaml' },
    ];

    // Required directories
    const requiredDirs = [
      { path: path.join(whiteLabelPath, 'metadata'), name: 'metadata/' },
      { path: path.join(whiteLabelPath, 'assets', 'client_specific_assets'), name: 'assets/client_specific_assets/' },
    ];

    const missingFiles = [];
    const missingDirs = [];

    // Check required files
    requiredFiles.forEach(({ path: filePath, name }) => {
      if (!fs.existsSync(filePath)) {
        missingFiles.push(name);
      }
    });

    // Check required directories
    requiredDirs.forEach(({ path: dirPath, name }) => {
      if (!fs.existsSync(dirPath)) {
        missingDirs.push(name);
      }
    });

    if (missingFiles.length > 0 || missingDirs.length > 0) {
      logger.failSpinner('white_label_app configuration incomplete');

      if (missingFiles.length > 0) {
        logger.error('Missing files:');
        missingFiles.forEach((file) => logger.error(`  - white_label_app/${file}`));
      }

      if (missingDirs.length > 0) {
        logger.error('Missing directories:');
        missingDirs.forEach((dir) => logger.error(`  - white_label_app/${dir}`));
      }

      logger.blank();
      logger.info('Run white-label setup first: npm run start');
      this.failed = true;
      return false;
    }

    // Validate config.json has required fields
    try {
      const configPath = path.join(whiteLabelPath, 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      const requiredConfigFields = ['clientCode', 'clientName', 'bundleId'];
      const missingConfigFields = requiredConfigFields.filter((field) => !config[field]);

      if (missingConfigFields.length > 0) {
        logger.failSpinner('config.json missing required fields');
        logger.error('Missing fields in white_label_app/config.json:');
        missingConfigFields.forEach((field) => logger.error(`  - ${field}`));
        logger.blank();
        logger.info('Run white-label setup: npm run start');
        this.failed = true;
        return false;
      }

      logger.succeedSpinner(`white_label_app configured for: ${config.clientName} (${config.clientCode})`);
      return true;
    } catch (error) {
      logger.failSpinner('config.json is invalid');
      logger.error(`Error parsing config.json: ${error.message}`);
      this.failed = true;
      return false;
    }
  }

  // Run all checks
  async runAll(clientCode = null) {
    logger.section('Pre-flight Checks');

    this.checkNode();
    this.checkGit();
    this.checkFlutter();
    this.checkFirebaseCLI();
    this.checkGcloudCLI();
    await this.checkFirebaseAuth();
    this.checkFirebaseAccount();
    this.checkGcloudAccount();
    this.checkMacOS();
    this.checkXcode();
    this.checkAndroidSDK();
    this.checkFastlane();
    this.checkEnvVariables();
    this.checkLoyaltyCredentialsRepo();
    this.checkCredentialFiles();
    this.checkWhiteLabelAppConfig();
    this.checkAndroidKeystoreSetup(clientCode);
    this.checkIosCertificatesSetup(clientCode);

    logger.blank();

    if (this.failed) {
      logger.error('Pre-flight checks failed. Please fix the errors above before continuing.');
      process.exit(1);
    } else {
      logger.success('All pre-flight checks passed! ✈️');
      logger.blank();
    }

    return !this.failed;
  }
}

// Export singleton instance and class
const instance = new PreflightCheck();
module.exports = instance;
module.exports.PreflightCheck = PreflightCheck;

// Allow running directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config({ path: path.join(__dirname, '../.env') });

  const checker = new PreflightCheck();
  checker.runAll().catch((error) => {
    logger.error(`Pre-flight check error: ${error.message}`);
    process.exit(1);
  });
}
