const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const CheckpointStorage = require('./checkpoint-storage');

const CHECKPOINT_TTL_DAYS = 7;
const CHECKPOINT_TTL_MS = CHECKPOINT_TTL_DAYS * 24 * 60 * 60 * 1000;
const MAX_CHECKPOINTS = 50;

/**
 * Get human-readable age from timestamp
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Human-readable age
 */
function getAge(timestamp) {
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
 * Check if a checkpoint is expired based on TTL
 * @param {string} timestamp - ISO timestamp
 * @returns {boolean} True if expired
 */
function isExpired(timestamp) {
  if (!timestamp) return true;
  const age = Date.now() - new Date(timestamp).getTime();
  return age > CHECKPOINT_TTL_MS;
}

/**
 * Get TTL configuration
 * @returns {Object} TTL settings
 */
function getTTLConfig() {
  return {
    ttlDays: CHECKPOINT_TTL_DAYS,
    ttlMs: CHECKPOINT_TTL_MS,
    maxCheckpoints: MAX_CHECKPOINTS,
  };
}

/**
 * Clean up stale checkpoint files (older than TTL or exceeding max count)
 * @param {string} [checkpointsDir] - Directory to clean (defaults to .checkpoints)
 * @returns {number} Number of files cleaned up
 */
function cleanupStaleCheckpoints(checkpointsDir = null) {
  const dir = checkpointsDir || path.join(process.cwd(), '.checkpoints');

  if (!fs.existsSync(dir)) {
    return 0;
  }

  try {
    const fileInfos = CheckpointStorage.listFiles(dir).sort(
      (a, b) => new Date(b.mtime) - new Date(a.mtime)
    );

    let cleanedCount = 0;

    for (const info of fileInfos) {
      if (isExpired(info.timestamp)) {
        if (CheckpointStorage.deleteFile(info.filePath)) {
          cleanedCount++;
        }
      }
    }

    const remaining = fileInfos.filter((info) => fs.existsSync(info.filePath));
    if (remaining.length > MAX_CHECKPOINTS) {
      const toDelete = remaining.slice(MAX_CHECKPOINTS);
      for (const info of toDelete) {
        if (CheckpointStorage.deleteFile(info.filePath)) {
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} stale checkpoint(s)`);
    }

    return cleanedCount;
  } catch (error) {
    logger.warn(`Checkpoint cleanup failed: ${error.message}`);
    return 0;
  }
}

/**
 * List all checkpoints for a wizard type
 * @param {string} wizardType - Type of wizard
 * @param {string} [checkpointsDir] - Directory to scan
 * @returns {Array<Object>} Array of checkpoint data objects
 */
function listCheckpoints(wizardType, checkpointsDir = null) {
  const dir = checkpointsDir || path.join(process.cwd(), '.checkpoints');
  const pattern = `${wizardType}-`;

  try {
    const files = CheckpointStorage.listFiles(dir, pattern);
    return files.filter((f) => f.data !== null).map((f) => f.data);
  } catch (error) {
    logger.warn(`Failed to list checkpoints: ${error.message}`);
    return [];
  }
}

module.exports = {
  getAge,
  isExpired,
  getTTLConfig,
  cleanupStaleCheckpoints,
  listCheckpoints,
  CHECKPOINT_TTL_DAYS,
  CHECKPOINT_TTL_MS,
  MAX_CHECKPOINTS,
};
