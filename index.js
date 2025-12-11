/**
 * Automation Module - Main Barrel Export
 * Entry point for all automation functionality
 *
 * Usage:
 *   const automation = require('./automation');
 *   automation.cli.LoyaltyCLI
 *   automation.clientSetup.firebaseManager
 *   automation.shared.logger
 */

const cli = require('./cli');
const clientSetup = require('./01-client-setup');
const buildDeploy = require('./02-build-deploy');
const shared = require('./shared');

module.exports = {
  // CLI Engine
  cli,

  // Phase 01: Client Setup
  clientSetup,

  // Phase 02: Build & Deploy
  buildDeploy,

  // Shared utilities
  shared,

  // Convenience re-exports
  logger: shared.logger,
  errorHandler: shared.errorHandler,
};
