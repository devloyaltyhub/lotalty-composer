const path = require('path');
const clientSelector = require('../../../shared/utils/client-selector');
const assetOps = require('../modules/asset-operations');
const templateGen = require('../modules/template-generator');
const keystoreOps = require('../modules/keystore-operations');
const iosOps = require('../modules/ios-operations');
const postSetupValidator = require('../modules/post-setup-validator');

const {
  SETUP_MODE,
  TARGET_ROOT,
  GENERAL_ASSETS_DIR,
  ASSETS_DIR,
  PUBSPEC_PATH,
  TEMPLATES_DIR,
  COMPOSE_ROOT,
  CLIENTS_DIR,
} = require('./config');

const {
  parseArguments,
  validateDeployPrerequisites,
  validateLoyaltyCredentialsRepo,
  validateBusinessType,
} = require('./validation');

const {
  loadBusinessTypesFromAssets,
  selectBusinessType,
  getBusinessTypes,
} = require('./business-types');

const {
  copyFirebaseConfigs,
  copyFirebaseJson,
  copyShorebirdConfig,
} = require('./firebase-config');

const {
  generatePackageRenameConfig,
  saveUpdatedConfig,
} = require('./package-config');

function performAssetCopy(sourceDir, businessType, clientConfig) {
  const BUSINESS_TYPES = getBusinessTypes();
  const backupDir = assetOps.cleanAssetsDir(ASSETS_DIR, BUSINESS_TYPES);

  try {
    assetOps.copyGeneralAssets(businessType, GENERAL_ASSETS_DIR, ASSETS_DIR, BUSINESS_TYPES);
    assetOps.copyClientAssets(sourceDir, ASSETS_DIR);
    assetOps.processConfigPlaceholders(ASSETS_DIR, businessType, clientConfig);

    assetOps.copyFolderRecursiveSync(sourceDir, TARGET_ROOT, [
      'assets/client_specific_assets',
      'lib/src/utils/user_configs.dart',
      'lib/src/ui/core/theme_constants.dart',
    ]);

    assetOps.cleanupBackup(backupDir);
  } catch (error) {
    console.error('Error during asset copy:', error.message);
    console.log('Restoring from backup...');
    throw error;
  }
}

function processAssets(businessType, clientConfig) {
  console.log('\nProcessing assets...');
  const BUSINESS_TYPES = getBusinessTypes();

  if (!assetOps.runAssetValidation(businessType, COMPOSE_ROOT)) {
    console.error('Asset validation failed. Please check the assets manually.');
    process.exit(1);
  }

  assetOps.compressImages(TARGET_ROOT, COMPOSE_ROOT);
  assetOps.optimizeLottieAnimations(COMPOSE_ROOT);
  assetOps.generateAppIcons(TARGET_ROOT);
  assetOps.updateSplashConfig(PUBSPEC_PATH, clientConfig);
  assetOps.updatePubspecAssets(businessType, PUBSPEC_PATH, BUSINESS_TYPES, TARGET_ROOT, clientConfig);
  assetOps.runFinalAssetValidation(businessType, COMPOSE_ROOT);
}

function displaySuccessSummary() {
  console.log('\nWhite label setup completed successfully!');
  console.log('Summary:');
  console.log('  Assets validated and copied');
  console.log('  Images compressed');
  console.log('  Icons generated (if applicable)');
  console.log('  Splash screen configured (primary color + transparent logo)');
  console.log('  Pubspec updated');
  console.log('  Android keystore configured');
  console.log('  Firebase configs copied (if available)');
  console.log('  firebase.json with flutter.platforms configured');
  console.log('  config.json updated with selected businessType');
  console.log('  Old Kotlin packages cleaned');
  console.log('  package_rename_config.yaml regenerated from config.json');
  console.log('  Bundle ID and app name updated via package_rename');
  console.log('  Flutter build cleaned');
  console.log('  iOS pods reinstalled');
  console.log('  Xcode caches cleaned');
  console.log('  Shorebird config copied (if available)');
  console.log('  Post-setup validation (Firebase + native configs)');
  console.log(
    '\nNote: If you have Xcode open, please close and reopen it to see the updated Bundle ID'
  );
  console.log(
    'The CFBundleDisplayName now matches the appName from config.json (App Store Connect name)'
  );
}

async function selectClient(clientArg) {
  return await clientSelector.selectClientOrPrompt(clientArg, {
    message: 'Digite o numero do cliente:',
  });
}

async function main(clientArg) {
  try {
    validateLoyaltyCredentialsRepo();
    loadBusinessTypesFromAssets();
    const BUSINESS_TYPES = getBusinessTypes();

    console.log('Validating assets structure...');
    const validation = assetOps.validateAssetsStructure(
      GENERAL_ASSETS_DIR,
      CLIENTS_DIR,
      BUSINESS_TYPES
    );
    if (!assetOps.displayValidationResults(validation)) {
      console.error('Critical asset structure issues found. Please fix them before continuing.');
      process.exit(1);
    }

    const client = await selectClient(clientArg);
    const sourceDir = path.join(CLIENTS_DIR, client);

    console.log(`\nLoading client configuration...`);
    const clientConfig = templateGen.loadClientConfig(client, CLIENTS_DIR);
    console.log(`  Loaded config for: ${clientConfig.clientName}`);
    console.log(`  Business type (config): ${clientConfig.businessType}`);

    const businessType = await selectBusinessType(clientConfig.businessType);
    console.log(`  Using business type: ${businessType}`);
    validateBusinessType(businessType, BUSINESS_TYPES);

    clientConfig.businessType = businessType;

    templateGen.generateDartFiles(clientConfig, TARGET_ROOT, TEMPLATES_DIR);

    performAssetCopy(sourceDir, businessType, clientConfig);
    saveUpdatedConfig(clientConfig);
    processAssets(businessType, clientConfig);

    keystoreOps.copyAndroidKeystore(TARGET_ROOT, client);
    copyFirebaseConfigs(client, clientConfig);
    copyFirebaseJson(client, clientConfig);
    copyShorebirdConfig(client);
    generatePackageRenameConfig(clientConfig);
    iosOps.postProcess(TARGET_ROOT);

    const validationPassed = postSetupValidator.runPostSetupValidation(clientConfig);

    displaySuccessSummary();

    if (!validationPassed) {
      console.log('\nSetup concluido com avisos de validacao. Verifique os erros acima.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

const { clientArg, deployMode } = parseArguments();
const mode = deployMode ? SETUP_MODE.DEPLOY : SETUP_MODE.FULL;

if (mode === SETUP_MODE.DEPLOY) {
  console.log('Running white label setup in DEPLOY mode (validation only)');
  if (!clientArg) {
    console.error('ERRO: Deploy mode requer o codigo do cliente como argumento');
    console.error('   Uso: npm run start -- <client-code> --deploy-mode');
    process.exit(1);
  }
  validateDeployPrerequisites(clientArg);
} else {
  console.log('Running white label setup in FULL mode');
  main(clientArg);
}
