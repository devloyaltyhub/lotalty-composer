#!/usr/bin/env node

const path = require('path');
const { logInfo } = require('./console-logger');
const { fileExists, verifyFileIntegrity } = require('./file-utils');
const { ASSET_REQUIREMENTS } = require('./asset-requirements');
const {
  SHARED_ASSETS_DIR: CENTRALIZED_SHARED_ASSETS_DIR,
  WHITE_LABEL_ASSETS_DIR: CENTRALIZED_WHITE_LABEL_ASSETS_DIR,
  WHITE_LABEL_CLIENT_ASSETS_DIR,
} = require('../../utils/paths');

const SHARED_ASSETS_DIR = CENTRALIZED_SHARED_ASSETS_DIR;
const WHITE_LABEL_ASSETS_DIR = CENTRALIZED_WHITE_LABEL_ASSETS_DIR;
const CLIENT_ASSETS_DIR = WHITE_LABEL_CLIENT_ASSETS_DIR;

function validateGlobalAssets(options = {}) {
  const errors = [];
  const warnings = [];
  const { checkIntegrity = false } = options;
  let processed = 0;

  logInfo('Validando assets globais...');

  const sharedRequirements = ASSET_REQUIREMENTS.global.shared_assets;

  sharedRequirements.images.forEach((imageName) => {
    processed++;
    const imagePath = path.join(SHARED_ASSETS_DIR, 'images', imageName);
    if (!fileExists(imagePath)) {
      errors.push(`Missing global shared image: ${imageName}`);
    }
  });

  sharedRequirements.animations.forEach((animationName) => {
    processed++;
    const animationPath = path.join(SHARED_ASSETS_DIR, 'animations', animationName);
    if (!fileExists(animationPath)) {
      errors.push(`Missing global shared animation: ${animationName}`);
    }
  });

  if (sharedRequirements.fonts) {
    sharedRequirements.fonts.forEach((fontPath) => {
      processed++;
      const fullPath = path.join(SHARED_ASSETS_DIR, 'fonts', fontPath);
      if (!fileExists(fullPath)) {
        errors.push(`Missing global shared font: ${fontPath}`);
      }
    });
  }

  const whiteLabelRequirements = ASSET_REQUIREMENTS.global.white_label_assets;

  whiteLabelRequirements.images.forEach((imageName) => {
    processed++;
    const imagePath = path.join(WHITE_LABEL_ASSETS_DIR, 'images', imageName);
    const sourcePath = path.join(SHARED_ASSETS_DIR, 'images', imageName);

    if (!fileExists(imagePath)) {
      errors.push(`Missing white label image: ${imageName}`);
    } else if (checkIntegrity && fileExists(sourcePath)) {
      const integrity = verifyFileIntegrity(sourcePath, imagePath);
      if (!integrity.valid) {
        errors.push(`White label image integrity failed for ${imageName}: ${integrity.reason}`);
      }
    }
  });

  whiteLabelRequirements.animations.forEach((animationName) => {
    processed++;
    const animationPath = path.join(WHITE_LABEL_ASSETS_DIR, 'animations', animationName);
    const sourcePath = path.join(SHARED_ASSETS_DIR, 'animations', animationName);

    if (!fileExists(animationPath)) {
      errors.push(`Missing white label animation: ${animationName}`);
    } else if (checkIntegrity && fileExists(sourcePath)) {
      const integrity = verifyFileIntegrity(sourcePath, animationPath);
      if (!integrity.valid) {
        errors.push(
          `White label animation integrity failed for ${animationName}: ${integrity.reason}`
        );
      }
    }
  });

  if (whiteLabelRequirements.fonts) {
    whiteLabelRequirements.fonts.forEach((fontPath) => {
      processed++;
      const fullPath = path.join(WHITE_LABEL_ASSETS_DIR, 'fonts', fontPath);
      const sourcePath = path.join(SHARED_ASSETS_DIR, 'fonts', fontPath);

      if (!fileExists(fullPath)) {
        errors.push(`Missing white label font: ${fontPath}`);
      } else if (checkIntegrity && fileExists(sourcePath)) {
        const integrity = verifyFileIntegrity(sourcePath, fullPath);
        if (!integrity.valid) {
          errors.push(`White label font integrity failed for ${fontPath}: ${integrity.reason}`);
        }
      }
    });
  }

  ASSET_REQUIREMENTS.global.client_specific_assets.forEach((assetName) => {
    processed++;
    const assetPath = path.join(CLIENT_ASSETS_DIR, assetName);
    if (!fileExists(assetPath)) {
      warnings.push(`Missing client specific asset: ${assetName}`);
    }
  });

  return { errors, warnings, processed };
}

module.exports = {
  validateGlobalAssets,
};
