const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');

/**
 * Deploy Firestore security rules to a Firebase project.
 * @param {string} projectId - Firebase project ID
 * @param {string} rulesFilePath - Path to firestore.rules file
 * @returns {Promise<boolean>} True if deployment succeeded
 */
async function deployFirestoreRules(projectId, rulesFilePath) {
  logger.startSpinner('Deploying Firestore security rules...');

  try {
    if (!fs.existsSync(rulesFilePath)) {
      throw new Error(`Rules file not found: ${rulesFilePath}`);
    }

    execSync(`firebase deploy --only firestore:rules --project ${projectId}`, {
      cwd: path.dirname(rulesFilePath),
      stdio: 'pipe',
    });

    logger.succeedSpinner('Firestore rules deployed successfully');
    return true;
  } catch (error) {
    logger.failSpinner(`Failed to deploy rules: ${error.message}`);
    throw error;
  }
}

/**
 * Deploy Firestore indexes to a Firebase project.
 * @param {string} projectId - Firebase project ID
 * @param {string} indexesFilePath - Path to firestore.indexes.json file
 * @returns {Promise<boolean>} True if deployment succeeded
 */
async function deployFirestoreIndexes(projectId, indexesFilePath) {
  logger.startSpinner('Deploying Firestore indexes...');

  try {
    if (!fs.existsSync(indexesFilePath)) {
      throw new Error(`Indexes file not found: ${indexesFilePath}`);
    }

    execSync(`firebase deploy --only firestore:indexes --project ${projectId}`, {
      cwd: path.dirname(indexesFilePath),
      stdio: 'pipe',
    });

    logger.succeedSpinner('Firestore indexes deployed successfully');
    return true;
  } catch (error) {
    logger.failSpinner(`Failed to deploy indexes: ${error.message}`);
    throw error;
  }
}

module.exports = {
  deployFirestoreRules,
  deployFirestoreIndexes,
};
