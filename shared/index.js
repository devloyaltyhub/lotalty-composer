/**
 * Shared Module - Barrel Export
 * Common utilities, validators, and assets
 */

const utils = require('./utils');
const validators = require('./validators');
const constants = require('./constants');

module.exports = {
  utils,
  validators,
  constants,
  // Re-export commonly used items at top level
  logger: utils.logger,
  errorHandler: utils.errorHandler,
  ValidationError: utils.ValidationError,
  GitError: utils.GitError,
  FirebaseError: utils.FirebaseError,
  // Plan constants at top level for convenience
  PLAN_TYPES: constants.PLAN_TYPES,
  PLANS: constants.PLANS,
  getPlanById: constants.getPlanById,
};
