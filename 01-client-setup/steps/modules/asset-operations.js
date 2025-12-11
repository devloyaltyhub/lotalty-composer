const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { validateBusinessTypeKey } = require('../../shared/input-validator');

// Constants
const HEX_COLOR_WITH_ALPHA = 8;
const HEX_COLOR_WITHOUT_ALPHA = 6;
const HEX_ALPHA_START_INDEX = 6;
const HEX_RGB_END_INDEX = 6;
const HEX_RADIX = 16;
const RGB_MAX_VALUE = 255;
const HEX_RED_END = 2;
const HEX_GREEN_END = 4;
const HEX_BLUE_END = 6;
const DECIMAL_PLACES = 6;

/**
 * Validate assets structure and return errors/warnings
 */
function validateAssetsStructure(generalAssetsDir, clientsDir, businessTypes) {
  console.log('🔍 Validating assets structure...');

  const errors = [];
  const warnings = [];

  if (!fs.existsSync(generalAssetsDir)) {
    errors.push(`General assets directory not found: ${generalAssetsDir}`);
    return { errors, warnings };
  }

  const requiredDirs = ['animations', 'images', 'fonts'];
  requiredDirs.forEach((dir) => {
    const dirPath = path.join(generalAssetsDir, dir);
    if (!fs.existsSync(dirPath)) {
      warnings.push(`Optional assets directory not found: ${dirPath}`);
    }
  });

  businessTypes.forEach((businessType) => {
    const animDir = path.join(generalAssetsDir, 'animations', businessType.key);
    const imgDir = path.join(generalAssetsDir, 'images', businessType.key);

    if (!fs.existsSync(animDir)) {
      warnings.push(
        `Animation assets not found for business type '${businessType.key}': ${animDir}`
      );
    }

    if (!fs.existsSync(imgDir)) {
      warnings.push(`Image assets not found for business type '${businessType.key}': ${imgDir}`);
    }
  });

  if (!fs.existsSync(clientsDir)) {
    errors.push(`Clients directory not found: ${clientsDir}`);
  }

  return { errors, warnings };
}

/**
 * Display validation results to console
 */
function displayValidationResults(validation) {
  const { errors, warnings } = validation;

  if (errors.length > 0) {
    console.log('❌ Validation errors found:');
    errors.forEach((error) => console.log(`   • ${error}`));
  }

  if (warnings.length > 0) {
    console.log('⚠️  Validation warnings:');
    warnings.forEach((warning) => console.log(`   • ${warning}`));
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Assets structure validation passed!');
  }

  return errors.length === 0;
}

/**
 * Run automatic asset validation and processing
 */
function runAssetValidation(businessType, projectRoot) {
  console.log('🔍 Running automatic asset validation...');

  try {
    const validatedBusinessType = validateBusinessTypeKey(businessType, 'businessType');
    console.log('📋 Checking required assets and copying missing ones...');
    const validateAssetsScript = path.join(
      projectRoot,
      'automation/shared/validators/asset-validator.js'
    );

    execSync(
      `node "${validateAssetsScript}" --business-type "${validatedBusinessType}" --check-integrity --auto-copy --strict`,
      {
        stdio: 'inherit',
        cwd: projectRoot,
        shell: true,
      }
    );
    console.log('✅ Asset validation and auto-copy completed successfully');

    return true;
  } catch (error) {
    console.error('❌ Asset validation failed:', error.message);
    console.log(
      '📝 Please check the assets manually in shared_assets/ and white_label_app/assets/'
    );
    return false;
  }
}

/**
 * Compress images in white label app
 */
function compressImages(targetRoot, projectRoot) {
  console.log('📦 Compressing white label images...');

  try {
    const whitelabelAssetsPath = path.join(targetRoot, 'assets');
    const compressImagesScript = path.join(projectRoot, 'automation/assets/compress-images.js');

    if (!fs.existsSync(compressImagesScript)) {
      console.log('⚠️ Compress images script not found, skipping compression');
      return false;
    }

    if (fs.existsSync(whitelabelAssetsPath)) {
      execSync(`node "${compressImagesScript}" "${whitelabelAssetsPath}"`, {
        stdio: 'inherit',
        cwd: projectRoot,
        shell: true,
      });
      console.log('✅ Image compression completed successfully');
    } else {
      console.log('⚠️ White label assets directory not found, skipping compression');
    }

    return true;
  } catch (error) {
    console.warn('⚠️ Warning: Image compression failed, but continuing...', error.message);
    return false;
  }
}

/**
 * Optimize Lottie animations
 */
function optimizeLottieAnimations(projectRoot) {
  console.log('✨ Optimizing Lottie animations...');

  try {
    const animationsPath = path.join(projectRoot, 'automation/shared/shared_assets/animations');

    if (!fs.existsSync(animationsPath)) {
      console.log('⚠️ Animations directory not found, skipping optimization');
      return false;
    }

    execSync('npm run optimize:lottie:prettier', {
      stdio: 'inherit',
      cwd: projectRoot,
    });

    console.log('✅ Lottie animations optimized successfully');
    return true;
  } catch (error) {
    console.warn('⚠️ Warning: Lottie optimization failed, but continuing...', error.message);
    return false;
  }
}

/**
 * Clean old launcher icons to prevent duplicates
 */
function cleanOldLauncherIcons(targetRoot) {
  console.log('🧹 Cleaning old launcher icons...');

  const androidResPath = path.join(targetRoot, 'android', 'app', 'src', 'main', 'res');
  const mipmapDirs = fs.readdirSync(androidResPath).filter((dir) => dir.startsWith('mipmap-'));

  mipmapDirs.forEach((dir) => {
    const dirPath = path.join(androidResPath, dir);

    ['ic_launcher.png', 'ic_launcher_round.png', 'launcher_icon.png'].forEach((file) => {
      const filePath = path.join(dirPath, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`  🗑️  Removed: ${dir}/${file}`);
      }
    });
  });

  console.log('✅ Old launcher icons cleaned');
}

/**
 * Generate app icons using flutter_launcher_icons
 */
function generateAppIcons(targetRoot) {
  console.log('🎨 Generating app icons...');

  try {
    const logoPath = path.join(targetRoot, 'assets', 'client_specific_assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      cleanOldLauncherIcons(targetRoot);

      execSync('dart run flutter_launcher_icons', {
        stdio: 'inherit',
        cwd: targetRoot,
      });
      console.log('✅ App icons generated successfully using flutter_launcher_icons');
      return true;
    }
    console.log('⚠️ Logo not found in client_specific_assets, skipping icon generation');
    return false;
  } catch (error) {
    console.warn('⚠️ Warning: Icon generation failed, but continuing...', error.message);
    return false;
  }
}

/**
 * Run final asset validation
 */
function runFinalAssetValidation(businessType, projectRoot) {
  console.log('🔍 Running final asset validation...');

  try {
    const validatedBusinessType = validateBusinessTypeKey(businessType, 'businessType');
    const validateAssetsScript = path.join(
      projectRoot,
      'automation/shared/validators/asset-validator.js'
    );
    execSync(`node "${validateAssetsScript}" --business-type "${validatedBusinessType}" --strict`, {
      stdio: 'inherit',
      cwd: projectRoot,
      shell: true,
    });
    console.log('✅ Final asset validation completed successfully');
    return true;
  } catch (error) {
    console.warn(
      '⚠️ Warning: Final asset validation found some issues, but continuing...',
      error.message
    );
    console.log('📝 Recommend checking assets manually before proceeding');
    return false;
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFolderRecursiveSync(src, dest, ignorePaths = []) {
  fs.readdirSync(src).forEach((item) => {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const relativePath = path.relative(src, srcPath);
    if (ignorePaths.some((ignore) => relativePath.startsWith(ignore))) {
      return;
    }
    if (fs.lstatSync(srcPath).isDirectory()) {
      ensureDir(destPath);
      copyFolderRecursiveSync(srcPath, destPath, ignorePaths);
    } else {
      ensureDir(path.dirname(destPath));
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

function backupBusinessTypeAssets(assetsDir, businessTypes) {
  const categoriesToClean = ['animations', 'images', 'configs'];
  const backupDir = path.join(assetsDir, '.backup_temp');
  const backedUp = [];

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  categoriesToClean.forEach((category) => {
    const categoryDir = path.join(assetsDir, category);
    if (!fs.existsSync(categoryDir)) {
      return;
    }

    const items = fs.readdirSync(categoryDir);

    items.forEach((item) => {
      const itemPath = path.join(categoryDir, item);
      const stat = fs.lstatSync(itemPath);

      if (stat.isDirectory()) {
        const isBusinessTypeDir = businessTypes.some((businessType) => businessType.key === item);

        if (isBusinessTypeDir) {
          const backupPath = path.join(backupDir, category, item);
          console.log(`📦 Backing up: ${category}/${item}`);
          copyFolderRecursiveSync(itemPath, backupPath);
          backedUp.push({ category, item, original: itemPath, backup: backupPath });
        }
      }
    });
  });

  return { backupDir, backedUp };
}

function removeBackedUpAssets(backedUp) {
  backedUp.forEach(({ category, item, original }) => {
    console.log(`🗑️  Removing business type folder: ${category}/${item}`);
    fs.rmSync(original, { recursive: true, force: true });
  });
}

/**
 * Clean assets directory with backup
 */
function cleanAssetsDir(assetsDir, businessTypes) {
  console.log('🧹 Cleaning old business type assets (with backup)...');

  try {
    const { backupDir, backedUp } = backupBusinessTypeAssets(assetsDir, businessTypes);
    removeBackedUpAssets(backedUp);

    console.log('✅ Business type assets cleaned successfully (backup created).');
    return backupDir;
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    throw error;
  }
}

/**
 * Restore from backup
 */
function restoreFromBackup(backupDir, backedUp) {
  if (!fs.existsSync(backupDir)) {
    console.warn('⚠️  No backup directory found, cannot restore');
    return;
  }

  try {
    backedUp.forEach(({ category, item, backup, original }) => {
      if (fs.existsSync(backup)) {
        console.log(`🔄 Restoring: ${category}/${item}`);
        copyFolderRecursiveSync(backup, original);
      }
    });
    console.log('✅ Backup restored successfully');
  } catch (error) {
    console.error('❌ Failed to restore from backup:', error.message);
  }
}

/**
 * Cleanup backup after successful copy
 */
function cleanupBackup(backupDir) {
  if (fs.existsSync(backupDir)) {
    console.log('🧹 Removing backup...');
    fs.rmSync(backupDir, { recursive: true, force: true });
    console.log('✅ Backup removed');
  }
}

function copyGenericFilesInCategory(srcCategory, destCategory, businessTypeKeys) {
  fs.readdirSync(srcCategory).forEach((item) => {
    const srcPath = path.join(srcCategory, item);
    const destPath = path.join(destCategory, item);
    const isDirectory = fs.lstatSync(srcPath).isDirectory();

    if (isDirectory && businessTypeKeys.includes(item)) {
      return;
    }

    if (isDirectory) {
      ensureDir(path.dirname(destPath));
      copyFolderRecursiveSync(srcPath, destPath);
      return;
    }

    if (!isDirectory) {
      ensureDir(path.dirname(destPath));
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

function copyBusinessTypeFolder(srcCategory, destCategory, businessType, category) {
  const srcBusiness = path.join(srcCategory, businessType);
  const destBusiness = path.join(destCategory, businessType);
  if (fs.existsSync(srcBusiness)) {
    copyFolderRecursiveSync(srcBusiness, destBusiness);
    console.log(`✅ Copied ${category}/${businessType} assets`);
  } else {
    console.log(`⚠️  Warning: ${category}/${businessType} folder not found in shared_assets`);
  }
}

/**
 * Copy general category assets
 */
function copyGeneralCategory(category, generalAssetsDir, assetsDir, businessTypes, businessType) {
  const srcCategory = path.join(generalAssetsDir, category);
  const destCategory = path.join(assetsDir, category);

  if (!fs.existsSync(srcCategory)) {
    return;
  }

  const businessTypeKeys = businessTypes.map((businessTypeItem) => businessTypeItem.key);
  copyGenericFilesInCategory(srcCategory, destCategory, businessTypeKeys);

  if (businessType) {
    copyBusinessTypeFolder(srcCategory, destCategory, businessType, category);
  }
}

/**
 * Copy all general assets
 */
function copyGeneralAssets(businessType, generalAssetsDir, assetsDir, businessTypes) {
  copyGeneralCategory('animations', generalAssetsDir, assetsDir, businessTypes, businessType);
  copyGeneralCategory('images', generalAssetsDir, assetsDir, businessTypes, businessType);
  copyGeneralCategory('configs', generalAssetsDir, assetsDir, businessTypes, businessType);
  copyGeneralCategory('fonts', generalAssetsDir, assetsDir, businessTypes);
  console.log('Assets genéricos copiados com sucesso.');
}

/**
 * Copy client-specific assets
 */
function copyClientAssets(sourceDir, assetsDir) {
  const src = path.join(sourceDir, 'assets/client_specific_assets');
  const dest = path.join(assetsDir, 'client_specific_assets');
  if (fs.existsSync(src)) {
    ensureDir(path.dirname(dest));
    copyFolderRecursiveSync(src, dest);
    console.log('Pasta client_specific_assets copiada para o projeto.');
  } else {
    console.log('Atenção: O cliente não possui a pasta assets/client_specific_assets.');
  }
}

function replaceBusinessTypePaths(pubspec, businessTypes, businessType) {
  let updatedPubspec = pubspec;

  businessTypes.forEach((typeItem) => {
    const animRegex = new RegExp(`assets/animations/${typeItem.key}/`, 'g');
    updatedPubspec = updatedPubspec.replace(animRegex, `assets/animations/${businessType}/`);

    const imgRegex = new RegExp(`assets/images/${typeItem.key}/`, 'g');
    updatedPubspec = updatedPubspec.replace(imgRegex, `assets/images/${businessType}/`);

    const configRegex = new RegExp(`assets/configs/${typeItem.key}/`, 'g');
    updatedPubspec = updatedPubspec.replace(configRegex, `assets/configs/${businessType}/`);
  });

  return updatedPubspec;
}

function runFlutterCommands(targetRoot) {
  execSync('flutter pub get', { stdio: 'inherit', cwd: targetRoot });
  console.log('flutter pub get executado com sucesso.');

  execSync('dart run flutter_native_splash:create', { stdio: 'inherit', cwd: targetRoot });
  console.log('flutter_native_splash:create executado com sucesso.');
}

/**
 * Update flutter_native_splash configuration in pubspec.yaml with client colors
 * Uses transparent-logo.png with primary color background
 * @param {string} pubspecPath - Path to pubspec.yaml
 * @param {object} clientConfig - Client configuration with colors
 */
function updateSplashConfig(pubspecPath, clientConfig) {
  console.log('🎨 Updating splash screen configuration...');

  if (!fs.existsSync(pubspecPath)) {
    console.warn('  ⚠️  pubspec.yaml não encontrado.');
    return;
  }

  // Use splashBackground if defined, otherwise fallback to primary color
  const splashColor = clientConfig.colors?.splashBackground || clientConfig.colors?.primary || '#FFFFFF';
  // Remove # from color for pubspec
  const colorHex = splashColor.replace('#', '').toUpperCase();

  let pubspec = fs.readFileSync(pubspecPath, 'utf8');

  // Update flutter_native_splash section
  // Replace color values
  pubspec = pubspec.replace(
    /flutter_native_splash:\s*\n\s*color:\s*"#[A-Fa-f0-9]+"/,
    `flutter_native_splash:\n  color: "#${colorHex}"`
  );

  // Replace image to use transparent-logo
  pubspec = pubspec.replace(
    /image:\s*"assets\/client_specific_assets\/logo\.png"/g,
    'image: "assets/client_specific_assets/transparent-logo.png"'
  );

  // Update android_12 section color
  pubspec = pubspec.replace(
    /android_12:\s*\n\s*image:\s*"assets\/client_specific_assets\/[^"]+"\s*\n\s*color:\s*"#[A-Fa-f0-9]+"/,
    `android_12:\n    image: "assets/client_specific_assets/transparent-logo.png"\n    color: "#${colorHex}"`
  );

  fs.writeFileSync(pubspecPath, pubspec, 'utf8');
  console.log(`  ✅ Splash configurada: cor ${splashColor}, logo transparente`);
}

/**
 * Convert hex color to normalized RGB values (0-1 range) for iOS storyboard
 * @param {string} hexColor - Hex color string (e.g., '#5D32B3' or '5D32B3')
 * @returns {object} Object with red, green, blue values in 0-1 range
 */
function hexToRgbNormalized(hexColor) {
  const hex = hexColor.replace('#', '');
  return {
    red: parseInt(hex.substring(0, HEX_RED_END), HEX_RADIX) / RGB_MAX_VALUE,
    green: parseInt(hex.substring(HEX_RED_END, HEX_GREEN_END), HEX_RADIX) / RGB_MAX_VALUE,
    blue: parseInt(hex.substring(HEX_GREEN_END, HEX_BLUE_END), HEX_RADIX) / RGB_MAX_VALUE,
  };
}

/**
 * Copy transparent logo to iOS LaunchImage.imageset
 * @param {string} targetRoot - Root of white_label_app
 */
function copyTransparentLogoToLaunchImage(targetRoot) {
  const sourcePath = path.join(targetRoot, 'assets/client_specific_assets/transparent-logo.png');
  const launchImageDir = path.join(targetRoot, 'ios/Runner/Assets.xcassets/LaunchImage.imageset');

  if (!fs.existsSync(sourcePath)) {
    console.warn('  ⚠️  transparent-logo.png não encontrado.');
    return;
  }

  // Copy to all LaunchImage sizes
  const destinations = ['LaunchImage.png', 'LaunchImage@2x.png', 'LaunchImage@3x.png'];
  destinations.forEach((filename) => {
    const destPath = path.join(launchImageDir, filename);
    fs.copyFileSync(sourcePath, destPath);
  });

  console.log('  ✅ transparent-logo.png copiado para LaunchImage.imageset');
}

/**
 * Update iOS LaunchScreen assets after flutter_native_splash runs
 * 1. Copies transparent logo to LaunchImage.imageset
 * 2. Updates backgroundColor in LaunchScreen.storyboard (flutter_native_splash leaves it white)
 * @param {string} targetRoot - Root of white_label_app
 * @param {object} clientConfig - Client configuration with colors
 */
function updateiOSLaunchScreen(targetRoot, clientConfig) {
  console.log('🍎 Updating iOS LaunchScreen...');

  // 1. Copy transparent logo to LaunchImage.imageset
  copyTransparentLogoToLaunchImage(targetRoot);

  // 2. Update backgroundColor in storyboard
  // flutter_native_splash generates the storyboard but leaves backgroundColor WHITE
  // We need to set it to the primary color to avoid white borders
  const storyboardPath = path.join(targetRoot, 'ios/Runner/Base.lproj/LaunchScreen.storyboard');

  if (!fs.existsSync(storyboardPath)) {
    console.warn('  ⚠️  LaunchScreen.storyboard não encontrado.');
    return;
  }

  // Use splashBackground if defined, otherwise fallback to primary color
  const splashColor = clientConfig.colors?.splashBackground || clientConfig.colors?.primary || '#FFFFFF';
  const rgb = hexToRgbNormalized(splashColor);

  let storyboard = fs.readFileSync(storyboardPath, 'utf8');

  // Replace backgroundColor (which flutter_native_splash leaves as white)
  const colorAttr =
    `<color key="backgroundColor" ` +
    `red="${rgb.red.toFixed(DECIMAL_PLACES)}" ` +
    `green="${rgb.green.toFixed(DECIMAL_PLACES)}" ` +
    `blue="${rgb.blue.toFixed(DECIMAL_PLACES)}" ` +
    `alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`;

  storyboard = storyboard.replace(/<color key="backgroundColor"[^/]*\/>/, colorAttr);

  fs.writeFileSync(storyboardPath, storyboard, 'utf8');
  console.log(`  ✅ iOS LaunchScreen: backgroundColor=${splashColor}, logo=transparent`);
}

/**
 * Process config JSON files to replace placeholders with client-specific values
 * @param {string} assetsDir - Assets directory path
 * @param {string} businessType - Business type key
 * @param {object} clientConfig - Client configuration object
 */
function processConfigPlaceholders(assetsDir, businessType, clientConfig) {
  console.log('🔧 Processing config file placeholders...');

  const configsDir = path.join(assetsDir, 'configs', businessType);

  if (!fs.existsSync(configsDir)) {
    console.log(`⚠️  Configs directory not found: ${configsDir}`);
    return;
  }

  const configFiles = fs.readdirSync(configsDir).filter((file) => file.endsWith('.json'));

  configFiles.forEach((file) => {
    const filePath = path.join(configsDir, file);

    try {
      let content = fs.readFileSync(filePath, 'utf8');

      // Replace {loversName} placeholder
      if (clientConfig.loversName) {
        content = content.replace(/\{loversName\}/g, clientConfig.loversName);
      }

      // Replace {clientName} placeholder
      if (clientConfig.clientName) {
        content = content.replace(/\{clientName\}/g, clientConfig.clientName);
      }

      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✅ Processed: ${file}`);
    } catch (error) {
      console.error(`  ❌ Error processing ${file}: ${error.message}`);
    }
  });

  console.log('✅ Config placeholders processed successfully');
}

/**
 * Update pubspec.yaml assets and run flutter commands
 * @param {string} businessType - Business type key
 * @param {string} pubspecPath - Path to pubspec.yaml
 * @param {Array} businessTypes - List of all business types
 * @param {string} targetRoot - Root of white_label_app
 * @param {object} clientConfig - Optional client configuration for iOS splash customization
 */
function updatePubspecAssets(businessType, pubspecPath, businessTypes, targetRoot, clientConfig) {
  if (!fs.existsSync(pubspecPath)) {
    console.warn('pubspec.yaml não encontrado.');
    return;
  }

  let pubspec = fs.readFileSync(pubspecPath, 'utf8');
  pubspec = replaceBusinessTypePaths(pubspec, businessTypes, businessType);

  fs.writeFileSync(pubspecPath, pubspec, 'utf8');
  console.log(`pubspec.yaml atualizado para assets do tipo "${businessType}".`);

  try {
    runFlutterCommands(targetRoot);

    // Update iOS LaunchScreen AFTER flutter_native_splash:create
    // This ensures our customizations aren't overwritten
    if (clientConfig) {
      updateiOSLaunchScreen(targetRoot, clientConfig);
    }
  } catch (error) {
    console.error(
      'Erro ao executar flutter pub get ou flutter_native_splash:create:',
      error.message
    );
  }
}

module.exports = {
  validateAssetsStructure,
  displayValidationResults,
  runAssetValidation,
  compressImages,
  optimizeLottieAnimations,
  generateAppIcons,
  runFinalAssetValidation,
  cleanAssetsDir,
  restoreFromBackup,
  cleanupBackup,
  copyGeneralAssets,
  copyClientAssets,
  copyFolderRecursiveSync,
  ensureDir,
  updatePubspecAssets,
  processConfigPlaceholders,
  updateSplashConfig,
  updateiOSLaunchScreen,
};
