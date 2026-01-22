const fs = require('fs');
const path = require('path');
const logger = require('../../../shared/utils/logger');
const { exec } = require('./exec-utils');

async function downloadAndroidConfig(projectId, outputPath) {
  logger.startSpinner('Downloading google-services.json...');

  try {
    const appsJson = exec(`firebase apps:list android --project ${projectId} --json`);
    const apps = JSON.parse(appsJson);

    if (!apps.result || apps.result.length === 0) {
      throw new Error('No Android app found');
    }

    const appId = apps.result[0].appId;
    const config = exec(`firebase apps:sdkconfig android ${appId} --project ${projectId}`);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, config);

    logger.succeedSpinner(`google-services.json saved to ${outputPath}`);
    return true;
  } catch (error) {
    logger.failSpinner('Failed to download Android config');
    throw error;
  }
}

async function downloadIosConfig(projectId, outputPath) {
  logger.startSpinner('Downloading GoogleService-Info.plist...');

  try {
    const appsJson = exec(`firebase apps:list ios --project ${projectId} --json`);
    const apps = JSON.parse(appsJson);

    if (!apps.result || apps.result.length === 0) {
      logger.warn('No iOS app found, skipping iOS config download');
      return false;
    }

    const appId = apps.result[0].appId;
    const config = exec(`firebase apps:sdkconfig ios ${appId} --project ${projectId}`);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, config);

    logger.succeedSpinner(`GoogleService-Info.plist saved to ${outputPath}`);
    return true;
  } catch (error) {
    logger.warn('Failed to download iOS config, continuing without it...');
    return false;
  }
}

async function generateFlutterFireOptions(projectId, clientFolder) {
  logger.startSpinner('Generating firebase_options.dart...');

  try {
    const flutterAppRoot = path.join(__dirname, '../../../../loyalty-app/white_label_app');

    const pubspecPath = path.join(flutterAppRoot, 'pubspec.yaml');
    if (!fs.existsSync(pubspecPath)) {
      throw new Error(`Flutter app not found at: ${flutterAppRoot}`);
    }

    const optionsPath = path.join(flutterAppRoot, 'lib', 'firebase_options.dart');

    exec(`flutterfire configure --project=${projectId} --out=lib/firebase_options.dart --yes`, {
      cwd: flutterAppRoot,
      timeout: 180000,
    });

    if (!fs.existsSync(optionsPath)) {
      throw new Error('firebase_options.dart was not generated');
    }

    const clientOptionsPath = path.join(clientFolder, 'lib', 'firebase_options.dart');
    const clientLibDir = path.dirname(clientOptionsPath);
    if (!fs.existsSync(clientLibDir)) {
      fs.mkdirSync(clientLibDir, { recursive: true });
    }
    fs.copyFileSync(optionsPath, clientOptionsPath);

    logger.succeedSpinner('firebase_options.dart generated successfully');
    return optionsPath;
  } catch (error) {
    logger.failSpinner('Failed to generate firebase_options.dart');
    throw error;
  }
}

module.exports = {
  downloadAndroidConfig,
  downloadIosConfig,
  generateFlutterFireOptions,
};
