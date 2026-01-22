#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { logWarning, logInfo } = require('./console-logger');
const {
  SHARED_ASSETS_DIR: CENTRALIZED_SHARED_ASSETS_DIR,
} = require('../../utils/paths');

const SHARED_ASSETS_DIR = CENTRALIZED_SHARED_ASSETS_DIR;

const ASSET_REQUIREMENTS = {
  global: {
    shared_assets: {
      images: ['logo-horizontal-purple.png', 'card.png', 'money.png', 'pix.png'],
      animations: ['success_animation.json'],
      fonts: ['Sora/Sora-VariableFont_wght.ttf'],
    },
    white_label_assets: {
      images: [
        'logo-horizontal-purple.png',
        'card.png',
        'money.png',
        'pix.png',
        'vegan.png',
        'no-gluten.png',
        'no-lactose.png',
      ],
      animations: ['success_animation.json'],
      fonts: ['Sora/Sora-VariableFont_wght.ttf'],
    },
    client_specific_assets: ['logo.png', 'transparent-logo.png'],
  },
  business_types: {},
};

function getExistingBusinessTypes() {
  const businessTypes = [];

  try {
    const animationsDir = path.join(SHARED_ASSETS_DIR, 'animations');
    if (fs.existsSync(animationsDir)) {
      const items = fs.readdirSync(animationsDir, { withFileTypes: true });
      items.forEach((item) => {
        if (item.isDirectory() && !item.name.startsWith('.')) {
          businessTypes.push(item.name);
        }
      });
    }
  } catch (error) {
    logWarning(`Erro ao ler diretório de animations: ${error.message}`);
  }

  return businessTypes;
}

function loadBusinessTypeAssets(businessType) {
  const animationsDir = path.join(SHARED_ASSETS_DIR, 'animations', businessType);
  const imagesDir = path.join(SHARED_ASSETS_DIR, 'images', businessType);

  const assets = {
    shared_assets: {
      images: [],
      animations: [],
    },
    white_label_assets: {
      images: [],
      animations: [],
    },
  };

  if (fs.existsSync(animationsDir)) {
    try {
      const animFiles = fs
        .readdirSync(animationsDir)
        .filter((file) => file.endsWith('.json') && !file.startsWith('.'));
      assets.shared_assets.animations = animFiles.map((file) => `${businessType}/${file}`);
    } catch (error) {
      logWarning(`Erro ao ler animações de ${businessType}: ${error.message}`);
    }
  }

  if (fs.existsSync(imagesDir)) {
    try {
      const imageFiles = fs.readdirSync(imagesDir).filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.svg', '.webp'].includes(ext) && !file.startsWith('.');
      });
      assets.shared_assets.images = imageFiles.map((file) => `${businessType}/${file}`);
    } catch (error) {
      logWarning(`Erro ao ler imagens de ${businessType}: ${error.message}`);
    }
  }

  assets.white_label_assets.animations = [...assets.shared_assets.animations];
  assets.white_label_assets.images = [...assets.shared_assets.images];

  return assets;
}

function initializeBusinessTypes() {
  const discoveredTypes = getExistingBusinessTypes();

  discoveredTypes.forEach((businessType) => {
    if (!ASSET_REQUIREMENTS.business_types[businessType]) {
      ASSET_REQUIREMENTS.business_types[businessType] = loadBusinessTypeAssets(businessType);
      logInfo(`Dinamicamente carregado business type: ${businessType}`);
    }
  });
}

module.exports = {
  ASSET_REQUIREMENTS,
  getExistingBusinessTypes,
  loadBusinessTypeAssets,
  initializeBusinessTypes,
};
