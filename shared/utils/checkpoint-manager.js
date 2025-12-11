const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Checkpoint TTL configuration
const CHECKPOINT_TTL_DAYS = 7; // Checkpoints older than 7 days are considered stale
const CHECKPOINT_TTL_MS = CHECKPOINT_TTL_DAYS * 24 * 60 * 60 * 1000;
const MAX_CHECKPOINTS = 50; // Maximum number of checkpoint files to keep

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

    // Run cleanup on initialization (async, non-blocking)
    if (options.autoCleanup !== false) {
      setImmediate(() => CheckpointManager.cleanupStaleCheckpoints());
    }
  }

  /**
   * Ensure checkpoints directory exists
   * @private
   */
  _ensureDir() {
    if (!fs.existsSync(this.checkpointsDir)) {
      fs.mkdirSync(this.checkpointsDir, { recursive: true });
    }
  }

  /**
   * Get the lock file path for this checkpoint
   * @private
   */
  _getLockFile() {
    return `${this.checkpointFile}.lock`;
  }

  /**
   * Acquire a lock for writing
   * Uses exclusive file creation as a simple locking mechanism
   * @param {number} maxRetries - Max number of retries (default: 10)
   * @param {number} retryDelay - Delay between retries in ms (default: 100)
   * @returns {boolean} True if lock acquired
   * @private
   */
  _acquireLock(maxRetries = 10, retryDelay = 100) {
    const lockFile = this._getLockFile();
    const lockData = JSON.stringify({ pid: process.pid, time: Date.now() });
    const staleLockAge = 30000; // 30 seconds

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Try to create lock file exclusively (fails if exists)
        fs.writeFileSync(lockFile, lockData, { flag: 'wx' });
        return true;
      } catch (error) {
        if (error.code === 'EEXIST') {
          // Lock exists, check if it's stale
          try {
            const stats = fs.statSync(lockFile);
            const lockAge = Date.now() - stats.mtimeMs;
            if (lockAge > staleLockAge) {
              // Stale lock, remove it and retry
              fs.unlinkSync(lockFile);
              continue;
            }
          } catch {
            // Lock file was removed by another process, retry
            continue;
          }

          // Lock is held by another process, wait and retry
          if (attempt < maxRetries - 1) {
            // Simple sync sleep (acceptable for short durations)
            const start = Date.now();
            while (Date.now() - start < retryDelay) {
              // Busy wait
            }
          }
        } else {
          // Unexpected error, fail silently
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Release the write lock
   * @private
   */
  _releaseLock() {
    try {
      fs.unlinkSync(this._getLockFile());
    } catch {
      // Ignore errors on unlock
    }
  }

  /**
   * Save a checkpoint with file locking
   * @param {string} stepName - Name of the completed step
   * @param {Object} state - Current state to save
   * @returns {boolean} True if saved successfully
   */
  saveCheckpoint(stepName, state = {}) {
    this._ensureDir();

    const checkpoint = {
      wizardType: this.wizardType,
      identifier: this.identifier,
      stepName,
      state,
      timestamp: new Date().toISOString(),
    };

    // Acquire lock before writing
    const lockAcquired = this._acquireLock();
    if (!lockAcquired) {
      logger.warn('Could not acquire checkpoint lock, proceeding without lock');
    }

    try {
      fs.writeFileSync(this.checkpointFile, JSON.stringify(checkpoint, null, 2), 'utf8');
      logger.info(`✓ Checkpoint saved: ${stepName}`);
      return true;
    } catch (error) {
      logger.warn(`Failed to save checkpoint: ${error.message}`);
      return false;
    } finally {
      if (lockAcquired) {
        this._releaseLock();
      }
    }
  }

  /**
   * Load the last checkpoint
   * @returns {Object|null} Last checkpoint or null if none exists
   */
  getLastCheckpoint() {
    if (!fs.existsSync(this.checkpointFile)) {
      return null;
    }

    try {
      const data = fs.readFileSync(this.checkpointFile, 'utf8');
      const checkpoint = JSON.parse(data);
      return checkpoint;
    } catch (error) {
      logger.warn(`Failed to load checkpoint: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if a checkpoint exists
   * @returns {boolean} True if checkpoint exists
   */
  exists() {
    return fs.existsSync(this.checkpointFile);
  }

  /**
   * Clear the checkpoint file
   */
  clear() {
    if (fs.existsSync(this.checkpointFile)) {
      try {
        fs.unlinkSync(this.checkpointFile);
        logger.info('✓ Checkpoint cleared');
      } catch (error) {
        logger.warn(`Failed to clear checkpoint: ${error.message}`);
      }
    }
  }

  /**
   * List all checkpoints for this wizard type
   * @returns {Array} Array of checkpoint objects
   */
  static listCheckpoints(wizardType) {
    const checkpointsDir = path.join(process.cwd(), '.checkpoints');

    if (!fs.existsSync(checkpointsDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(checkpointsDir);
      const pattern = `${wizardType}-`;

      return files
        .filter((file) => file.startsWith(pattern) && file.endsWith('.json'))
        .map((file) => {
          const filePath = path.join(checkpointsDir, file);
          const data = fs.readFileSync(filePath, 'utf8');
          return JSON.parse(data);
        });
    } catch (error) {
      logger.warn(`Failed to list checkpoints: ${error.message}`);
      return [];
    }
  }

  /**
   * Get a summary of the checkpoint
   * @returns {Object} Summary with step name and timestamp
   */
  getSummary() {
    const checkpoint = this.getLastCheckpoint();

    if (!checkpoint) {
      return null;
    }

    return {
      stepName: checkpoint.stepName,
      timestamp: checkpoint.timestamp,
      age: this._getAge(checkpoint.timestamp),
    };
  }

  /**
   * Get human-readable age of checkpoint
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Human-readable age
   * @private
   */
  _getAge(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
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
   * Check if a checkpoint is expired based on TTL
   * @param {string} timestamp - ISO timestamp
   * @returns {boolean} True if expired
   * @private
   */
  static _isExpired(timestamp) {
    if (!timestamp) return true;
    const age = Date.now() - new Date(timestamp).getTime();
    return age > CHECKPOINT_TTL_MS;
  }

  /**
   * Clean up stale checkpoint files (older than TTL or exceeding max count)
   * @returns {number} Number of files cleaned up
   */
  static cleanupStaleCheckpoints() {
    const checkpointsDir = path.join(process.cwd(), '.checkpoints');

    if (!fs.existsSync(checkpointsDir)) {
      return 0;
    }

    try {
      const files = fs.readdirSync(checkpointsDir).filter((f) => f.endsWith('.json'));
      let cleanedCount = 0;

      // Get file info with timestamps
      const fileInfos = files
        .map((file) => {
          const filePath = path.join(checkpointsDir, file);
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return {
              file,
              filePath,
              timestamp: data.timestamp || null,
              mtime: fs.statSync(filePath).mtime,
            };
          } catch {
            // Invalid JSON or can't read - mark for deletion
            return { file, filePath, timestamp: null, mtime: new Date(0) };
          }
        })
        .sort((a, b) => new Date(b.mtime) - new Date(a.mtime)); // Newest first

      // Delete expired checkpoints
      for (const info of fileInfos) {
        if (CheckpointManager._isExpired(info.timestamp)) {
          try {
            fs.unlinkSync(info.filePath);
            cleanedCount++;
          } catch {
            // Ignore deletion errors
          }
        }
      }

      // If still over limit, delete oldest files
      const remaining = fileInfos.filter((info) => fs.existsSync(info.filePath));
      if (remaining.length > MAX_CHECKPOINTS) {
        const toDelete = remaining.slice(MAX_CHECKPOINTS);
        for (const info of toDelete) {
          try {
            fs.unlinkSync(info.filePath);
            cleanedCount++;
          } catch {
            // Ignore deletion errors
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} stale checkpoint(s)`);
      }

      return cleanedCount;
    } catch (error) {
      // Don't fail on cleanup errors - just log and continue
      logger.warn(`Checkpoint cleanup failed: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get TTL configuration
   * @returns {Object} TTL settings
   */
  static getTTLConfig() {
    return {
      ttlDays: CHECKPOINT_TTL_DAYS,
      ttlMs: CHECKPOINT_TTL_MS,
      maxCheckpoints: MAX_CHECKPOINTS,
    };
  }
}

module.exports = CheckpointManager;
