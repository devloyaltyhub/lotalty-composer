/**
 * Version utilities for Shorebird CLI
 * Handles pubspec.yaml version management
 */

const fs = require('fs');
const { WHITE_LABEL_APP_ROOT } = require('../../../shared/utils/paths');
const path = require('path');

const PUBSPEC_PATH = path.join(WHITE_LABEL_APP_ROOT, 'pubspec.yaml');

/**
 * Get current version from pubspec.yaml
 * @returns {string|null} Current version or null if not found
 */
function getCurrentVersion() {
  const content = fs.readFileSync(PUBSPEC_PATH, 'utf8');
  const match = content.match(/^version:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Increment version in pubspec.yaml
 * @param {string} bumpType - 'build', 'patch', 'minor', or 'major'
 * @returns {object} - { oldVersion, newVersion }
 */
function incrementVersion(bumpType = 'build') {
  let pubspec = fs.readFileSync(PUBSPEC_PATH, 'utf8');

  const versionRegex = /^version:\s*([0-9]+)\.([0-9]+)\.([0-9]+)\+([0-9]+)/m;
  const match = pubspec.match(versionRegex);

  if (!match) {
    throw new Error('Versao nao encontrada no pubspec.yaml');
  }

  let [, major, minor, patch, build] = match.map((v, i) =>
    i > 0 ? parseInt(v, 10) : v
  );

  const oldVersion = `${major}.${minor}.${patch}+${build}`;

  switch (bumpType) {
    case 'major':
      major++;
      minor = 0;
      patch = 0;
      build = 1;
      break;
    case 'minor':
      minor++;
      patch = 0;
      build = 1;
      break;
    case 'patch':
      patch++;
      build = 1;
      break;
    case 'build':
    default:
      build++;
      break;
  }

  const newVersion = `${major}.${minor}.${patch}+${build}`;
  const newVersionLine = `version: ${newVersion}`;

  const updated = pubspec.replace(versionRegex, newVersionLine);
  fs.writeFileSync(PUBSPEC_PATH, updated, 'utf8');

  return { oldVersion, newVersion };
}

module.exports = {
  getCurrentVersion,
  incrementVersion,
};
