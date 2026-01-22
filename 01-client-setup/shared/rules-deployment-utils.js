const fs = require('fs');
const path = require('path');
const { exec } = require('./firebase-cli-utils');

/**
 * Validate that a Firestore rules file exists and contains essential rules.
 * @param {string} rulesFilePath - Absolute path to the firestore.rules file
 * @returns {{ valid: boolean, warnings: string[], stats: { size: number, lines: number } }}
 */
function validateRulesFile(rulesFilePath) {
  if (!fs.existsSync(rulesFilePath)) {
    return {
      valid: false,
      warnings: [`Rules file not found: ${rulesFilePath}`],
      stats: null,
    };
  }

  const rulesContent = fs.readFileSync(rulesFilePath, 'utf8');

  const checks = [
    { pattern: /match \/clients\/{clientId}/, name: 'Clients collection rule' },
    { pattern: /match \/admin_users\/{userId}/, name: 'Admin users collection rule' },
    { pattern: /request\.auth != null/, name: 'Authentication checks' },
  ];

  const warnings = [];
  for (const check of checks) {
    if (!check.pattern.test(rulesContent)) {
      warnings.push(`Missing: ${check.name}`);
    }
  }

  const fileStats = fs.statSync(rulesFilePath);
  const lines = rulesContent.split('\n').length;

  return {
    valid: true,
    warnings,
    stats: {
      size: fileStats.size,
      lines,
    },
  };
}

/**
 * Get a preview of the rules file (first N lines).
 * @param {string} rulesFilePath - Absolute path to the firestore.rules file
 * @param {number} lineCount - Number of lines to preview (default: 20)
 * @returns {string[]} Array of lines
 */
function getRulesPreview(rulesFilePath, lineCount = 20) {
  const rulesContent = fs.readFileSync(rulesFilePath, 'utf8');
  return rulesContent.split('\n').slice(0, lineCount);
}

/**
 * Deploy Firestore security rules to a Firebase project.
 * @param {string} projectId - Firebase project ID
 * @param {string} rulesFilePath - Absolute path to the firestore.rules file
 * @param {boolean} dryRun - If true, validate only without deploying
 * @returns {{ success: boolean, error: string|null }}
 */
function deployRules(projectId, rulesFilePath, dryRun = false) {
  const workingDir = path.dirname(rulesFilePath);

  try {
    if (dryRun) {
      return { success: true, error: null };
    }

    const command = `cd "${workingDir}" && firebase deploy --only firestore:rules --project ${projectId}`;
    exec(command);

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create an audit log entry for a rules deployment.
 * @param {string} logDir - Directory to store the log file
 * @param {string} logFile - Full path to the log file
 * @param {object} data - Deployment data
 * @param {string} data.project - Firebase project ID
 * @param {string} data.rulesFile - Path to rules file
 * @param {boolean} data.dryRun - Whether this was a dry run
 * @param {boolean} data.success - Whether deployment succeeded
 * @returns {{ success: boolean, error: string|null }}
 */
function createAuditLog(logDir, logFile, data) {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    project: data.project,
    rulesFile: data.rulesFile,
    action: data.dryRun ? 'DRY_RUN' : 'DEPLOY',
    success: data.success,
    user: process.env.USER || 'unknown',
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    fs.appendFileSync(logFile, logLine);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  validateRulesFile,
  getRulesPreview,
  deployRules,
  createAuditLog,
};
