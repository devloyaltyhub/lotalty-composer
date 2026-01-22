const fs = require('fs');
const logger = require('./logger');

/**
 * Rollback handlers for different resource types
 * Each handler returns a rollback function that can be executed later
 */

/**
 * Create rollback handler for Firebase project
 * @param {string} projectId - Firebase project ID
 * @returns {Function} Async rollback function
 */
function createFirebaseProjectRollback(projectId) {
  return async () => {
    logger.warn(`Manual cleanup required: Delete Firebase project "${projectId}" from console`);
    logger.warn(`   https://console.firebase.google.com/project/${projectId}/settings/general`);
  };
}

/**
 * Create rollback handler for directory
 * @param {string} dirPath - Absolute path to directory
 * @returns {Function} Async rollback function
 */
function createDirectoryRollback(dirPath) {
  return async () => {
    if (fs.existsSync(dirPath)) {
      logger.info(`Removing directory: ${dirPath}`);
      fs.rmSync(dirPath, { recursive: true, force: true });
      logger.success(`Directory removed`);
    }
  };
}

/**
 * Create rollback handler for file
 * @param {string} filePath - Absolute path to file
 * @returns {Function} Async rollback function
 */
function createFileRollback(filePath) {
  return async () => {
    if (fs.existsSync(filePath)) {
      logger.info(`Removing file: ${filePath}`);
      fs.unlinkSync(filePath);
      logger.success(`File removed`);
    }
  };
}

/**
 * Create rollback handler for git branch
 * @param {string} branchName - Branch name
 * @param {Object} gitManager - GitBranchManager instance
 * @returns {Function} Async rollback function
 */
function createGitBranchRollback(branchName, gitManager) {
  return async () => {
    try {
      logger.info(`Deleting git branch: ${branchName}`);
      await gitManager.git.checkout('main');
      await gitManager.git.deleteLocalBranch(branchName, true);

      try {
        await gitManager.git.push('origin', branchName, ['--delete']);
        logger.success(`Remote branch deleted`);
      } catch (error) {
        logger.warn(`Remote branch may not exist: ${error.message}`);
      }

      logger.success(`Branch deleted`);
    } catch (error) {
      logger.error(`Failed to delete branch: ${error.message}`);
    }
  };
}

/**
 * Create rollback handler for git tag
 * @param {string} tagName - Tag name
 * @param {Object} gitManager - GitBranchManager instance
 * @returns {Function} Async rollback function
 */
function createGitTagRollback(tagName, gitManager) {
  return async () => {
    try {
      logger.info(`Deleting git tag: ${tagName}`);
      await gitManager.git.tag(['-d', tagName]);

      try {
        await gitManager.git.push('origin', `:refs/tags/${tagName}`);
        logger.success(`Remote tag deleted`);
      } catch (error) {
        logger.warn(`Remote tag may not exist: ${error.message}`);
      }

      logger.success(`Tag deleted`);
    } catch (error) {
      logger.error(`Failed to delete tag: ${error.message}`);
    }
  };
}

/**
 * Create rollback handler for master Firebase entry
 * @param {string} clientCode - Client code
 * @param {Object} firebaseClient - FirebaseClient instance
 * @returns {Function} Async rollback function
 */
function createMasterFirebaseEntryRollback(clientCode, firebaseClient) {
  return async () => {
    try {
      logger.info(`Removing client entry from master Firebase: ${clientCode}`);
      const firestore = await firebaseClient.getMasterFirestore();
      await firestore.collection('clients').doc(clientCode).delete();
      logger.success(`Master Firebase entry removed`);
    } catch (error) {
      logger.error(`Failed to remove master Firebase entry: ${error.message}`);
    }
  };
}

/**
 * Create rollback handler for Firestore collection
 * @param {string} clientCode - Client code
 * @param {string} collectionName - Firestore collection name
 * @param {Object} firebaseClient - FirebaseClient instance
 * @returns {Function} Async rollback function
 */
function createFirestoreCollectionRollback(clientCode, collectionName, firebaseClient) {
  return async () => {
    try {
      logger.info(`Clearing Firestore collection: ${collectionName}`);
      const firestore = firebaseClient.getClientFirestore(clientCode);
      const snapshot = await firestore.collection(collectionName).get();

      const batch = firestore.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));

      await batch.commit();
      logger.success(`Collection ${collectionName} cleared (${snapshot.size} documents)`);
    } catch (error) {
      logger.error(`Failed to clear collection ${collectionName}: ${error.message}`);
    }
  };
}

module.exports = {
  createFirebaseProjectRollback,
  createDirectoryRollback,
  createFileRollback,
  createGitBranchRollback,
  createGitTagRollback,
  createMasterFirebaseEntryRollback,
  createFirestoreCollectionRollback,
};
