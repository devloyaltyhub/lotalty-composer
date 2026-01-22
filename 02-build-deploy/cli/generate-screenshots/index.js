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
 */

const path = require('path');
const { COMPOSE_ROOT, LOYALTY_APP_ROOT } = require('../../../shared/utils/paths');

require('dotenv').config({ path: path.join(COMPOSE_ROOT, '.env') });

const logger = require('../../../shared/utils/logger');
const ScreenshotGenerator = require('./screenshot-generator');
const { checkExistingScreenshots } = require('./screenshot-checker');
const {
  promptRegenerateConfirmation,
  promptClientSelection,
  promptPipelineOptions,
  parseArgs,
  showHelp,
} = require('./prompts');

/**
 * Main function
 */
async function main() {
  try {
    const args = parseArgs();

    if (args.help) {
      showHelp();
      process.exit(0);
    }

    logger.section('Screenshot Generator');
    logger.blank();

    const existingCheck = checkExistingScreenshots();

    if (existingCheck.exists) {
      const shouldRegenerate = await promptRegenerateConfirmation(existingCheck);

      if (!shouldRegenerate) {
        logger.success('Pulando geracao de screenshots. Screenshots existentes mantidos.');
        process.exit(0);
      }

      logger.blank();
    }

    let clientCode = args.clientCode;

    if (!clientCode) {
      clientCode = await promptClientSelection();
    }

    const pipelineOptions = await promptPipelineOptions();

    const generator = new ScreenshotGenerator(clientCode, LOYALTY_APP_ROOT);
    const result = await generator.generate(pipelineOptions);

    if (result.success) {
      logger.success('Screenshots gerados com sucesso!');
      process.exit(0);
    } else {
      logger.error(`Falha: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { ScreenshotGenerator, checkExistingScreenshots };

if (require.main === module) {
  main();
}
