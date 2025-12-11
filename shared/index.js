/**
 * Shared Module - Barrel Export
 * Common utilities, validators, and assets
 */

const utils = require('./utils');
const validators = require('./validators');

module.exports = {
  utils,
  validators,
  // Re-export commonly used items at top level
  logger: utils.logger,
  errorHandler: utils.errorHandler,
  ValidationError: utils.ValidationError,
  GitError: utils.GitError,
  FirebaseError: utils.FirebaseError,
};
