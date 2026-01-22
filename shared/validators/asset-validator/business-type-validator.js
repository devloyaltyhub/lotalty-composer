#!/usr/bin/env node

const path = require('path');
const { logInfo } = require('./console-logger');
const { fileExists, verifyFileIntegrity } = require('./file-utils');
const { ASSET_REQUIREMENTS } = require('./asset-requirements');
const {
  SHARED_ASSETS_DIR: CENTRALIZED_SHARED_ASSETS_DIR,
  WHITE_LABEL_ASSETS_DIR: CENTRALIZED_WHITE_LABEL_ASSETS_DIR,
} = require('../../utils/paths');

const SHARED_ASSETS_DIR = CENTRALIZED_SHARED_ASSETS_DIR;
const WHITE_LABEL_ASSETS_DIR = CENTRALIZED_WHITE_LABEL_ASSETS_DIR;

function validateBusinessTypeAssets(businessType, options = {}) {
  const errors = [];
  const warnings = [];
  const { checkIntegrity = false } = options;
  let processed = 0;

  logInfo(`Validando assets para business type: ${businessType}`);

  const requirements = ASSET_REQUIREMENTS.business_types[businessType];

  if (!requirements) {
    warnings.push(`No asset requirements defined for business type: ${businessType}`);
    return { errors, warnings, processed };
  }

  if (requirements.shared_assets) {
    if (requirements.shared_assets.images) {
      requirements.shared_assets.images.forEach((imageName) => {
        processed++;
        const imagePath = path.join(SHARED_ASSETS_DIR, 'images', imageName);
        if (!fileExists(imagePath)) {
          errors.push(`Missing shared image for ${businessType}: ${imageName}`);
        }
      });
    }

    if (requirements.shared_assets.animations) {
      requirements.shared_assets.animations.forEach((animationName) => {
        processed++;
        const animationPath = path.join(SHARED_ASSETS_DIR, 'animations', animationName);
        if (!fileExists(animationPath)) {
          errors.push(`Missing shared animation for ${businessType}: ${animationName}`);
        }
      });
    }
  }

  if (requirements.white_label_assets) {
    if (requirements.white_label_assets.images) {
      requirements.white_label_assets.images.forEach((imageName) => {
        processed++;
        const imagePath = path.join(WHITE_LABEL_ASSETS_DIR, 'images', imageName);
        const sourcePath = path.join(SHARED_ASSETS_DIR, 'images', imageName);

        if (!fileExists(imagePath)) {
          errors.push(`Missing white label image for ${businessType}: ${imageName}`);
        } else if (checkIntegrity && fileExists(sourcePath)) {
          const integrity = verifyFileIntegrity(sourcePath, imagePath);
          if (!integrity.valid) {
            errors.push(
              `White label image integrity failed for ${businessType} ${imageName}: ${integrity.reason}`
            );
          }
        }
      });
    }

    if (requirements.white_label_assets.animations) {
      requirements.white_label_assets.animations.forEach((animationName) => {
        processed++;
        const animationPath = path.join(WHITE_LABEL_ASSETS_DIR, 'animations', animationName);
        const sourcePath = path.join(SHARED_ASSETS_DIR, 'animations', animationName);

        if (!fileExists(animationPath)) {
          errors.push(`Missing white label animation for ${businessType}: ${animationName}`);
        } else if (checkIntegrity && fileExists(sourcePath)) {
          const integrity = verifyFileIntegrity(sourcePath, animationPath);
          if (!integrity.valid) {
            errors.push(
              `White label animation integrity failed for ${businessType} ${animationName}: ${integrity.reason}`
            );
          }
        }
      });
    }
  }

  return { errors, warnings, processed };
}

module.exports = {
  validateBusinessTypeAssets,
};
