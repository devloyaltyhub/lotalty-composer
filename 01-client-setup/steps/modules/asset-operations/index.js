const {
  validateAssetsStructure,
  displayValidationResults,
  runAssetValidation,
  runFinalAssetValidation,
} = require('./validation');

const {
  ensureDir,
  copyFolderRecursiveSync,
  cleanAssetsDir,
  restoreFromBackup,
  cleanupBackup,
} = require('./file-operations');

const {
  copyGeneralAssets,
  copyClientAssets,
} = require('./asset-copy');

const {
  compressImages,
  optimizeLottieAnimations,
  generateAppIcons,
} = require('./image-processing');

const {
  updateSplashConfig,
  updateiOSLaunchScreen,
  updatePubspecAssets,
} = require('./splash-config');

const {
  processConfigPlaceholders,
} = require('./config-placeholders');

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
