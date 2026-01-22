#!/usr/bin/env node

/**
 * Generate Screenshots CLI
 *
 * Standalone script to generate app store screenshots for a client.
 * Uses the Python screenshot pipeline for capture and mockup generation.
 *
 * IMPORTANT: White label must be configured BEFORE running this script.
 * Run 'npm run start' to configure the client first.
 *
 * Usage:
 *   node generate-screenshots.js
 *   node generate-screenshots.js --client=demo
 *
 * This file is a thin wrapper that delegates to the modular implementation
 * in ./generate-screenshots/ for better maintainability.
 */

const { ScreenshotGenerator, checkExistingScreenshots } = require('./generate-screenshots/index');

module.exports = { ScreenshotGenerator, checkExistingScreenshots };

if (require.main === module) {
  require('./generate-screenshots/index');
}
