#!/usr/bin/env node

const fs = require('fs');
const { validateAssets } = require('./index');
const { logInfo, logWarning } = require('./console-logger');
const { WHITE_LABEL_CONFIG } = require('../../utils/paths');

function showHelp() {
  console.log(`
Asset Validation Tool

Usage: node validate-assets.js [options]

Options:
  -t, --business-type <type>  Validate assets for specific business type only
                              (auto-detects from white_label_app/config.json if not specified)
  -s, --strict               Treat warnings as errors
  -i, --check-integrity      Verify file integrity (size and hash)
  -c, --auto-copy           Automatically copy missing assets from shared_assets
  -d, --dry-run             Show what would be copied without actually copying
  -h, --help                Show this help message

Examples:
  node validate-assets.js                    # Auto-detect and validate (uses white_label_app config)
  node validate-assets.js -t coffee          # Validate only coffee assets
  node validate-assets.js --strict           # Strict mode (warnings = errors)
  node validate-assets.js -i                 # Check file integrity
  node validate-assets.js -c                 # Auto-copy missing assets
  node validate-assets.js -c -d              # Dry run of auto-copy
  `);
}

function parseArgs(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--business-type' || arg === '-t') {
      options.businessType = args[++i];
    } else if (arg === '--strict' || arg === '-s') {
      options.strict = true;
    } else if (arg === '--check-integrity' || arg === '-i') {
      options.checkIntegrity = true;
    } else if (arg === '--auto-copy' || arg === '-c') {
      options.autoCopy = true;
    } else if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }

  return options;
}

function autoDetectBusinessType(options) {
  if (!options.businessType && fs.existsSync(WHITE_LABEL_CONFIG)) {
    try {
      const whiteLabelConfig = JSON.parse(fs.readFileSync(WHITE_LABEL_CONFIG, 'utf8'));
      if (whiteLabelConfig.businessType) {
        options.businessType = whiteLabelConfig.businessType;
        logInfo(`Auto-detected business type from white_label_app config: ${options.businessType}`);
      }
    } catch (error) {
      logWarning(`Could not read white_label_app/config.json: ${error.message}`);
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  autoDetectBusinessType(options);

  const exitCode = validateAssets(options);
  process.exit(exitCode);
}

if (require.main === module) {
  main();
}

module.exports = { main, parseArgs };
