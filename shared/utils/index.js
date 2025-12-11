/**
 * Shared Utils - Barrel Export
 * Entry point for all shared utilities
 */

const logger = require('./logger');
const errorHandler = require('./error-handler');
const telegram = require('./telegram');
const clientSelector = require('./client-selector');
const checkpointManager = require('./checkpoint-manager');
const resourceTracker = require('./resource-tracker');
const preflightCheck = require('./preflight-check');
const paths = require('./paths');

// Re-export error classes from error-handler
const {
  ErrorHandler,
  AutomationError,
  ValidationError,
  FirebaseError,
  GitError,
  FileSystemError,
  CommandError,
  ConfigurationError,
  ExternalServiceError,
  TimeoutError,
  RollbackError,
} = require('./error-handler');

module.exports = {
  // Logger
  logger,

  // Error handling
  errorHandler,
  ErrorHandler,
  AutomationError,
  ValidationError,
  FirebaseError,
  GitError,
  FileSystemError,
  CommandError,
  ConfigurationError,
  ExternalServiceError,
  TimeoutError,
  RollbackError,

  // Notifications
  telegram,

  // Utilities
  clientSelector,
  checkpointManager,
  resourceTracker,
  preflightCheck,

  // Path configuration
  paths,
};
