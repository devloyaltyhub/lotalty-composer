#!/usr/bin/env node

/**
 * Generate Screenshots Admin CLI
 *
 * Capture screenshots from Android devices (phone + tablet) for
 * loyalty-admin-main Google Play Store listing.
 *
 * This file re-exports from the modular implementation.
 * See ./generate-screenshots-admin/ for the implementation.
 */

const { AdminScreenshotGenerator } = require('./generate-screenshots-admin/index');

module.exports = { AdminScreenshotGenerator };

if (require.main === module) {
  require('./generate-screenshots-admin/index');
}
