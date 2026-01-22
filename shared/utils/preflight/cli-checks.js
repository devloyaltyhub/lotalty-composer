const logger = require('../logger');

function createCliChecks(context) {
  const { execCommand, commandExists, setFailed } = context;

  function checkFlutter() {
    logger.startSpinner('Checking Flutter installation...');

    if (!commandExists('flutter')) {
      logger.failSpinner('Flutter not found');
      logger.error('Flutter is not installed or not in PATH');
      logger.info('Install: https://docs.flutter.dev/get-started/install');
      setFailed();
      return false;
    }

    const version = execCommand('flutter --version | head -n 1');
    logger.succeedSpinner(`Flutter found: ${version}`);
    return true;
  }

  function checkFirebaseCLI() {
    logger.startSpinner('Checking Firebase CLI...');

    if (!commandExists('firebase')) {
      logger.failSpinner('Firebase CLI not found');
      logger.error('Firebase CLI is not installed');
      logger.info('Install: npm install -g firebase-tools');
      setFailed();
      return false;
    }

    const version = execCommand('firebase --version');
    logger.succeedSpinner(`Firebase CLI found: v${version}`);
    return true;
  }

  function checkGcloudCLI() {
    logger.startSpinner('Checking Google Cloud SDK...');

    if (!commandExists('gcloud')) {
      logger.failSpinner('Google Cloud SDK not found');
      logger.error('Google Cloud SDK is not installed');
      logger.info('Install: brew install google-cloud-sdk');
      logger.info('Or visit: https://cloud.google.com/sdk/docs/install');
      setFailed();
      return false;
    }

    const version = execCommand('gcloud --version | head -n 1');
    logger.succeedSpinner(`${version}`);
    return true;
  }

  function checkGit() {
    logger.startSpinner('Checking Git...');

    if (!commandExists('git')) {
      logger.failSpinner('Git not found');
      logger.error('Git is not installed');
      logger.info('Install: https://git-scm.com/downloads');
      setFailed();
      return false;
    }

    const version = execCommand('git --version');
    logger.succeedSpinner(`${version}`);
    return true;
  }

  function checkNode() {
    logger.startSpinner('Checking Node.js...');

    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);

    if (major < 16) {
      logger.failSpinner(`Node.js ${version} is too old`);
      logger.error('Node.js 16 or higher is required');
      logger.info('Install: https://nodejs.org/');
      setFailed();
      return false;
    }

    logger.succeedSpinner(`Node.js ${version}`);
    return true;
  }

  function checkXcode() {
    if (process.platform !== 'darwin') {
      return true;
    }

    logger.startSpinner('Checking Xcode...');

    if (!commandExists('xcodebuild')) {
      logger.failSpinner('Xcode not found');
      logger.warn('Xcode is required for iOS builds');
      logger.info('Install from App Store');
      return false;
    }

    const version = execCommand('xcodebuild -version | head -n 1');
    logger.succeedSpinner(`${version}`);
    return true;
  }

  function checkFastlane() {
    logger.startSpinner('Checking Fastlane...');

    if (!commandExists('fastlane')) {
      logger.failSpinner('Fastlane not found');
      logger.error('Fastlane is required for app store deployment');
      logger.info('Install: gem install fastlane');
      setFailed();
      return false;
    }

    const version = execCommand('fastlane --version | grep "fastlane [0-9]"');
    logger.succeedSpinner(`Fastlane found: ${version}`);
    return true;
  }

  return {
    checkFlutter,
    checkFirebaseCLI,
    checkGcloudCLI,
    checkGit,
    checkNode,
    checkXcode,
    checkFastlane,
  };
}

module.exports = { createCliChecks };
