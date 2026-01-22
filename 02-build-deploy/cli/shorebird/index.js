/**
 * Shorebird module exports
 */

const { log } = require('./log-utils');
const { isShorebirdInstalled, isShorebirdConfigured, runShorebird } = require('./shorebird-runner');
const { getCurrentVersion, incrementVersion } = require('./version-utils');
const { createPrompt, ask, showMenu, getPlatform, waitForEnter } = require('./prompt-utils');
const { createRelease, createPatch, openConsole, runDoctor, showHelp } = require('./commands');

module.exports = {
  log,
  isShorebirdInstalled,
  isShorebirdConfigured,
  runShorebird,
  getCurrentVersion,
  incrementVersion,
  createPrompt,
  ask,
  showMenu,
  getPlatform,
  waitForEnter,
  createRelease,
  createPatch,
  openConsole,
  runDoctor,
  showHelp,
};
