#!/usr/bin/env node

const { log, logInfo, logSuccess, logWarning, logError } = require('./console-logger');
const { verifyFileIntegrity } = require('./file-utils');
const {
  ASSET_REQUIREMENTS,
  getExistingBusinessTypes,
  initializeBusinessTypes,
} = require('./asset-requirements');
const { validateGlobalAssets } = require('./global-validator');
const { validateBusinessTypeAssets } = require('./business-type-validator');
const { copyMissingAssets } = require('./asset-copier');
const {
  SHARED_ASSETS_DIR: CENTRALIZED_SHARED_ASSETS_DIR,
  WHITE_LABEL_ASSETS_DIR: CENTRALIZED_WHITE_LABEL_ASSETS_DIR,
} = require('../../utils/paths');

const SHARED_ASSETS_DIR = CENTRALIZED_SHARED_ASSETS_DIR;
const WHITE_LABEL_ASSETS_DIR = CENTRALIZED_WHITE_LABEL_ASSETS_DIR;

function validateAssets(options = {}) {
  const {
    businessType = null,
    strict = false,
    checkIntegrity = false,
    autoCopy = false,
    dryRun = false,
  } = options;

  initializeBusinessTypes();

  log('\nAsset Validation Report', 'cyan');
  log('='.repeat(50), 'cyan');

  logInfo(`Modo: ${strict ? 'Rigoroso' : 'Normal'}`);
  logInfo(`Verificação de integridade: ${checkIntegrity ? 'Ativada' : 'Desativada'}`);
  logInfo(`Cópia automática: ${autoCopy ? 'Ativada' : 'Desativada'}`);
  if (dryRun) logInfo('Modo de simulação: Ativado');

  let totalErrors = 0;
  let totalWarnings = 0;
  let processedAssets = 0;

  if (autoCopy) {
    logInfo('\nCopiando assets faltantes automaticamente...');
    const copyResult = copyMissingAssets({ dryRun, businessType });

    if (copyResult.copiedFiles.length > 0) {
      logSuccess(
        `${copyResult.copiedFiles.length} arquivos ${dryRun ? 'seriam copiados' : 'copiados'}:`
      );
      copyResult.copiedFiles.forEach((file) => {
        log(`  - ${file.source} -> ${file.dest}`, 'green');
      });
    } else {
      logInfo('Nenhum arquivo precisou ser copiado');
    }

    if (copyResult.errors.length > 0) {
      logError('Erros durante a cópia:');
      copyResult.errors.forEach((error) => log(`  - ${error}`, 'red'));
    }

    log('');
  }

  logInfo('\nValidando assets globais...');
  const globalResult = validateGlobalAssets({ checkIntegrity });
  totalErrors += globalResult.errors.length;
  totalWarnings += globalResult.warnings.length;
  processedAssets += globalResult.processed;

  logInfo(`Assets globais processados: ${globalResult.processed}`);
  if (globalResult.errors.length > 0) {
    logError(`Erros encontrados: ${globalResult.errors.length}`);
  }
  if (globalResult.warnings.length > 0) {
    logWarning(`Avisos encontrados: ${globalResult.warnings.length}`);
  }

  if (globalResult.errors.length > 0) {
    log('\nGlobal Asset Errors:', 'red');
    globalResult.errors.forEach((error) => log(`  - ${error}`, 'red'));
  }

  if (globalResult.warnings.length > 0) {
    log('\nGlobal Asset Warnings:', 'yellow');
    globalResult.warnings.forEach((warning) => log(`  - ${warning}`, 'yellow'));
  }

  const businessTypes = businessType ? [businessType] : getExistingBusinessTypes();

  businessTypes.forEach((type) => {
    logInfo(`\nValidando assets para tipo de negócio: ${type}...`);
    const typeResult = validateBusinessTypeAssets(type, { checkIntegrity });
    totalErrors += typeResult.errors.length;
    totalWarnings += typeResult.warnings.length;
    processedAssets += typeResult.processed;

    logInfo(`Assets específicos processados: ${typeResult.processed}`);
    if (typeResult.errors.length > 0) {
      logError(`Erros encontrados: ${typeResult.errors.length}`);
    }
    if (typeResult.warnings.length > 0) {
      logWarning(`Avisos encontrados: ${typeResult.warnings.length}`);
    }

    if (typeResult.errors.length > 0) {
      log(`\n${type.toUpperCase()} Asset Errors:`, 'red');
      typeResult.errors.forEach((error) => log(`  - ${error}`, 'red'));
    }

    if (typeResult.warnings.length > 0) {
      log(`\n${type.toUpperCase()} Asset Warnings:`, 'yellow');
      typeResult.warnings.forEach((warning) => log(`  - ${warning}`, 'yellow'));
    }
  });

  log('\nResumo detalhado da validação:', 'cyan');
  logInfo(`Diretórios verificados:`);
  logInfo(`  - shared_assets: ${SHARED_ASSETS_DIR}`);
  logInfo(`  - white_label_assets: ${WHITE_LABEL_ASSETS_DIR}`);
  logInfo(`Total de assets processados: ${processedAssets}`);
  log(`Total Errors: ${totalErrors}`, totalErrors > 0 ? 'red' : 'green');
  log(`Total Warnings: ${totalWarnings}`, totalWarnings > 0 ? 'yellow' : 'green');

  if (checkIntegrity) {
    logInfo('Verificação de integridade: Executada');
  }

  if (totalErrors === 0 && totalWarnings === 0) {
    logSuccess('All asset requirements are satisfied!');
  } else if (totalErrors === 0) {
    logWarning('Validation passed with warnings');
    if (totalWarnings > 0 && !strict) {
      logWarning(`Nota: ${totalWarnings} avisos encontrados (não críticos)`);
    }
  } else {
    logError('Validation failed with errors');
    if (strict && totalWarnings > 0) {
      logWarning('Modo rigoroso: avisos também são considerados falhas');
    }
  }

  if (strict && (totalErrors > 0 || totalWarnings > 0)) {
    return 1;
  } else if (totalErrors > 0) {
    return 1;
  }

  return 0;
}

module.exports = {
  validateAssets,
  validateGlobalAssets,
  validateBusinessTypeAssets,
  getExistingBusinessTypes,
  copyMissingAssets,
  verifyFileIntegrity,
  ASSET_REQUIREMENTS,
};
