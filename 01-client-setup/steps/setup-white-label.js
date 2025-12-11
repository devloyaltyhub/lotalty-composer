const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const clientSelector = require('../../shared/utils/client-selector');
const assetOps = require('./modules/asset-operations');
const templateGen = require('./modules/template-generator');
const keystoreOps = require('./modules/keystore-operations');
const iosOps = require('./modules/ios-operations');
const postSetupValidator = require('./modules/post-setup-validator');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Setup modes
const SETUP_MODE = {
  FULL: 'full',
  DEPLOY: 'deploy',
};

// Constants
// loyalty-compose root directory
const COMPOSE_ROOT = path.resolve(__dirname, '../..');
// loyalty-app root (sibling to loyalty-compose)
const LOYALTY_APP_ROOT = path.resolve(COMPOSE_ROOT, '../loyalty-app');
const CLIENTS_DIR = path.join(COMPOSE_ROOT, 'clients');
const TARGET_ROOT = path.join(LOYALTY_APP_ROOT, 'white_label_app');
const GENERAL_ASSETS_DIR = path.resolve(__dirname, '../../shared/shared_assets');
const ASSETS_DIR = path.join(TARGET_ROOT, 'assets');
const PUBSPEC_PATH = path.join(TARGET_ROOT, 'pubspec.yaml');
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');
const LOYALTY_CREDENTIALS_PATH = path.resolve(COMPOSE_ROOT, '../loyalty-credentials');

let BUSINESS_TYPES = [];

/**
 * Parse command line arguments
 * @returns {{ clientArg: string|null, deployMode: boolean }}
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const clientArg = args.find((arg) => !arg.startsWith('--')) || null;
  const deployMode = args.includes('--deploy-mode');
  return { clientArg, deployMode };
}

/**
 * Validate that white-label setup was already done for the given client
 * Used in deploy mode to skip redundant operations
 * @param {string} clientCode - The client code to validate
 * @returns {boolean} - True if validation passes, exits with error otherwise
 */
function validateDeployPrerequisites(clientCode) {
  console.log(`\n🔍 Validando setup existente para cliente: ${clientCode}`);

  // 1. Check if config.json exists
  const configPath = path.join(TARGET_ROOT, 'config.json');
  if (!fs.existsSync(configPath)) {
    console.error('\n❌ ERRO: Setup não encontrado!');
    console.error(`   Arquivo não existe: ${configPath}`);
    console.error(`\n💡 Execute primeiro: npm run start -- ${clientCode}`);
    process.exit(1);
  }

  // 2. Check if clientCode matches
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('\n❌ ERRO: config.json corrompido!');
    console.error(`   ${error.message}`);
    console.error(`\n💡 Execute novamente: npm run start -- ${clientCode}`);
    process.exit(1);
  }

  if (config.clientCode !== clientCode) {
    console.error('\n❌ ERRO: Cliente diferente configurado!');
    console.error(`   Configurado: ${config.clientCode}`);
    console.error(`   Solicitado: ${clientCode}`);
    console.error(`\n💡 Execute primeiro: npm run start -- ${clientCode}`);
    process.exit(1);
  }

  // 3. Quick validation of critical assets
  console.log('  ✅ config.json encontrado');
  console.log(`  ✅ Cliente correto: ${config.clientName} (${config.clientCode})`);

  // Check critical asset files exist
  const criticalAssets = [
    path.join(TARGET_ROOT, 'assets/client_specific_assets/logo.png'),
    path.join(TARGET_ROOT, 'pubspec.yaml'),
  ];

  let allAssetsPresent = true;
  for (const assetPath of criticalAssets) {
    if (!fs.existsSync(assetPath)) {
      console.error(`  ❌ Asset faltando: ${path.basename(assetPath)}`);
      allAssetsPresent = false;
    }
  }

  if (!allAssetsPresent) {
    console.error('\n❌ ERRO: Assets críticos faltando!');
    console.error(`\n💡 Execute novamente: npm run start -- ${clientCode}`);
    process.exit(1);
  }

  console.log('  ✅ Assets críticos presentes');
  console.log('\n✅ Deploy mode: Setup já configurado, pulando operações redundantes');

  return true;
}

/**
 * Load business types dynamically from shared assets
 */
function loadBusinessTypesFromAssets() {
  try {
    const animationsDir = path.join(GENERAL_ASSETS_DIR, 'animations');
    if (!fs.existsSync(animationsDir)) {
      return;
    }

    const businessTypeDirs = fs.readdirSync(animationsDir).filter((dir) => {
      const fullPath = path.join(animationsDir, dir);
      return fs.statSync(fullPath).isDirectory() && dir !== '.' && dir !== '..';
    });

    const discoveredTypes = businessTypeDirs.map((dir) => ({
      key: dir,
      label: dir.charAt(0).toUpperCase() + dir.slice(1),
    }));

    const existingKeys = BUSINESS_TYPES.map((typeItem) => typeItem.key);
    const newTypes = discoveredTypes.filter((typeItem) => !existingKeys.includes(typeItem.key));

    if (newTypes.length > 0) {
      BUSINESS_TYPES = [...BUSINESS_TYPES, ...newTypes];
      console.log(
        `📁 Discovered ${newTypes.length} additional business types: ${newTypes.map((typeItem) => typeItem.key).join(', ')}`
      );
    }
  } catch (error) {
    console.warn('⚠️  Could not load business types from assets directory:', error.message);
  }
}

function validateBusinessType(businessType) {
  const validBusinessTypes = BUSINESS_TYPES.map((typeItem) => typeItem.key);
  if (!validBusinessTypes.includes(businessType)) {
    throw new Error(
      `Invalid business type "${businessType}". Valid options: ${validBusinessTypes.join(', ')}`
    );
  }
}

/**
 * Validates that the loyalty-credentials repository exists
 * This is required for Android keystores and other credentials
 */
function validateLoyaltyCredentialsRepo() {
  console.log('🔐 Validating loyalty-credentials repository...');

  if (!fs.existsSync(LOYALTY_CREDENTIALS_PATH)) {
    console.error('\n❌ ERRO: Repositório loyalty-credentials não encontrado!');
    console.error(`   Caminho esperado: ${LOYALTY_CREDENTIALS_PATH}`);
    console.error('\n📋 Para resolver:');
    console.error('   1. Clone o repositório loyalty-credentials como irmão do loyalty-compose:');
    console.error('      cd .. && git clone <url-do-repo> loyalty-credentials');
    console.error('   2. Certifique-se de que a estrutura seja:');
    console.error('      loyaltyhub/');
    console.error('        ├── loyalty-compose/');
    console.error('        └── loyalty-credentials/');
    console.error('\n⚠️  Este repositório contém keystores Android e outras credenciais essenciais.');
    process.exit(1);
  }

  console.log('  ✅ loyalty-credentials encontrado');
  return true;
}

/**
 * Prompt user to confirm or override business type
 * @param {string} configBusinessType - Business type from config.json
 * @returns {Promise<string>} - Selected business type
 */
async function selectBusinessType(configBusinessType) {
  // If no business types discovered, use config value
  if (BUSINESS_TYPES.length === 0) {
    console.log(`  ⚠️  No business types found in assets. Using config value: ${configBusinessType}`);
    return configBusinessType;
  }

  // Check if config business type is valid
  const isConfigTypeValid = BUSINESS_TYPES.some((t) => t.key === configBusinessType);

  if (!isConfigTypeValid) {
    console.log(`  ⚠️  Business type "${configBusinessType}" from config not found in assets.`);
    console.log(`  📋 Available types: ${BUSINESS_TYPES.map((t) => t.key).join(', ')}`);
  }

  const { useConfigType } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useConfigType',
      message: `Usar business type do config (${configBusinessType})?`,
      default: isConfigTypeValid,
    },
  ]);

  if (useConfigType) {
    return configBusinessType;
  }

  // Let user choose from available business types
  const choices = BUSINESS_TYPES.map((t) => ({
    name: `${t.label} (${t.key})`,
    value: t.key,
  }));

  const { selectedType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedType',
      message: 'Qual business type deseja usar?',
      choices,
    },
  ]);

  return selectedType;
}

function performAssetCopy(sourceDir, businessType, clientConfig) {
  const backupDir = assetOps.cleanAssetsDir(ASSETS_DIR, BUSINESS_TYPES);

  try {
    assetOps.copyGeneralAssets(businessType, GENERAL_ASSETS_DIR, ASSETS_DIR, BUSINESS_TYPES);
    assetOps.copyClientAssets(sourceDir, ASSETS_DIR);

    // Process config JSON placeholders with client-specific values
    assetOps.processConfigPlaceholders(ASSETS_DIR, businessType, clientConfig);

    assetOps.copyFolderRecursiveSync(sourceDir, TARGET_ROOT, [
      'assets/client_specific_assets',
      'lib/src/utils/user_configs.dart',
      'lib/src/ui/core/theme_constants.dart',
    ]);

    assetOps.cleanupBackup(backupDir);
  } catch (error) {
    console.error('❌ Error during asset copy:', error.message);
    console.log('🔄 Restoring from backup...');
    throw error;
  }
}

function processAssets(businessType, clientConfig) {
  console.log('\n🎨 Processing assets...');

  if (!assetOps.runAssetValidation(businessType, PROJECT_ROOT)) {
    console.error('❌ Asset validation failed. Please check the assets manually.');
    process.exit(1);
  }

  assetOps.compressImages(TARGET_ROOT, PROJECT_ROOT);
  assetOps.optimizeLottieAnimations(PROJECT_ROOT);
  assetOps.generateAppIcons(TARGET_ROOT);

  // Update splash screen with client's primary color and transparent logo
  assetOps.updateSplashConfig(PUBSPEC_PATH, clientConfig);

  // Pass clientConfig to updatePubspecAssets so it can run updateiOSLaunchScreen
  // AFTER flutter_native_splash:create (which overwrites the storyboard)
  assetOps.updatePubspecAssets(businessType, PUBSPEC_PATH, BUSINESS_TYPES, TARGET_ROOT, clientConfig);
  assetOps.runFinalAssetValidation(businessType, PROJECT_ROOT);
}

/**
 * Copy Firebase configuration files from client folder to white_label_app
 * @param {string} clientCode - Client code/folder name
 * @param {Object} clientConfig - Client configuration object
 */
function copyFirebaseConfigs(clientCode, clientConfig) {
  console.log('\n🔥 Copying Firebase configuration files...');

  const clientDir = path.join(CLIENTS_DIR, clientCode);
  let copied = 0;
  let missing = [];

  // Clean up residual Firebase files in wrong locations
  const residualFiles = [
    path.join(TARGET_ROOT, 'android', 'google-services.json'), // should be in android/app/
    path.join(TARGET_ROOT, 'ios', 'GoogleService-Info.plist'), // should be in ios/Runner/
  ];

  residualFiles.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`  🗑️  Removido arquivo residual: ${path.relative(TARGET_ROOT, filePath)}`);
    }
  });

  // Android: google-services.json (check multiple possible locations)
  const androidPossiblePaths = [
    path.join(clientDir, 'android', 'google-services.json'),
    path.join(clientDir, 'google-services.json'), // fallback: root of client folder
  ];
  const androidDest = path.join(TARGET_ROOT, 'android', 'app', 'google-services.json');

  const androidSource = androidPossiblePaths.find((p) => fs.existsSync(p));
  if (androidSource) {
    fs.copyFileSync(androidSource, androidDest);
    const relativePath = path.relative(clientDir, androidSource);
    console.log(`  ✅ google-services.json copiado para android/app/ (de ${relativePath})`);
    copied++;
  } else {
    missing.push('google-services.json');
  }

  // iOS: GoogleService-Info.plist (check multiple possible locations)
  const iosPossiblePaths = [
    path.join(clientDir, 'ios', 'Runner', 'GoogleService-Info.plist'),
    path.join(clientDir, 'ios', 'GoogleService-Info.plist'),
    path.join(clientDir, 'GoogleService-Info.plist'),
  ];
  const iosDest = path.join(TARGET_ROOT, 'ios', 'Runner', 'GoogleService-Info.plist');

  const iosSource = iosPossiblePaths.find((p) => fs.existsSync(p));
  if (iosSource) {
    fs.copyFileSync(iosSource, iosDest);
    const relativePath = path.relative(clientDir, iosSource);
    console.log(`  ✅ GoogleService-Info.plist copiado para ios/Runner/ (de ${relativePath})`);
    copied++;
  } else {
    missing.push('ios/Runner/GoogleService-Info.plist');
  }

  // Dart: firebase_options.dart
  const dartPossiblePaths = [
    path.join(clientDir, 'lib', 'firebase_options.dart'),
    path.join(clientDir, 'firebase_options.dart'),
  ];
  const dartDest = path.join(TARGET_ROOT, 'lib', 'firebase_options.dart');

  const dartSource = dartPossiblePaths.find((p) => fs.existsSync(p));
  if (dartSource) {
    fs.copyFileSync(dartSource, dartDest);
    const relativePath = path.relative(clientDir, dartSource);
    console.log(`  ✅ firebase_options.dart copiado para lib/ (de ${relativePath})`);
    copied++;
  } else {
    // Try to generate firebase_options.dart automatically if we have a projectId
    const projectId = clientConfig.firebaseOptions?.projectId;
    if (projectId) {
      console.log(`  ⚠️  firebase_options.dart não encontrado, gerando automaticamente...`);
      try {
        const { execSync } = require('child_process');
        execSync(`flutterfire configure --project=${projectId} --out=lib/firebase_options.dart --yes`, {
          cwd: TARGET_ROOT,
          stdio: 'inherit',
          timeout: 180000, // 3 minutes
        });
        console.log('  ✅ firebase_options.dart gerado automaticamente');

        // Copy the generated file to the client folder for future use
        if (fs.existsSync(dartDest)) {
          const clientLibDir = path.join(clientDir, 'lib');
          if (!fs.existsSync(clientLibDir)) {
            fs.mkdirSync(clientLibDir, { recursive: true });
          }
          fs.copyFileSync(dartDest, path.join(clientLibDir, 'firebase_options.dart'));
          console.log('  ✅ firebase_options.dart salvo na pasta do cliente para uso futuro');
        }
        copied++;
      } catch (error) {
        console.error(`  ❌ Falha ao gerar firebase_options.dart: ${error.message}`);
        missing.push('lib/firebase_options.dart');
      }
    } else {
      missing.push('lib/firebase_options.dart');
    }
  }

  // Report results
  if (missing.length > 0) {
    console.log('\n  ⚠️  ATENÇÃO: Arquivos Firebase não encontrados no cliente:');
    missing.forEach((file) => console.log(`     - ${file}`));
    console.log('\n  📋 Para corrigir, execute para baixar os arquivos:');
    console.log(`     cd clients/${clientCode}`);
    console.log(`     firebase apps:sdkconfig android --project <project-id> > android/google-services.json`);
    console.log(`     firebase apps:sdkconfig ios --project <project-id> > ios/Runner/GoogleService-Info.plist`);
    console.log('\n  💡 Para regenerar firebase_options.dart:');
    console.log(`     cd white_label_app && flutterfire configure --project=<project-id>`);
    console.log('\n  ⚠️  O app pode não funcionar corretamente sem esses arquivos!');
  }

  if (copied > 0) {
    console.log(`\n  ✅ ${copied} arquivo(s) Firebase copiado(s)`);
  }
}

/**
 * Copy and process firebase.json from client folder to white_label_app
 * This includes the flutter.platforms section needed for FlutterFire CLI
 * @param {string} clientCode - Client code/folder name
 * @param {Object} clientConfig - Client configuration object
 */
function copyFirebaseJson(clientCode, clientConfig) {
  console.log('\n🔥 Copying firebase.json with flutter.platforms...');

  const sourcePath = path.join(CLIENTS_DIR, clientCode, 'firebase.json');
  const targetPath = path.join(TARGET_ROOT, 'firebase.json');

  if (!fs.existsSync(sourcePath)) {
    console.log('  ⚠️  firebase.json não encontrado no cliente');
    console.log('     FlutterFire CLI pode falhar durante upload de símbolos Crashlytics');
    return;
  }

  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

    // Ensure flutter.platforms section exists (required for FlutterFire CLI)
    if (!firebaseConfig.flutter?.platforms) {
      console.log('  ⚠️  flutter.platforms não encontrado no firebase.json do cliente');
      console.log('     Gerando a partir do config.json...');

      const { firebaseOptions } = clientConfig;
      if (firebaseOptions) {
        firebaseConfig.flutter = {
          platforms: {
            android: {
              default: {
                projectId: firebaseOptions.projectId,
                appId: firebaseOptions.appId,
                fileOutput: 'android/app/google-services.json',
              },
            },
            ios: {
              default: {
                projectId: firebaseOptions.projectId,
                appId: firebaseOptions.iosAppId || firebaseOptions.appId,
                uploadDebugSymbols: true,
                fileOutput: 'ios/Runner/GoogleService-Info.plist',
              },
            },
            dart: {
              'lib/firebase_options.dart': {
                projectId: firebaseOptions.projectId,
                configurations: {
                  android: firebaseOptions.appId,
                  ios: firebaseOptions.iosAppId || firebaseOptions.appId,
                },
              },
            },
          },
        };
        console.log('  ✅ flutter.platforms gerado a partir do config.json');
      }
    }

    fs.writeFileSync(targetPath, JSON.stringify(firebaseConfig, null, 2) + '\n');
    console.log('  ✅ firebase.json copiado para white_label_app/');
  } catch (error) {
    console.error('  ❌ Erro ao processar firebase.json:', error.message);
  }
}

/**
 * Copy Shorebird configuration from client folder to white_label_app
 * @param {string} clientCode - Client code/folder name
 */
function copyShorebirdConfig(clientCode) {
  console.log('\n🐦 Copying Shorebird configuration...');

  const sourcePath = path.join(CLIENTS_DIR, clientCode, 'shorebird.yaml');
  const targetPath = path.join(TARGET_ROOT, 'shorebird.yaml');

  if (fs.existsSync(sourcePath)) {
    // Read and check if it's a placeholder
    const content = fs.readFileSync(sourcePath, 'utf8');
    fs.copyFileSync(sourcePath, targetPath);

    if (content.includes('placeholder-')) {
      console.log('  ⚠️  shorebird.yaml copiado (app_id é placeholder)');
      console.log('     Execute "cd white_label_app && shorebird init" para gerar app_id real');
    } else {
      console.log('  ✅ shorebird.yaml copiado para white_label_app/');
    }
  } else {
    console.log('  ⚠️  shorebird.yaml não encontrado para este cliente');
    console.log('     OTA updates via Shorebird não estarão disponíveis');
  }
}

/**
 * Generate package_rename_config.yaml from config.json
 * This ensures CFBundleDisplayName always matches the appName from config.json
 * which should match the App Store Connect name
 * @param {Object} clientConfig - Client configuration object
 */
function generatePackageRenameConfig(clientConfig) {
  console.log('\n📦 Generating package_rename_config.yaml from config.json...');

  const { appName, bundleId } = clientConfig;

  if (!appName || !bundleId) {
    console.error('  ❌ ERRO: appName ou bundleId não encontrado no config.json');
    return;
  }

  // Extract bundle name from bundleId (e.g., "lv.club.loyaltyhub.narede" -> "loyaltyhubnarede")
  const bundleParts = bundleId.split('.');
  const bundleName = bundleParts.slice(Math.max(bundleParts.length - 2, 1)).join('');

  const yamlContent = `package_rename_config:
  android:
    app_name: ${appName}
    package_name: ${bundleId}

  ios:
    app_name: ${appName}
    bundle_name: ${bundleName}
    package_name: ${bundleId}
`;

  const targetPath = path.join(TARGET_ROOT, 'package_rename_config.yaml');
  fs.writeFileSync(targetPath, yamlContent, 'utf8');

  console.log(`  ✅ package_rename_config.yaml gerado com app_name: "${appName}"`);
  console.log('  📱 CFBundleDisplayName será atualizado para corresponder ao App Store Connect');
}

/**
 * Save updated config.json to white_label_app after businessType override
 * This ensures the config.json reflects the user's selected businessType,
 * not the original value from the client folder.
 * @param {object} clientConfig - Updated client configuration
 */
function saveUpdatedConfig(clientConfig) {
  const configPath = path.join(TARGET_ROOT, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(clientConfig, null, 2) + '\n', 'utf8');
  console.log(`  ✅ config.json atualizado com businessType: ${clientConfig.businessType}`);
}

function displaySuccessSummary() {
  console.log('\n✅ White label setup completed successfully!');
  console.log('📊 Summary:');
  console.log('  ✅ Assets validated and copied');
  console.log('  ✅ Images compressed');
  console.log('  ✅ Icons generated (if applicable)');
  console.log('  ✅ Splash screen configured (primary color + transparent logo)');
  console.log('  ✅ Pubspec updated');
  console.log('  ✅ Android keystore configured');
  console.log('  ✅ Firebase configs copied (if available)');
  console.log('  ✅ firebase.json with flutter.platforms configured');
  console.log('  ✅ config.json updated with selected businessType');
  console.log('  ✅ Old Kotlin packages cleaned');
  console.log('  ✅ package_rename_config.yaml regenerated from config.json');
  console.log('  ✅ Bundle ID and app name updated via package_rename');
  console.log('  ✅ Flutter build cleaned');
  console.log('  ✅ iOS pods reinstalled');
  console.log('  ✅ Xcode caches cleaned');
  console.log('  ✅ Shorebird config copied (if available)');
  console.log('  ✅ Post-setup validation (Firebase + native configs)');
  console.log(
    '\n💡 Note: If you have Xcode open, please close and reopen it to see the updated Bundle ID'
  );
  console.log(
    '📱 The CFBundleDisplayName now matches the appName from config.json (App Store Connect name)'
  );
}

/**
 * Main setup function
 * @param {string|null} clientArg - Client code from command line argument
 */
async function main(clientArg) {
  try {
    validateLoyaltyCredentialsRepo();
    loadBusinessTypesFromAssets();

    console.log('🔍 Validating assets structure...');
    const validation = assetOps.validateAssetsStructure(
      GENERAL_ASSETS_DIR,
      CLIENTS_DIR,
      BUSINESS_TYPES
    );
    if (!assetOps.displayValidationResults(validation)) {
      console.error('❌ Critical asset structure issues found. Please fix them before continuing.');
      process.exit(1);
    }

    const client = await selectClient(clientArg);
    const sourceDir = path.join(CLIENTS_DIR, client);

    console.log(`\n📋 Loading client configuration...`);
    const clientConfig = templateGen.loadClientConfig(client, CLIENTS_DIR);
    console.log(`  ✅ Loaded config for: ${clientConfig.clientName}`);
    console.log(`  📊 Business type (config): ${clientConfig.businessType}`);

    // Allow user to confirm or override business type
    const businessType = await selectBusinessType(clientConfig.businessType);
    console.log(`  ✅ Using business type: ${businessType}`);
    validateBusinessType(businessType);

    // Update clientConfig with selected business type (for template generation)
    clientConfig.businessType = businessType;

    templateGen.generateDartFiles(clientConfig, TARGET_ROOT, TEMPLATES_DIR);

    performAssetCopy(sourceDir, businessType, clientConfig);

    // Save updated config.json with potentially overridden businessType
    // This must happen AFTER performAssetCopy since copyFolderRecursiveSync copies the original
    saveUpdatedConfig(clientConfig);

    processAssets(businessType, clientConfig);

    keystoreOps.copyAndroidKeystore(TARGET_ROOT, client);
    copyFirebaseConfigs(client, clientConfig);
    copyFirebaseJson(client, clientConfig);
    copyShorebirdConfig(client);
    generatePackageRenameConfig(clientConfig);
    iosOps.postProcess(TARGET_ROOT);

    // Post-setup validation: verify Firebase and native configs are consistent
    const validationPassed = postSetupValidator.runPostSetupValidation(clientConfig);

    displaySuccessSummary();

    if (!validationPassed) {
      console.log('\n⚠️  Setup concluído com avisos de validação. Verifique os erros acima.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

/**
 * Select client from list or argument
 * @param {string|null} clientArg - Client code from command line argument
 */
async function selectClient(clientArg) {
  return await clientSelector.selectClientOrPrompt(clientArg, {
    message: 'Digite o número do cliente:',
  });
}

// Entry point
const { clientArg, deployMode } = parseArguments();
const mode = deployMode ? SETUP_MODE.DEPLOY : SETUP_MODE.FULL;

if (mode === SETUP_MODE.DEPLOY) {
  console.log('🚀 Running white label setup in DEPLOY mode (validation only)');
  if (!clientArg) {
    console.error('❌ ERRO: Deploy mode requer o código do cliente como argumento');
    console.error('   Uso: npm run start -- <client-code> --deploy-mode');
    process.exit(1);
  }
  validateDeployPrerequisites(clientArg);
} else {
  console.log('🚀 Running white label setup in FULL mode');
  main(clientArg);
}
