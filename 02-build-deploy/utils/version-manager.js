const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');

const JSON_INDENT_SPACES = 2;

class VersionManager {
  constructor(repoPath) {
    this.repoPath = repoPath;
  }

  loadClientConfig() {
    const configPath = path.join(this.repoPath, 'white_label_app', 'config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error(`Client config not found: ${configPath}. Run white-label setup first.`);
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  saveClientConfig(config) {
    const configPath = path.join(this.repoPath, 'white_label_app', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, JSON_INDENT_SPACES), 'utf8');
  }

  getVersionInfo() {
    const pubspecPath = path.join(this.repoPath, 'white_label_app', 'pubspec.yaml');
    const pubspec = fs.readFileSync(pubspecPath, 'utf8');
    const versionRegex = /^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)/m;
    const match = pubspec.match(versionRegex);

    if (!match) {
      throw new Error('Version not found in pubspec.yaml. Expected format: version: X.Y.Z+BUILD');
    }

    const version = match[1];
    const buildNumber = parseInt(match[2], 10);
    return { version, buildNumber };
  }

  setVersion(version, execFn) {
    const versionRegex = /^([0-9]+)\.([0-9]+)\.([0-9]+)\+([0-9]+)$/;
    const match = version.match(versionRegex);

    if (!match) {
      throw new Error(
        `Formato de versao invalido: "${version}". Use o formato X.Y.Z+B (ex: 1.2.3+45)`
      );
    }

    logger.startSpinner(`Setting version to ${version}...`);
    try {
      const pubspecPath = path.join(this.repoPath, 'white_label_app', 'pubspec.yaml');
      let pubspec = fs.readFileSync(pubspecPath, 'utf8');

      const pubspecVersionRegex = /^version:\s*[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+/m;
      if (!pubspecVersionRegex.test(pubspec)) {
        throw new Error('Version line not found in pubspec.yaml');
      }

      pubspec = pubspec.replace(pubspecVersionRegex, `version: ${version}`);
      fs.writeFileSync(pubspecPath, pubspec, 'utf8');

      execFn('git add white_label_app/pubspec.yaml', { silent: true });

      logger.succeedSpinner(`Version set to ${version}`);
      return true;
    } catch (error) {
      logger.failSpinner(`Failed to set version: ${error.message}`);
      throw error;
    }
  }
}

module.exports = VersionManager;
