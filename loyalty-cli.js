#!/usr/bin/env node

/**
 * Loyalty Hub - CLI de Automação
 * Entry point for the interactive CLI
 */

const { LoyaltyCLI } = require('./cli');

// Start the CLI application
const cli = new LoyaltyCLI();
cli.run();
