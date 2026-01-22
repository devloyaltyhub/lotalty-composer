const fs = require('fs');
const path = require('path');
const logger = require('../../../shared/utils/logger');
const { exec } = require('./exec-utils');

function grantServiceAccountAccess(projectId) {
  logger.startSpinner('Granting service account access to project...');

  try {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credPath || !fs.existsSync(credPath)) {
      logger.failSpinner('Service account credentials not found');
      logger.warn('GOOGLE_APPLICATION_CREDENTIALS not set or file not found');
      logger.info('The service account will need manual IAM permissions');
      return;
    }

    const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    const serviceAccountEmail = credentials.client_email;

    exec(
      `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${serviceAccountEmail}" --role="roles/editor" --quiet`,
      { timeout: 30000 }
    );

    exec(
      `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${serviceAccountEmail}" --role="roles/serviceusage.serviceUsageConsumer" --quiet`,
      { timeout: 30000 }
    );

    logger.succeedSpinner(`Service account ${serviceAccountEmail} granted access`);
  } catch (error) {
    logger.failSpinner('Could not grant service account access');
    logIamError(error, projectId);
    logger.info('Continuing with client creation...');
  }
}

function grantFirestorePermissions(projectId) {
  logger.startSpinner('Granting Firestore and Remote Config permissions to service account...');

  try {
    const serviceAccountEmail = `firebase-adminsdk-fbsvc@${projectId}.iam.gserviceaccount.com`;

    exec(
      `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${serviceAccountEmail}" --role="roles/datastore.owner" --quiet`,
      { timeout: 30000 }
    );

    exec(
      `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${serviceAccountEmail}" --role="roles/serviceusage.serviceUsageConsumer" --quiet`,
      { timeout: 30000 }
    );

    logger.succeedSpinner(`Firestore and Remote Config permissions granted to ${serviceAccountEmail}`);
  } catch (error) {
    logger.failSpinner('Could not grant Firestore/Remote Config permissions automatically');
    logFirestorePermissionError(error, projectId);
    logger.info('Continuing with client creation...');
  }
}

async function createClientServiceAccountKey(projectId, outputPath) {
  logger.startSpinner('Creating service account key for client project...');

  try {
    const serviceAccountEmail = `firebase-adminsdk-fbsvc@${projectId}.iam.gserviceaccount.com`;

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    exec(
      `gcloud iam service-accounts keys create "${outputPath}" --iam-account="${serviceAccountEmail}" --project="${projectId}"`,
      { timeout: 30000 }
    );

    if (!fs.existsSync(outputPath)) {
      throw new Error('Service account key was not created');
    }

    logger.succeedSpinner(`Service account key created: ${outputPath}`);
    return outputPath;
  } catch (error) {
    logger.failSpinner('Failed to create service account key');

    if (error.message.includes('timed out')) {
      logger.warn('Command timed out after 30 seconds');
      logger.info('This usually happens when gcloud is not authenticated');
      logger.info('Run: gcloud auth login');
    } else {
      logger.warn(error.message);
    }

    throw error;
  }
}

function logIamError(error, projectId) {
  if (error.message.includes('timed out')) {
    logger.warn('Command timed out after 30 seconds');
    logger.info('This usually happens when:');
    logger.info('   - gcloud is not authenticated (run: gcloud auth login)');
    logger.info('   - Network connectivity issues');
    logger.info('   - The project is still being created (try again in a few minutes)');
  } else {
    logger.warn(error.message);
  }

  logger.blank();
  logger.info('To grant permissions manually, run:');
  logger.info(`   gcloud projects add-iam-policy-binding ${projectId} \\`);
  logger.info(`     --member="serviceAccount:{your-service-account-email}" \\`);
  logger.info(`     --role="roles/editor"`);
  logger.info(`   gcloud projects add-iam-policy-binding ${projectId} \\`);
  logger.info(`     --member="serviceAccount:{your-service-account-email}" \\`);
  logger.info(`     --role="roles/serviceusage.serviceUsageConsumer"`);
  logger.blank();
}

function logFirestorePermissionError(error, projectId) {
  if (error.message.includes('timed out')) {
    logger.warn('Command timed out after 30 seconds');
    logger.info('This usually happens when:');
    logger.info('   - gcloud is not authenticated (run: gcloud auth login)');
    logger.info('   - Network connectivity issues');
  } else {
    logger.warn(error.message);
  }

  logger.blank();
  logger.info('To grant permissions manually, run:');
  logger.info(`   gcloud projects add-iam-policy-binding ${projectId} \\`);
  logger.info(
    `     --member="serviceAccount:firebase-adminsdk-fbsvc@${projectId}.iam.gserviceaccount.com" \\`
  );
  logger.info(`     --role="roles/datastore.owner"`);
  logger.info(`   gcloud projects add-iam-policy-binding ${projectId} \\`);
  logger.info(
    `     --member="serviceAccount:firebase-adminsdk-fbsvc@${projectId}.iam.gserviceaccount.com" \\`
  );
  logger.info(`     --role="roles/serviceusage.serviceUsageConsumer"`);
  logger.blank();
}

module.exports = {
  grantServiceAccountAccess,
  grantFirestorePermissions,
  createClientServiceAccountKey,
};
