const logger = require('../../../shared/utils/logger');
const { exec } = require('./exec-utils');

async function enableFirestore(projectId) {
  logger.startSpinner('Enabling Firestore...');

  try {
    exec(
      `firebase firestore:databases:create "(default)" --project ${projectId} --location=us-central1`,
      { timeout: 90000 }
    );

    logger.succeedSpinner('Firestore enabled');
    return true;
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('ALREADY_EXISTS')) {
      logger.succeedSpinner('Firestore already enabled');
      return true;
    }

    if (isApiNotEnabledError(error)) {
      return await handleApiNotEnabledError(projectId, error);
    }

    logger.failSpinner('Failed to enable Firestore');
    throw error;
  }
}

function isApiNotEnabledError(error) {
  return (
    error.message.includes('has not been used') ||
    error.message.includes('it is disabled') ||
    error.message.includes('403')
  );
}

async function handleApiNotEnabledError(projectId, _originalError) {
  logger.failSpinner('Firestore API not enabled');

  const enableUrl = `https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=${projectId}`;

  logger.blank();
  logger.warn('The Firestore API needs to be enabled for this project.');
  logger.blank();
  logger.info('Opening browser to enable the API...');
  logger.blank();

  try {
    exec(`open "${enableUrl}"`, { stdio: 'ignore' });
    logger.success('Browser opened automatically');
  } catch (openError) {
    logger.warn('Could not open browser automatically. Please visit:');
    logger.info(`   ${enableUrl}`);
  }

  logger.blank();
  logger.info('Please:');
  logger.info('1. Click the "ENABLE" button in the browser');
  logger.info('2. Wait for the API to be enabled (usually takes 10-30 seconds)');
  logger.blank();

  const inquirer = require('inquirer');
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Have you enabled the Firestore API?',
      default: false,
    },
  ]);

  if (!confirmed) {
    throw new Error('Firestore API enablement cancelled by user.');
  }

  logger.blank();
  logger.startSpinner('Waiting for API to propagate and creating Firestore database...');

  return await retryFirestoreCreation(projectId);
}

async function retryFirestoreCreation(projectId) {
  const maxRetries = 3;
  let lastError = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 5000 * (i + 1)));

      exec(
        `firebase firestore:databases:create "(default)" --project ${projectId} --location=us-central1`,
        { timeout: 90000 }
      );
      logger.succeedSpinner('Firestore enabled successfully!');
      return true;
    } catch (retryError) {
      lastError = retryError;
      if (i < maxRetries - 1) {
        logger.updateSpinner(`Retry ${i + 2}/${maxRetries} - waiting for API to propagate...`);
      }
    }
  }

  logger.failSpinner('Failed to enable Firestore after retries');
  logger.blank();
  logger.error('The API may need more time to propagate. Please wait 1-2 minutes and run:');
  logger.info('   npm run loyalty');
  logger.info('   (The wizard will resume from where it left off)');
  logger.blank();
  throw lastError;
}

module.exports = {
  enableFirestore,
};
