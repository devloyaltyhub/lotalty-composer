const { execSync } = require('child_process');
const path = require('path');
const logger = require('./logger');
const { COMPOSE_ROOT } = require('./paths');
const {
  createCliChecks,
  createEnvironmentChecks,
  createAccountChecks,
  createPlatformChecks,
  createKeystoreChecks,
  createIosChecks,
  createCredentialsRepoChecks,
  createWhiteLabelChecks,
} = require('./preflight');

require('dotenv').config({ path: path.join(COMPOSE_ROOT, '.env') });

const automationRoot = COMPOSE_ROOT;

function resolveCredentialPath(envVar) {
  let value = process.env[envVar];
  if (!value) return;

  value = value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    return process.env[varName] || match;
  });

  if (!path.isAbsolute(value)) {
    value = path.resolve(automationRoot, value);
  }

  process.env[envVar] = value;
}

resolveCredentialPath('MASTER_FIREBASE_SERVICE_ACCOUNT');
resolveCredentialPath('GOOGLE_APPLICATION_CREDENTIALS');
resolveCredentialPath('GOOGLE_PLAY_JSON_KEY');
resolveCredentialPath('APP_STORE_CONNECT_API_KEY');

class PreflightCheck {
  constructor() {
    this.checks = [];
    this.failed = false;
    this.initializeModules();
  }

  initializeModules() {
    const context = {
      execCommand: this.execCommand.bind(this),
      commandExists: this.commandExists.bind(this),
      setFailed: () => {
        this.failed = true;
      },
    };

    const cliChecks = createCliChecks(context);
    this.checkFlutter = cliChecks.checkFlutter;
    this.checkFirebaseCLI = cliChecks.checkFirebaseCLI;
    this.checkGcloudCLI = cliChecks.checkGcloudCLI;
    this.checkGit = cliChecks.checkGit;
    this.checkNode = cliChecks.checkNode;
    this.checkXcode = cliChecks.checkXcode;
    this.checkFastlane = cliChecks.checkFastlane;

    const envChecks = createEnvironmentChecks(context);
    this.checkEnvVariables = envChecks.checkEnvVariables;
    this.checkCredentialFiles = envChecks.checkCredentialFiles;

    const accountChecks = createAccountChecks(context);
    this.checkFirebaseAuth = accountChecks.checkFirebaseAuth;
    this.checkFirebaseAccount = accountChecks.checkFirebaseAccount;
    this.checkGcloudAccount = accountChecks.checkGcloudAccount;

    const platformChecks = createPlatformChecks();
    this.checkMacOS = platformChecks.checkMacOS;
    this.checkAndroidSDK = platformChecks.checkAndroidSDK;

    const keystoreChecks = createKeystoreChecks(context);
    this.checkAndroidKeystoreSetup = keystoreChecks.checkAndroidKeystoreSetup;

    const iosChecks = createIosChecks(context);
    this.checkIosCertificatesSetup = iosChecks.checkIosCertificatesSetup;

    const credentialsRepoChecks = createCredentialsRepoChecks(context);
    this.checkLoyaltyCredentialsRepo = credentialsRepoChecks.checkLoyaltyCredentialsRepo;

    const whiteLabelChecks = createWhiteLabelChecks(context);
    this.checkWhiteLabelAppConfig = whiteLabelChecks.checkWhiteLabelAppConfig;
  }

  execCommand(command) {
    try {
      return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
    } catch {
      return null;
    }
  }

  commandExists(command) {
    return this.execCommand(`which ${command}`) !== null;
  }

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
      logger.success('All pre-flight checks passed!');
      logger.blank();
    }

    return !this.failed;
  }
}

const instance = new PreflightCheck();
module.exports = instance;
module.exports.PreflightCheck = PreflightCheck;

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });

  const checker = new PreflightCheck();
  checker.runAll().catch((error) => {
    logger.error(`Pre-flight check error: ${error.message}`);
    process.exit(1);
  });
}
