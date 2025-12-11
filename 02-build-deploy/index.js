/**
 * Build & Deploy Module - Barrel Export
 * Phase 02: Build, Fastlane, Screenshots
 *
 * Note: Scripts are exported as paths only (not required)
 * because they execute code at module level
 */

const path = require('path');

// Script paths (for CLI execution - not required directly)
const scripts = {
  buildClient: path.join(__dirname, 'build-client.js'),
  incrementVersion: path.join(__dirname, 'increment-version.js'),
  changeBundleId: path.join(__dirname, 'change-bundle-id.sh'),
  cleanProject: path.join(__dirname, 'clean-project.sh'),
};

// Directories
const dirs = {
  fastlane: path.join(__dirname, 'fastlane'),
  screenshots: path.join(__dirname, 'screenshots'),
  metadataTemplates: path.join(__dirname, 'metadata_templates'),
};

module.exports = {
  scripts,
  dirs,
};
