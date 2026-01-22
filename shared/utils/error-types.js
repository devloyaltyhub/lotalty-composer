/**
 * Error Types for Automation System
 * Standardized error classes for consistent error handling
 */

/**
 * Base error class for all automation errors
 */
class AutomationError extends Error {
  constructor(message, code = 'AUTOMATION_ERROR', metadata = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      metadata: this.metadata,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Validation error for invalid input
 */
class ValidationError extends AutomationError {
  constructor(message, field = null, metadata = {}) {
    super(message, 'VALIDATION_ERROR', { field, ...metadata });
  }
}

/**
 * Firebase operation error
 */
class FirebaseError extends AutomationError {
  constructor(message, operation = null, metadata = {}) {
    super(message, 'FIREBASE_ERROR', { operation, ...metadata });
  }
}

/**
 * Git operation error
 */
class GitError extends AutomationError {
  constructor(message, command = null, metadata = {}) {
    super(message, 'GIT_ERROR', { command, ...metadata });
  }
}

/**
 * File system operation error
 */
class FileSystemError extends AutomationError {
  constructor(message, path = null, metadata = {}) {
    super(message, 'FILESYSTEM_ERROR', { path, ...metadata });
  }
}

/**
 * External command execution error
 */
class CommandError extends AutomationError {
  constructor(message, command = null, exitCode = null, metadata = {}) {
    super(message, 'COMMAND_ERROR', { command, exitCode, ...metadata });
  }
}

/**
 * Configuration error
 */
class ConfigurationError extends AutomationError {
  constructor(message, key = null, metadata = {}) {
    super(message, 'CONFIGURATION_ERROR', { key, ...metadata });
  }
}

/**
 * Network or external service error
 */
class ExternalServiceError extends AutomationError {
  constructor(message, service = null, metadata = {}) {
    super(message, 'EXTERNAL_SERVICE_ERROR', { service, ...metadata });
  }
}

/**
 * Timeout error
 */
class TimeoutError extends AutomationError {
  constructor(message, operation = null, timeout = null, metadata = {}) {
    super(message, 'TIMEOUT_ERROR', { operation, timeout, ...metadata });
  }
}

/**
 * Rollback error
 */
class RollbackError extends AutomationError {
  constructor(message, step = null, metadata = {}) {
    super(message, 'ROLLBACK_ERROR', { step, ...metadata });
  }
}

module.exports = {
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
};
