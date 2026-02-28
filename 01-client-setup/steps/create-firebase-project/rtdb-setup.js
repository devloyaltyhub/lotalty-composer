const logger = require('../../../shared/utils/logger');
const { exec } = require('./exec-utils');

async function enableRealtimeDatabase(projectId) {
  const instanceName = `${projectId}-default-rtdb`;
  logger.startSpinner('Enabling Realtime Database...');

  try {
    exec(`firebase database:instances:create ${instanceName} --project ${projectId} --location us-central1`, {
      timeout: 90000,
    });

    logger.succeedSpinner('Realtime Database enabled');
    return true;
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('ALREADY_EXISTS')) {
      logger.succeedSpinner('Realtime Database already enabled');
      return true;
    }

    logger.failSpinner('Failed to enable Realtime Database');
    logger.warn(`RTDB setup failed: ${error.message}`);
    logger.info('You can enable it manually in Firebase Console > Realtime Database');
    return false;
  }
}

module.exports = {
  enableRealtimeDatabase,
};
