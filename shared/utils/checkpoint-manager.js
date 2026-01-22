const path = require('path');
const logger = require('./logger');
const CheckpointStorage = require('./checkpoint-storage');
const {
  getAge,
  getTTLConfig,
  cleanupStaleCheckpoints,
  listCheckpoints,
} = require('./checkpoint-helpers');

/**
 * Manages checkpoints for long-running wizards
 * Allows saving state and resuming from where it left off
 *
 * Usage:
 * const checkpointManager = new CheckpointManager('client-creation', clientCode);
 * checkpointManager.saveCheckpoint('firebase_created', { projectId, ... });
 * const lastCheckpoint = checkpointManager.getLastCheckpoint();
 * checkpointManager.clear();
 */
class CheckpointManager {
  /**
   * Create a checkpoint manager
   * @param {string} wizardType - Type of wizard (e.g., 'client-creation')
   * @param {string} identifier - Unique identifier (e.g., client code)
   * @param {Object} options - Optional configuration
   * @param {boolean} options.autoCleanup - Whether to run cleanup on init (default: true)
   */
  constructor(wizardType, identifier, options = {}) {
    this.wizardType = wizardType;
    this.identifier = identifier;
    this.checkpointsDir = path.join(process.cwd(), '.checkpoints');
    this.checkpointFile = path.join(this.checkpointsDir, `${wizardType}-${identifier}.json`);
    this.storage = new CheckpointStorage(this.checkpointsDir, this.checkpointFile);

    if (options.autoCleanup !== false) {
      setImmediate(() => CheckpointManager.cleanupStaleCheckpoints());
    }
  }

  /**
   * Save a checkpoint
   * @param {string} stepName - Name of the completed step
   * @param {Object} state - Current state to save
   * @returns {boolean} True if saved successfully
   */
  saveCheckpoint(stepName, state = {}) {
    const checkpoint = {
      wizardType: this.wizardType,
      identifier: this.identifier,
      stepName,
      state,
      timestamp: new Date().toISOString(),
    };

    const success = this.storage.write(checkpoint);
    if (success) {
      logger.info(`✓ Checkpoint saved: ${stepName}`);
    }
    return success;
  }

  /**
   * Load the last checkpoint
   * @returns {Object|null} Last checkpoint or null if none exists
   */
  getLastCheckpoint() {
    return this.storage.read();
  }

  /**
   * Check if a checkpoint exists
   * @returns {boolean} True if checkpoint exists
   */
  exists() {
    return this.storage.exists();
  }

  /**
   * Clear the checkpoint file
   */
  clear() {
    if (this.storage.delete()) {
      logger.info('✓ Checkpoint cleared');
    }
  }

  /**
   * Get a summary of the checkpoint
   * @returns {Object|null} Summary with step name, timestamp, and age
   */
  getSummary() {
    const checkpoint = this.getLastCheckpoint();

    if (!checkpoint) {
      return null;
    }

    return {
      stepName: checkpoint.stepName,
      timestamp: checkpoint.timestamp,
      age: getAge(checkpoint.timestamp),
    };
  }

  /**
   * Prompt user to resume from checkpoint or start fresh
   * @param {Function} inquirer - Inquirer instance
   * @returns {Promise<boolean>} True if should resume, false if start fresh
   */
  async promptResume(inquirer) {
    const checkpoint = this.getLastCheckpoint();

    if (!checkpoint) {
      return false;
    }

    const summary = this.getSummary();

    logger.blank();
    logger.warn('⚠️  Found existing checkpoint');
    logger.keyValue('Last Step', summary.stepName);
    logger.keyValue('Saved', summary.age);
    logger.blank();

    const { shouldResume } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldResume',
        message: 'Resume from checkpoint?',
        default: true,
      },
    ]);

    if (!shouldResume) {
      logger.warn('Starting fresh - clearing checkpoint');
      this.clear();
    }

    return shouldResume;
  }

  /**
   * List all checkpoints for this wizard type
   * @param {string} wizardType - Type of wizard to list
   * @returns {Array} Array of checkpoint objects
   */
  static listCheckpoints(wizardType) {
    return listCheckpoints(wizardType);
  }

  /**
   * Clean up stale checkpoint files (older than TTL or exceeding max count)
   * @returns {number} Number of files cleaned up
   */
  static cleanupStaleCheckpoints() {
    return cleanupStaleCheckpoints();
  }

  /**
   * Get TTL configuration
   * @returns {Object} TTL settings
   */
  static getTTLConfig() {
    return getTTLConfig();
  }
}

module.exports = CheckpointManager;
