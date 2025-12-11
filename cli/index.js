/**
 * CLI Module - Barrel Export
 * Entry point for all CLI-related functionality
 */

const { CATEGORIES } = require('./constants');
const { SCRIPTS, WORKFLOWS } = require('./config');
const {
  ConfigManager,
  WorkflowEngine,
  CommandRunner,
  MenuRenderer,
  LoyaltyCLI,
} = require('./classes');

module.exports = {
  // Constants
  CATEGORIES,

  // Configuration
  SCRIPTS,
  WORKFLOWS,

  // Classes
  ConfigManager,
  WorkflowEngine,
  CommandRunner,
  MenuRenderer,
  LoyaltyCLI,
};
