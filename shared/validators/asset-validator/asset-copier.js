#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { log, logInfo, logSuccess, logWarning, logError } = require('./console-logger');
const { fileExists } = require('./file-utils');
const { ASSET_REQUIREMENTS, getExistingBusinessTypes } = require('./asset-requirements');
const {
  SHARED_ASSETS_DIR: CENTRALIZED_SHARED_ASSETS_DIR,
  WHITE_LABEL_ASSETS_DIR: CENTRALIZED_WHITE_LABEL_ASSETS_DIR,
} = require('../../utils/paths');

const SHARED_ASSETS_DIR = CENTRALIZED_SHARED_ASSETS_DIR;
const WHITE_LABEL_ASSETS_DIR = CENTRALIZED_WHITE_LABEL_ASSETS_DIR;

function copyFile(sourcePath, destPath, options = {}) {
  const { dryRun = false, copiedFiles = [], errors = [] } = options;

  try {
    if (!fileExists(sourcePath)) {
      errors.push(`Arquivo fonte não encontrado: ${sourcePath}`);
      return false;
    }

    if (fileExists(destPath)) {
      logWarning(`Arquivo já existe, sobrescrevendo: ${path.relative('.', destPath)}`);
    }

    if (!dryRun) {
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        log(`Diretório criado: ${path.relative('.', destDir)}`, 'cyan');
      }

      const sourceStats = fs.statSync(sourcePath);
      const sourceSize = (sourceStats.size / 1024).toFixed(2);

      fs.copyFileSync(sourcePath, destPath);

      const destStats = fs.statSync(destPath);
      if (sourceStats.size === destStats.size) {
        logSuccess(`Copiado: ${path.relative('.', destPath)} (${sourceSize} KB)`);
      } else {
        errors.push(`Erro na cópia: tamanhos diferentes para ${destPath}`);
        return false;
      }
    } else {
      log(
        `[DRY RUN] Copiaria: ${path.relative('.', sourcePath)} → ${path.relative('.', destPath)}`,
        'cyan'
      );
    }

    copiedFiles.push({ source: sourcePath, dest: destPath });
    return true;
  } catch (error) {
    errors.push(`Erro ao copiar ${sourcePath} para ${destPath}: ${error.message}`);
    return false;
  }
}

function copyGlobalAssets(options = {}) {
  const { dryRun = false, copiedFiles = [], errors = [] } = options;
  let skippedCount = 0;

  const globalRequirements = ASSET_REQUIREMENTS.global.white_label_assets;

  globalRequirements.images.forEach((imageName) => {
    const sourcePath = path.join(SHARED_ASSETS_DIR, 'images', imageName);
    const destPath = path.join(WHITE_LABEL_ASSETS_DIR, 'images', imageName);

    if (!fileExists(destPath) && fileExists(sourcePath)) {
      copyFile(sourcePath, destPath, { dryRun, copiedFiles, errors });
    } else if (!fileExists(sourcePath)) {
      skippedCount++;
    }
  });

  globalRequirements.animations.forEach((animationName) => {
    const sourcePath = path.join(SHARED_ASSETS_DIR, 'animations', animationName);
    const destPath = path.join(WHITE_LABEL_ASSETS_DIR, 'animations', animationName);

    if (!fileExists(destPath) && fileExists(sourcePath)) {
      copyFile(sourcePath, destPath, { dryRun, copiedFiles, errors });
    } else if (!fileExists(sourcePath)) {
      skippedCount++;
    }
  });

  if (globalRequirements.fonts) {
    globalRequirements.fonts.forEach((fontPath) => {
      const sourcePath = path.join(SHARED_ASSETS_DIR, 'fonts', fontPath);
      const destPath = path.join(WHITE_LABEL_ASSETS_DIR, 'fonts', fontPath);

      if (!fileExists(destPath) && fileExists(sourcePath)) {
        copyFile(sourcePath, destPath, { dryRun, copiedFiles, errors });
      } else if (!fileExists(sourcePath)) {
        skippedCount++;
      }
    });
  }

  return skippedCount;
}

function copyBusinessTypeAssets(businessTypes, options = {}) {
  const { dryRun = false, copiedFiles = [], errors = [] } = options;

  businessTypes.forEach((type) => {
    const requirements = ASSET_REQUIREMENTS.business_types[type];

    if (requirements && requirements.white_label_assets) {
      if (requirements.white_label_assets.images) {
        requirements.white_label_assets.images.forEach((imageName) => {
          const sourcePath = path.join(SHARED_ASSETS_DIR, 'images', imageName);
          const destPath = path.join(WHITE_LABEL_ASSETS_DIR, 'images', imageName);

          if (!fileExists(destPath) && fileExists(sourcePath)) {
            copyFile(sourcePath, destPath, { dryRun, copiedFiles, errors });
          }
        });
      }

      if (requirements.white_label_assets.animations) {
        requirements.white_label_assets.animations.forEach((animationName) => {
          const sourcePath = path.join(SHARED_ASSETS_DIR, 'animations', animationName);
          const destPath = path.join(WHITE_LABEL_ASSETS_DIR, 'animations', animationName);

          if (!fileExists(destPath) && fileExists(sourcePath)) {
            copyFile(sourcePath, destPath, { dryRun, copiedFiles, errors });
          }
        });
      }
    }
  });
}

function copyMissingAssets(options = {}) {
  const { dryRun = false, businessType = null } = options;
  const copiedFiles = [];
  const errors = [];

  logInfo(dryRun ? 'Simulando cópia de assets faltantes...' : 'Copiando assets faltantes...');

  const copyOptions = { dryRun, copiedFiles, errors };

  const skippedCount = copyGlobalAssets(copyOptions);
  const businessTypes = businessType ? [businessType] : getExistingBusinessTypes();
  copyBusinessTypeAssets(businessTypes, copyOptions);

  if (copiedFiles.length > 0 || errors.length > 0 || skippedCount > 0) {
    log('\nResumo da cópia automática:', 'cyan');
    if (copiedFiles.length > 0) {
      logSuccess(
        `Arquivos ${dryRun ? 'que seriam copiados' : 'copiados com sucesso'}: ${copiedFiles.length}`
      );
    }
    if (skippedCount > 0) {
      logWarning(`Arquivos ignorados (fonte não encontrada): ${skippedCount}`);
    }
    if (errors.length > 0) {
      logError(`Erros durante a cópia: ${errors.length}`);
    }
    log(`Diretório de destino: ${path.relative('.', WHITE_LABEL_ASSETS_DIR)}`, 'cyan');
  } else {
    logInfo('Nenhum arquivo precisou ser copiado');
  }

  return { copiedFiles, errors, skippedCount };
}

module.exports = {
  copyMissingAssets,
  copyFile,
};
