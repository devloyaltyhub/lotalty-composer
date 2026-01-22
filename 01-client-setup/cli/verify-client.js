#!/usr/bin/env node

/**
 * Client Health Check Script
 *
 * This file re-exports from the modular implementation.
 * See ./verify-client/ for the implementation.
 */

module.exports = require('./verify-client/index');

if (require.main === module) {
  require('./verify-client/index');
}
