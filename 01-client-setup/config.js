/**
 * Configuration constants for client setup automation
 * All hardcoded values centralized here for easy maintenance
 */

// Byte conversion constants
const BYTES_PER_KB = 1024; // eslint-disable-line no-magic-numbers
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;

// File size limits (in MB)
const MAX_BACKUP_SIZE_MB = 100;
const MAX_LOG_FILE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_MB = 5;

module.exports = {
  // Firebase Configuration
  firebase: {
    maxConnections: 10,
    connectionTimeout: 30000, // 30 seconds
    initializationTimeout: 60000, // 60 seconds
    apiTimeout: 30000, // 30 seconds for API calls
  },

  // Keystore Configuration
  keystore: {
    keysize: 2048,
    validity: 10000, // days
    algorithm: 'RSA',
    passwordLength: 32, // Strong password length
  },

  // Git Configuration
  git: {
    maxRetries: 3,
    retryDelay: 2000, // 2 seconds
    timeout: 60000, // 60 seconds
  },

  // File Operations
  fileOperations: {
    backupRetention: 7, // days
    maxBackupSize: MAX_BACKUP_SIZE_MB * BYTES_PER_MB,
    permissions: {
      keystore: 0o600, // Owner read/write only
      credentials: 0o600,
      config: 0o644, // Owner read/write, others read
    },
  },

  // Validation Patterns
  validation: {
    clientCode: /^[a-z0-9-]{3,50}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    bundleId: /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i,
    hexColor: /^#?[0-9A-Fa-f]{6,8}$/,
    businessTypeKey: /^[a-z][a-z0-9_]*$/i,
    appleTeamId: /^[A-Z0-9]{10}$/,
    pathSafe: /^[a-zA-Z0-9_-]+$/,
  },

  // External Tool Versions
  minVersions: {
    node: '14.0.0',
    flutter: '3.0.0',
    firebaseCli: '11.0.0',
  },

  // Progress Indicators
  progress: {
    enabled: true,
    format: 'progress',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxFiles: 5,
    maxFileSize: MAX_LOG_FILE_SIZE_MB * BYTES_PER_MB,
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
  },

  // iOS Configuration
  ios: {
    requiredEnvVars: ['MATCH_GIT_URL', 'MATCH_PASSWORD', 'APPLE_TEAM_ID', 'FASTLANE_USER'],
  },

  // Asset Processing
  assets: {
    maxImageSize: MAX_IMAGE_SIZE_MB * BYTES_PER_MB,
    supportedFormats: ['png', 'jpg', 'jpeg', 'svg'],
    compressionQuality: 0.8,
  },

  // Timeouts for Long Operations
  timeouts: {
    podInstall: 300000, // 5 minutes
    imageCompression: 120000, // 2 minutes
    buildValidation: 180000, // 3 minutes
  },
};
