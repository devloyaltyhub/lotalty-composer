const logger = require('./logger');
const {
  createFirebaseProjectRollback,
  createDirectoryRollback,
  createFileRollback,
  createGitBranchRollback,
  createGitTagRollback,
  createMasterFirebaseEntryRollback,
  createFirestoreCollectionRollback,
} = require('./rollback-handlers');

/**
 * Tracks created resources and provides rollback capability
 * Used during client creation to cleanup on failure
 *
 * Resource Types:
 * - firebase_project: Firebase project created
 * - firebase_data: Data seeded to Firestore
 * - directory: Local directory created
 * - file: Local file created
 * - git_branch: Git branch created
 * - git_tag: Git tag created
 * - master_firebase_entry: Entry in master Firebase
 */
class ResourceTracker {
  constructor() {
    this.resources = [];
  }

  /**
   * Track a Firebase project creation
   * @param {string} projectId - Firebase project ID
   */
  trackFirebaseProject(projectId) {
    this.resources.push({
      type: 'firebase_project',
      projectId,
      rollback: createFirebaseProjectRollback(projectId),
    });
    logger.info(`Tracked: Firebase project ${projectId}`);
  }

  /**
   * Track a directory creation
   * @param {string} dirPath - Absolute path to directory
   */
  trackDirectory(dirPath) {
    this.resources.push({
      type: 'directory',
      path: dirPath,
      rollback: createDirectoryRollback(dirPath),
    });
    logger.info(`Tracked: Directory ${dirPath}`);
  }

  /**
   * Track a file creation
   * @param {string} filePath - Absolute path to file
   */
  trackFile(filePath) {
    this.resources.push({
      type: 'file',
      path: filePath,
      rollback: createFileRollback(filePath),
    });
    logger.info(`Tracked: File ${filePath}`);
  }

  /**
   * Track a git branch creation
   * @param {string} branchName - Branch name
   * @param {Object} gitManager - GitBranchManager instance
   */
  trackGitBranch(branchName, gitManager) {
    this.resources.push({
      type: 'git_branch',
      branchName,
      rollback: createGitBranchRollback(branchName, gitManager),
    });
    logger.info(`Tracked: Git branch ${branchName}`);
  }

  /**
   * Track a git tag creation
   * @param {string} tagName - Tag name
   * @param {Object} gitManager - GitBranchManager instance
   */
  trackGitTag(tagName, gitManager) {
    this.resources.push({
      type: 'git_tag',
      tagName,
      rollback: createGitTagRollback(tagName, gitManager),
    });
    logger.info(`Tracked: Git tag ${tagName}`);
  }

  /**
   * Track an entry in master Firebase
   * @param {string} clientCode - Client code
   * @param {Object} firebaseClient - FirebaseClient instance
   */
  trackMasterFirebaseEntry(clientCode, firebaseClient) {
    this.resources.push({
      type: 'master_firebase_entry',
      clientCode,
      rollback: createMasterFirebaseEntryRollback(clientCode, firebaseClient),
    });
    logger.info(`Tracked: Master Firebase entry for ${clientCode}`);
  }

  /**
   * Track Firestore data seeding (collection-level)
   * @param {string} clientCode - Client code
   * @param {string} collectionName - Firestore collection name
   * @param {Object} firebaseClient - FirebaseClient instance
   */
  trackFirestoreCollection(clientCode, collectionName, firebaseClient) {
    this.resources.push({
      type: 'firestore_collection',
      clientCode,
      collectionName,
      rollback: createFirestoreCollectionRollback(clientCode, collectionName, firebaseClient),
    });
    logger.info(`Tracked: Firestore collection ${collectionName}`);
  }

  /**
   * Get summary of tracked resources
   * @returns {Object} Summary object with counts by type
   */
  getSummary() {
    const summary = {};
    for (const resource of this.resources) {
      summary[resource.type] = (summary[resource.type] || 0) + 1;
    }
    return summary;
  }

  /**
   * Print summary of tracked resources
   */
  printSummary() {
    const summary = this.getSummary();
    logger.info('');
    logger.info('Tracked Resources:');
    logger.info('-------------------------------------------');
    for (const [type, count] of Object.entries(summary)) {
      logger.info(`  ${type}: ${count}`);
    }
    logger.info(`  TOTAL: ${this.resources.length}`);
    logger.info('-------------------------------------------');
    logger.info('');
  }

  /**
   * Execute rollback for all tracked resources
   * Executes in reverse order (LIFO - Last In First Out)
   * @returns {Promise<Object>} Results object with success/failure counts
   */
  async rollback() {
    if (this.resources.length === 0) {
      logger.info('No resources to rollback');
      return { success: 0, failed: 0, total: 0 };
    }

    logger.warn('');
    logger.warn('-------------------------------------------');
    logger.warn('  ROLLING BACK RESOURCES');
    logger.warn('-------------------------------------------');
    this.printSummary();

    const results = { success: 0, failed: 0, total: this.resources.length };

    for (let i = this.resources.length - 1; i >= 0; i--) {
      const resource = this.resources[i];
      try {
        logger.info(`[${i + 1}/${this.resources.length}] Rolling back ${resource.type}...`);
        await resource.rollback();
        results.success++;
      } catch (error) {
        logger.error(`Failed to rollback ${resource.type}: ${error.message}`);
        results.failed++;
      }
    }

    logger.warn('');
    logger.warn('-------------------------------------------');
    logger.warn('  ROLLBACK COMPLETE');
    logger.warn('-------------------------------------------');
    logger.info(`  Success: ${results.success}/${results.total}`);
    if (results.failed > 0) {
      logger.error(`  Failed:  ${results.failed}/${results.total}`);
    }
    logger.warn('-------------------------------------------');
    logger.warn('');

    this.resources = [];
    return results;
  }

  /**
   * Clear all tracked resources without rolling back
   * Use this after successful completion
   */
  clear() {
    logger.info(`Clearing resource tracker (${this.resources.length} resources tracked)`);
    this.resources = [];
  }

  /**
   * Get count of tracked resources
   * @returns {number} Number of tracked resources
   */
  count() {
    return this.resources.length;
  }
}

module.exports = ResourceTracker;
