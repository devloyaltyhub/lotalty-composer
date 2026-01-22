const logger = require('../logger');

function createAccountChecks(context) {
  const { execCommand, setFailed } = context;

  async function checkFirebaseAuth() {
    logger.startSpinner('Checking Firebase authentication...');

    const currentProject = execCommand('firebase projects:list --json 2>/dev/null');

    if (!currentProject || currentProject.includes('error')) {
      logger.failSpinner('Firebase not authenticated');
      logger.error('Firebase CLI is not authenticated');
      logger.info('Run: firebase login');
      setFailed();
      return false;
    }

    logger.succeedSpinner('Firebase authenticated');
    return true;
  }

  function checkFirebaseAccount() {
    const expectedEmail = process.env.EXPECTED_GOOGLE_ACCOUNT;

    if (!expectedEmail) {
      return true;
    }

    logger.startSpinner('Checking Firebase account...');

    const output = execCommand('firebase login:list 2>/dev/null');

    if (!output) {
      logger.failSpinner('Could not get Firebase account info');
      logger.error('Unable to retrieve Firebase login information');
      setFailed();
      return false;
    }

    let activeAccount = null;

    const loggedInMatch = output.match(
      /Logged in as\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/
    );
    if (loggedInMatch) {
      activeAccount = loggedInMatch[1];
    } else {
      const emailMatch = output.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) {
        activeAccount = emailMatch[1];
      }
    }

    if (!activeAccount) {
      logger.failSpinner('Could not detect active Firebase account');
      logger.error('Unable to determine which Firebase account is active');
      setFailed();
      return false;
    }

    if (activeAccount !== expectedEmail) {
      logger.failSpinner(`Wrong Firebase account: ${activeAccount}`);
      logger.error(`Firebase CLI is logged in with: ${activeAccount}`);
      logger.error(`Expected business account: ${expectedEmail}`);
      logger.blank();
      logger.info('To switch accounts, run:');
      logger.info('  firebase login --reauth');
      logger.blank();
      setFailed();
      return false;
    }

    logger.succeedSpinner(`Firebase account: ${activeAccount}`);
    return true;
  }

  function checkGcloudAccount() {
    const expectedEmail = process.env.EXPECTED_GOOGLE_ACCOUNT;

    if (!expectedEmail) {
      return true;
    }

    logger.startSpinner('Checking gcloud account...');

    const output = execCommand(
      'gcloud auth list --format="value(account)" --filter="status:ACTIVE" 2>/dev/null'
    );

    if (!output) {
      logger.failSpinner('Could not get gcloud account info');
      logger.error('Unable to retrieve gcloud authentication information');
      setFailed();
      return false;
    }

    const activeAccount = output.trim();

    if (!activeAccount) {
      logger.failSpinner('No active gcloud account found');
      logger.error('gcloud CLI does not have an active account');
      logger.info('Run: gcloud auth login');
      setFailed();
      return false;
    }

    if (activeAccount !== expectedEmail) {
      logger.failSpinner(`Wrong gcloud account: ${activeAccount}`);
      logger.error(`gcloud CLI is logged in with: ${activeAccount}`);
      logger.error(`Expected business account: ${expectedEmail}`);
      logger.blank();
      logger.info('To switch accounts, run one of:');
      logger.info(`  gcloud config set account ${expectedEmail}`);
      logger.info('  gcloud auth login');
      logger.blank();
      setFailed();
      return false;
    }

    logger.succeedSpinner(`gcloud account: ${activeAccount}`);
    return true;
  }

  return {
    checkFirebaseAuth,
    checkFirebaseAccount,
    checkGcloudAccount,
  };
}

module.exports = { createAccountChecks };
