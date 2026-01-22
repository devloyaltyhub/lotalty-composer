const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Handles file I/O operations for checkpoint management
 * Includes file locking for concurrent access safety
 */
class CheckpointStorage {
  /**
   * @param {string} checkpointsDir - Directory for checkpoint files
   * @param {string} checkpointFile - Full path to checkpoint file
   */
  constructor(checkpointsDir, checkpointFile) {
    this.checkpointsDir = checkpointsDir;
    this.checkpointFile = checkpointFile;
  }

  /**
   * Ensure checkpoints directory exists
   */
  ensureDir() {
    if (!fs.existsSync(this.checkpointsDir)) {
      fs.mkdirSync(this.checkpointsDir, { recursive: true });
    }
  }

  /**
   * Get the lock file path for this checkpoint
   * @returns {string} Lock file path
   */
  getLockFile() {
    return `${this.checkpointFile}.lock`;
  }

  /**
   * Acquire a lock for writing
   * Uses exclusive file creation as a simple locking mechanism
   * @param {number} maxRetries - Max number of retries (default: 10)
   * @param {number} retryDelay - Delay between retries in ms (default: 100)
   * @returns {boolean} True if lock acquired
   */
  acquireLock(maxRetries = 10, retryDelay = 100) {
    const lockFile = this.getLockFile();
    const lockData = JSON.stringify({ pid: process.pid, time: Date.now() });
    const staleLockAge = 30000; // 30 seconds

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        fs.writeFileSync(lockFile, lockData, { flag: 'wx' });
        return true;
      } catch (error) {
        if (error.code === 'EEXIST') {
          if (this._handleExistingLock(lockFile, staleLockAge)) {
            continue;
          }
          if (attempt < maxRetries - 1) {
            this._syncSleep(retryDelay);
          }
        } else {
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Handle existing lock file (check if stale)
   * @param {string} lockFile - Lock file path
   * @param {number} staleLockAge - Age in ms after which lock is stale
   * @returns {boolean} True if lock was removed (should retry)
   * @private
   */
  _handleExistingLock(lockFile, staleLockAge) {
    try {
      const stats = fs.statSync(lockFile);
      const lockAge = Date.now() - stats.mtimeMs;
      if (lockAge > staleLockAge) {
        fs.unlinkSync(lockFile);
        return true;
      }
    } catch {
      return true;
    }
    return false;
  }

  /**
   * Synchronous sleep (busy wait)
   * @param {number} ms - Milliseconds to sleep
   * @private
   */
  _syncSleep(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      // Busy wait
    }
  }

  /**
   * Release the write lock
   */
  releaseLock() {
    try {
      fs.unlinkSync(this.getLockFile());
    } catch {
      // Ignore errors on unlock
    }
  }

  /**
   * Write checkpoint data to file with optional locking
   * @param {Object} checkpoint - Checkpoint data to write
   * @returns {boolean} True if written successfully
   */
  write(checkpoint) {
    this.ensureDir();

    const lockAcquired = this.acquireLock();
    if (!lockAcquired) {
      logger.warn('Could not acquire checkpoint lock, proceeding without lock');
    }

    try {
      fs.writeFileSync(this.checkpointFile, JSON.stringify(checkpoint, null, 2), 'utf8');
      return true;
    } catch (error) {
      logger.warn(`Failed to save checkpoint: ${error.message}`);
      return false;
    } finally {
      if (lockAcquired) {
        this.releaseLock();
      }
    }
  }

  /**
   * Read checkpoint data from file
   * @returns {Object|null} Checkpoint data or null
   */
  read() {
    if (!fs.existsSync(this.checkpointFile)) {
      return null;
    }

    try {
      const data = fs.readFileSync(this.checkpointFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn(`Failed to load checkpoint: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if checkpoint file exists
   * @returns {boolean} True if exists
   */
  exists() {
    return fs.existsSync(this.checkpointFile);
  }

  /**
   * Delete checkpoint file
   * @returns {boolean} True if deleted or didn't exist
   */
  delete() {
    if (fs.existsSync(this.checkpointFile)) {
      try {
        fs.unlinkSync(this.checkpointFile);
        return true;
      } catch (error) {
        logger.warn(`Failed to clear checkpoint: ${error.message}`);
        return false;
      }
    }
    return true;
  }

  /**
   * List all checkpoint files in a directory
   * @param {string} checkpointsDir - Directory to scan
   * @param {string} [pattern] - Optional filename prefix to filter
   * @returns {Array<{file: string, filePath: string, data: Object|null, mtime: Date}>}
   */
  static listFiles(checkpointsDir, pattern = null) {
    if (!fs.existsSync(checkpointsDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(checkpointsDir).filter((f) => f.endsWith('.json'));

      const filtered = pattern ? files.filter((f) => f.startsWith(pattern)) : files;

      return filtered.map((file) => {
        const filePath = path.join(checkpointsDir, file);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          return {
            file,
            filePath,
            data,
            timestamp: data.timestamp || null,
            mtime: fs.statSync(filePath).mtime,
          };
        } catch {
          return { file, filePath, data: null, timestamp: null, mtime: new Date(0) };
        }
      });
    } catch {
      return [];
    }
  }

  /**
   * Delete a file by path
   * @param {string} filePath - Path to delete
   * @returns {boolean} True if deleted
   */
  static deleteFile(filePath) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = CheckpointStorage;
