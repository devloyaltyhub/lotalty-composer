#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  SHARED_ASSETS_DIR: CENTRALIZED_SHARED_ASSETS_DIR,
  WHITE_LABEL_ASSETS_DIR: CENTRALIZED_WHITE_LABEL_ASSETS_DIR,
  WHITE_LABEL_CLIENT_ASSETS_DIR,
  WHITE_LABEL_CONFIG,
} = require('../utils/paths');

// Constants - Use centralized paths
const SHARED_ASSETS_DIR = CENTRALIZED_SHARED_ASSETS_DIR;
const WHITE_LABEL_ASSETS_DIR = CENTRALIZED_WHITE_LABEL_ASSETS_DIR;
const CLIENT_ASSETS_DIR = WHITE_LABEL_CLIENT_ASSETS_DIR;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Asset requirements configuration
const ASSET_REQUIREMENTS = {
  // Assets obrigatórios para todos os business types
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

  // Assets específicos por business type
  // IMPORTANT: This is now dynamically loaded from the filesystem
  // The business_types object will be populated at runtime by scanning shared_assets/
  business_types: {},
};

// Get existing business types from shared_assets structure
function getExistingBusinessTypes() {
  const businessTypes = [];

  try {
    const animationsDir = path.join(SHARED_ASSETS_DIR, 'animations');
    if (fs.existsSync(animationsDir)) {
      const items = fs.readdirSync(animationsDir, { withFileTypes: true });
      items.forEach((item) => {
        // Include all directories that are not hidden (start with .)
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

// Dynamically discover and load business type assets
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

  // Load animations from shared_assets
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

  // Load images from shared_assets
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

  // For white_label_assets, we expect the same files to be copied
  // So we use the same list as shared_assets for validation
  assets.white_label_assets.animations = [...assets.shared_assets.animations];
  assets.white_label_assets.images = [...assets.shared_assets.images];

  return assets;
}

// Initialize business types dynamically
function initializeBusinessTypes() {
  const discoveredTypes = getExistingBusinessTypes();

  discoveredTypes.forEach((businessType) => {
    if (!ASSET_REQUIREMENTS.business_types[businessType]) {
      ASSET_REQUIREMENTS.business_types[businessType] = loadBusinessTypeAssets(businessType);
      logInfo(`Dinamicamente carregado business type: ${businessType}`);
    }
  });
}

// Check if file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

// Calculate file hash for integrity verification
function calculateFileHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    return null;
  }
}

// Get file size for comparison
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return null;
  }
}

// Verify file integrity between source and destination
function verifyFileIntegrity(sourcePath, destPath) {
  if (!fileExists(sourcePath) || !fileExists(destPath)) {
    return { valid: false, reason: 'Arquivo não encontrado' };
  }

  const sourceSize = getFileSize(sourcePath);
  const destSize = getFileSize(destPath);

  if (sourceSize !== destSize) {
    return {
      valid: false,
      reason: `Tamanho diferente (origem: ${sourceSize} bytes, destino: ${destSize} bytes)`,
    };
  }

  const sourceHash = calculateFileHash(sourcePath);
  const destHash = calculateFileHash(destPath);

  if (sourceHash !== destHash) {
    return {
      valid: false,
      reason: 'Hash diferente - arquivo pode estar corrompido',
    };
  }

  return { valid: true, reason: 'Arquivo íntegro' };
}

// Validate global assets
function validateGlobalAssets(options = {}) {
  const errors = [];
  const warnings = [];
  const { checkIntegrity = false } = options;
  let processed = 0;

  logInfo('Validando assets globais...');

  // Check shared assets
  const sharedRequirements = ASSET_REQUIREMENTS.global.shared_assets;

  // Images
  sharedRequirements.images.forEach((imageName) => {
    processed++;
    const imagePath = path.join(SHARED_ASSETS_DIR, 'images', imageName);
    if (!fileExists(imagePath)) {
      errors.push(`Missing global shared image: ${imageName}`);
    }
  });

  // Animations
  sharedRequirements.animations.forEach((animationName) => {
    processed++;
    const animationPath = path.join(SHARED_ASSETS_DIR, 'animations', animationName);
    if (!fileExists(animationPath)) {
      errors.push(`Missing global shared animation: ${animationName}`);
    }
  });

  // Fonts
  if (sharedRequirements.fonts) {
    sharedRequirements.fonts.forEach((fontPath) => {
      processed++;
      const fullPath = path.join(SHARED_ASSETS_DIR, 'fonts', fontPath);
      if (!fileExists(fullPath)) {
        errors.push(`Missing global shared font: ${fontPath}`);
      }
    });
  }

  // Check white label assets
  const whiteLabelRequirements = ASSET_REQUIREMENTS.global.white_label_assets;

  // Images
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

  // Animations
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

  // Fonts
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

  // Check client specific assets
  ASSET_REQUIREMENTS.global.client_specific_assets.forEach((assetName) => {
    processed++;
    const assetPath = path.join(CLIENT_ASSETS_DIR, assetName);
    if (!fileExists(assetPath)) {
      warnings.push(`Missing client specific asset: ${assetName}`);
    }
  });

  return { errors, warnings, processed };
}

// Validate business type specific assets
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

  // Check shared assets for this business type
  if (requirements.shared_assets) {
    // Images
    if (requirements.shared_assets.images) {
      requirements.shared_assets.images.forEach((imageName) => {
        processed++;
        const imagePath = path.join(SHARED_ASSETS_DIR, 'images', imageName);
        if (!fileExists(imagePath)) {
          errors.push(`Missing shared image for ${businessType}: ${imageName}`);
        }
      });
    }

    // Animations
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

  // Check white label assets for this business type
  if (requirements.white_label_assets) {
    // Images
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

    // Animations
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

// Copy missing assets from shared to white label
function copyMissingAssets(options = {}) {
  const { dryRun = false, businessType = null } = options;
  const copiedFiles = [];
  const errors = [];
  let skippedCount = 0;

  logInfo(dryRun ? 'Simulando cópia de assets faltantes...' : 'Copiando assets faltantes...');

  // Function to copy file with directory creation
  function copyFile(sourcePath, destPath) {
    try {
      if (!fileExists(sourcePath)) {
        errors.push(`Arquivo fonte não encontrado: ${sourcePath}`);
        skippedCount++;
        return false;
      }

      // Check if destination file already exists
      if (fileExists(destPath)) {
        logWarning(`Arquivo já existe, sobrescrevendo: ${path.relative('.', destPath)}`);
      }

      if (!dryRun) {
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
          log(`📁 Diretório criado: ${path.relative('.', destDir)}`, 'cyan');
        }

        // Get source file info
        const sourceStats = fs.statSync(sourcePath);
        const sourceSize = (sourceStats.size / 1024).toFixed(2);

        fs.copyFileSync(sourcePath, destPath);

        // Verify copy was successful
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

  // Copy global assets
  const globalRequirements = ASSET_REQUIREMENTS.global.white_label_assets;

  // Copy global images
  globalRequirements.images.forEach((imageName) => {
    const sourcePath = path.join(SHARED_ASSETS_DIR, 'images', imageName);
    const destPath = path.join(WHITE_LABEL_ASSETS_DIR, 'images', imageName);

    if (!fileExists(destPath) && fileExists(sourcePath)) {
      copyFile(sourcePath, destPath);
    }
  });

  // Copy global animations
  globalRequirements.animations.forEach((animationName) => {
    const sourcePath = path.join(SHARED_ASSETS_DIR, 'animations', animationName);
    const destPath = path.join(WHITE_LABEL_ASSETS_DIR, 'animations', animationName);

    if (!fileExists(destPath) && fileExists(sourcePath)) {
      copyFile(sourcePath, destPath);
    }
  });

  // Copy global fonts
  if (globalRequirements.fonts) {
    globalRequirements.fonts.forEach((fontPath) => {
      const sourcePath = path.join(SHARED_ASSETS_DIR, 'fonts', fontPath);
      const destPath = path.join(WHITE_LABEL_ASSETS_DIR, 'fonts', fontPath);

      if (!fileExists(destPath) && fileExists(sourcePath)) {
        copyFile(sourcePath, destPath);
      }
    });
  }

  // Copy business type specific assets
  // IMPORTANT: Only copy assets for the specified business type (if provided)
  // This prevents copying assets from other business types
  const businessTypes = businessType ? [businessType] : getExistingBusinessTypes();
  businessTypes.forEach((type) => {
    const requirements = ASSET_REQUIREMENTS.business_types[type];

    if (requirements && requirements.white_label_assets) {
      // Copy business type images
      if (requirements.white_label_assets.images) {
        requirements.white_label_assets.images.forEach((imageName) => {
          const sourcePath = path.join(SHARED_ASSETS_DIR, 'images', imageName);
          const destPath = path.join(WHITE_LABEL_ASSETS_DIR, 'images', imageName);

          if (!fileExists(destPath) && fileExists(sourcePath)) {
            copyFile(sourcePath, destPath);
          }
        });
      }

      // Copy business type animations
      if (requirements.white_label_assets.animations) {
        requirements.white_label_assets.animations.forEach((animationName) => {
          const sourcePath = path.join(SHARED_ASSETS_DIR, 'animations', animationName);
          const destPath = path.join(WHITE_LABEL_ASSETS_DIR, 'animations', animationName);

          if (!fileExists(destPath) && fileExists(sourcePath)) {
            copyFile(sourcePath, destPath);
          }
        });
      }
    }
  });

  // Enhanced summary logging
  if (copiedFiles.length > 0 || errors.length > 0 || skippedCount > 0) {
    log('\n📊 Resumo da cópia automática:', 'cyan');
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
    log(`📁 Diretório de destino: ${path.relative('.', WHITE_LABEL_ASSETS_DIR)}`, 'cyan');
  } else {
    logInfo('Nenhum arquivo precisou ser copiado');
  }

  return { copiedFiles, errors, skippedCount };
}

// Main validation function
function validateAssets(options = {}) {
  const {
    businessType = null,
    strict = false,
    checkIntegrity = false,
    autoCopy = false,
    dryRun = false,
  } = options;

  // Initialize business types dynamically before validation
  initializeBusinessTypes();

  log('\n🔍 Asset Validation Report', 'cyan');
  log('='.repeat(50), 'cyan');

  logInfo(`Modo: ${strict ? 'Rigoroso' : 'Normal'}`);
  logInfo(`Verificação de integridade: ${checkIntegrity ? 'Ativada' : 'Desativada'}`);
  logInfo(`Cópia automática: ${autoCopy ? 'Ativada' : 'Desativada'}`);
  if (dryRun) logInfo('Modo de simulação: Ativado');

  let totalErrors = 0;
  let totalWarnings = 0;
  let processedAssets = 0;

  // Auto-copy missing assets if requested
  if (autoCopy) {
    logInfo('\n📋 Copiando assets faltantes automaticamente...');
    const copyResult = copyMissingAssets({ dryRun, businessType });

    if (copyResult.copiedFiles.length > 0) {
      logSuccess(
        `${copyResult.copiedFiles.length} arquivos ${dryRun ? 'seriam copiados' : 'copiados'}:`
      );
      copyResult.copiedFiles.forEach((file) => {
        log(`  • ${path.relative('.', file.source)} → ${path.relative('.', file.dest)}`, 'green');
      });
    } else {
      logInfo('Nenhum arquivo precisou ser copiado');
    }

    if (copyResult.errors.length > 0) {
      logError('Erros durante a cópia:');
      copyResult.errors.forEach((error) => log(`  • ${error}`, 'red'));
    }

    log('');
  }

  // Validate global assets
  logInfo('\n📋 Validando assets globais...');
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

  // Display global results
  if (globalResult.errors.length > 0) {
    log('\n❌ Global Asset Errors:', 'red');
    globalResult.errors.forEach((error) => log(`  • ${error}`, 'red'));
  }

  if (globalResult.warnings.length > 0) {
    log('\n⚠️  Global Asset Warnings:', 'yellow');
    globalResult.warnings.forEach((warning) => log(`  • ${warning}`, 'yellow'));
  }

  // Validate business type specific assets
  const businessTypes = businessType ? [businessType] : getExistingBusinessTypes();

  businessTypes.forEach((type) => {
    logInfo(`\n🏢 Validando assets para tipo de negócio: ${type}...`);
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
      log(`\n❌ ${type.toUpperCase()} Asset Errors:`, 'red');
      typeResult.errors.forEach((error) => log(`  • ${error}`, 'red'));
    }

    if (typeResult.warnings.length > 0) {
      log(`\n⚠️  ${type.toUpperCase()} Asset Warnings:`, 'yellow');
      typeResult.warnings.forEach((warning) => log(`  • ${warning}`, 'yellow'));
    }
  });

  // Summary
  log('\n📊 Resumo detalhado da validação:', 'cyan');
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
    logSuccess('All asset requirements are satisfied! 🎉');
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

  // Return appropriate exit code
  if (strict && (totalErrors > 0 || totalWarnings > 0)) {
    return 1;
  } else if (totalErrors > 0) {
    return 1;
  }

  return 0;
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--business-type' || arg === '-t') {
      options.businessType = args[++i];
    } else if (arg === '--strict' || arg === '-s') {
      options.strict = true;
    } else if (arg === '--check-integrity' || arg === '-i') {
      options.checkIntegrity = true;
    } else if (arg === '--auto-copy' || arg === '-c') {
      options.autoCopy = true;
    } else if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Asset Validation Tool

Usage: node validate-assets.js [options]

Options:
  -t, --business-type <type>  Validate assets for specific business type only
                              (auto-detects from white_label_app/config.json if not specified)
  -s, --strict               Treat warnings as errors
  -i, --check-integrity      Verify file integrity (size and hash)
  -c, --auto-copy           Automatically copy missing assets from shared_assets
  -d, --dry-run             Show what would be copied without actually copying
  -h, --help                Show this help message

Examples:
  node validate-assets.js                    # Auto-detect and validate (uses white_label_app config)
  node validate-assets.js -t coffee          # Validate only coffee assets
  node validate-assets.js --strict           # Strict mode (warnings = errors)
  node validate-assets.js -i                 # Check file integrity
  node validate-assets.js -c                 # Auto-copy missing assets
  node validate-assets.js -c -d              # Dry run of auto-copy
      `);
      process.exit(0);
    }
  }

  // If no business type specified, try to auto-detect from white_label_app/config.json
  if (!options.businessType) {
    if (fs.existsSync(WHITE_LABEL_CONFIG)) {
      try {
        const whiteLabelConfig = JSON.parse(fs.readFileSync(WHITE_LABEL_CONFIG, 'utf8'));
        if (whiteLabelConfig.businessType) {
          options.businessType = whiteLabelConfig.businessType;
          logInfo(
            `Auto-detected business type from white_label_app config: ${options.businessType}`
          );
        }
      } catch (error) {
        logWarning(`Could not read white_label_app/config.json: ${error.message}`);
      }
    }
  }

  const exitCode = validateAssets(options);
  process.exit(exitCode);
}

// Export for use as module
module.exports = {
  validateAssets,
  validateGlobalAssets,
  validateBusinessTypeAssets,
  getExistingBusinessTypes,
  copyMissingAssets,
  verifyFileIntegrity,
  ASSET_REQUIREMENTS,
};

// Run if called directly
if (require.main === module) {
  main();
}
