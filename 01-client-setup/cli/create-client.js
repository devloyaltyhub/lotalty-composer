#!/usr/bin/env node

// Load environment variables FIRST
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// Resolve credential paths to absolute paths (relative to automation root)
const path = require('path');
const automationRoot = path.resolve(__dirname, '../..');

// Helper function to resolve credential paths
function resolveCredentialPath(envVar) {
  let value = process.env[envVar];
  if (!value) return;

  // Expand environment variables like $HOME, $USER, etc.
  value = value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    return process.env[varName] || match;
  });

  // Resolve relative paths
  if (!path.isAbsolute(value)) {
    value = path.resolve(automationRoot, value);
  }

  process.env[envVar] = value;
}

// Resolve all credential-related environment variables
resolveCredentialPath('MASTER_FIREBASE_SERVICE_ACCOUNT');
resolveCredentialPath('GOOGLE_APPLICATION_CREDENTIALS');
resolveCredentialPath('GOOGLE_PLAY_JSON_KEY');
resolveCredentialPath('APP_STORE_CONNECT_API_KEY');

const inquirer = require('inquirer');
const fs = require('fs');
const chalk = require('chalk');
const admin = require('firebase-admin');
const logger = require('../../shared/utils/logger');
const telegram = require('../../shared/utils/telegram');
const preflightCheck = require('../../shared/utils/preflight-check');
const errorHandler = require('../../shared/utils/error-handler');
const ResourceTracker = require('../../shared/utils/resource-tracker');
const CheckpointManager = require('../../shared/utils/checkpoint-manager');
const FirebaseProjectCreator = require('../steps/create-firebase-project');
const firebaseClient = require('../shared/firebase-manager');
const DataSeeder = require('../steps/seed-firestore-data');
const { StorageImporter } = require('../../03-data-management');
const AdminUserCreator = require('../steps/create-admin-user');
const GitBranchManager = require('../steps/create-git-branch');
const MetadataGenerator = require('../steps/generate-metadata');
const { BusinessTypeRepository } = require('../shared/business-type-manager');
const RemoteConfigSetup = require('../steps/setup-remote-config');
const {
  validateClientCode,
  validateEmail,
  validateBundleId,
  validateHexColor,
} = require('../shared/input-validator');
const AndroidCredentialsSetup = require('../steps/setup-android-credentials');
const {
  generateAppCheckInstructions,
  registerAppCheckFingerprints,
} = require('../steps/register-app-check');
const GitCredentialsManager = require('../steps/git-credentials-manager');
const IOSCertificateSetup = require('../steps/setup-ios-certificates');
const ClientHealthCheck = require('./verify-client');
const {
  generatePushNotificationsInstructions,
  displayPushNotificationsManualSteps,
  APNsKeyCreator,
} = require('../steps/setup-push-notifications');

class ClientCreationWizard {
  constructor() {
    this.startTime = null;
    this.config = {};
    this.resourceTracker = new ResourceTracker();
    this.checkpointManager = null; // Initialized after we know clientCode
    this.completedSteps = new Set();
  }

  // Step 1: Collect client information
  async collectClientInfo() {
    logger.section('Client Information');

    // Get available business types dynamically
    const availableBusinessTypes = BusinessTypeRepository.getExistingTypes();

    if (availableBusinessTypes.length === 0) {
      logger.error('No business types found! Please create at least one business type first.');
      logger.info('Run: npm run create-business-type');
      process.exit(1);
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'clientCode',
        message: 'Client Code (e.g., "na-rede", "acme-corp"):',
        validate: (input) => {
          try {
            // SECURITY FIX: Use centralized validation to prevent injection and path traversal
            validateClientCode(input);
            return true;
          } catch (error) {
            return error.message;
          }
        },
      },
      {
        type: 'input',
        name: 'clientName',
        message: 'Client Display Name (e.g., "Na Rede"):',
        validate: (input) => {
          if (!input.trim()) return 'Client name is required';
          if (input.trim().length < 4)
            return 'Client name must be at least 4 characters (Google Cloud Platform requirement)';
          return true;
        },
      },
      {
        type: 'input',
        name: 'bundleId',
        message: 'Bundle ID (complete with your client name):',
        default: 'lv.club.loyaltyhub.',
        validate: (input) => {
          try {
            // SECURITY FIX: Use centralized validation
            validateBundleId(input);
            return true;
          } catch (error) {
            return error.message;
          }
        },
      },
      {
        type: 'input',
        name: 'appName',
        message: 'App Display Name:',
        validate: (input) => input.trim().length > 0 || 'App name is required',
      },
      {
        type: 'input',
        name: 'loversName',
        message: 'Nome dos "lovers" da loja (ex: "Na Redeiros", "Biriteiros", "Cafeinados"):',
        validate: (input) => input.trim().length > 0 || 'Lovers name is required',
      },
      {
        type: 'input',
        name: 'adminEmail',
        message: 'Admin Email:',
        default: (answers) => {
          // Normalize client code: lowercase, remove special characters
          const normalizedCode = answers.clientCode.toLowerCase().replace(/[^a-z0-9-]/g, '');
          return `${normalizedCode}@loyaltyhub.club`;
        },
        validate: (input) => {
          try {
            // SECURITY FIX: Use centralized validation
            validateEmail(input);
            return true;
          } catch (error) {
            return error.message;
          }
        },
      },
      {
        type: 'list',
        name: 'businessType',
        message: 'Business Type:',
        choices: availableBusinessTypes.map((type) => ({
          name: `${type.label} (${type.key})`,
          value: type.key,
        })),
      },
      {
        type: 'input',
        name: 'primaryColor',
        message: 'Primary Brand Color (hex, e.g., "#FF5733"):',
        default: '#FF5733',
        validate: (input) => {
          try {
            // SECURITY FIX: Use centralized validation
            validateHexColor(input);
            return true;
          } catch (error) {
            return error.message;
          }
        },
      },
      {
        type: 'checkbox',
        name: 'featureFlags',
        message: 'Select features to enable for this client:',
        choices: [
          { name: 'Delivery', value: 'delivery', checked: false },
          { name: 'Club/Loyalty Program', value: 'club', checked: true },
          { name: 'Happy Hour', value: 'happyHour', checked: true },
          { name: 'Campaigns', value: 'campaigns', checked: true },
          { name: 'Store Hours', value: 'storeHours', checked: true },
          { name: 'Push Notifications', value: 'pushNotifications', checked: true },
          { name: 'Suggestion Box', value: 'suggestionBox', checked: true },
          { name: 'Clarity Analytics', value: 'clarity', checked: true },
          { name: 'Our Story', value: 'ourStory', checked: true },
        ],
      },
      {
        type: 'input',
        name: 'clarityProjectId',
        message: 'Microsoft Clarity Project ID (required):',
        validate: (input) => {
          if (!input.trim()) return 'Clarity Project ID is required';
          return true;
        },
      },
      {
        type: 'input',
        name: 'tinifyApiKey',
        message: 'TinyPNG API Key (for image compression, optional):',
        default: '',
      },
    ]);

    // Convert feature flags array to object
    const featureFlagsObject = {
      delivery: answers.featureFlags.includes('delivery'),
      club: answers.featureFlags.includes('club'),
      happyHour: answers.featureFlags.includes('happyHour'),
      campaigns: answers.featureFlags.includes('campaigns'),
      storeHours: answers.featureFlags.includes('storeHours'),
      pushNotifications: answers.featureFlags.includes('pushNotifications'),
      suggestionBox: answers.featureFlags.includes('suggestionBox'),
      clarity: answers.featureFlags.includes('clarity'),
      ourStory: answers.featureFlags.includes('ourStory'),
    };
    answers.featureFlags = featureFlagsObject;

    // Set default URLs (same for all clients)
    answers.websiteUrl = 'https://www.loyaltyhub.club';
    answers.supportUrl = 'https://www.loyaltyhub.club/contact';
    answers.privacyUrl = 'https://www.loyaltyhub.club/legal#privacy';

    // Use clientCode as folder name (they are always the same)
    answers.folderName = answers.clientCode;

    // Generate Firebase project ID with format: {code}-lhc-{random}
    // GCP project IDs must be at most 30 characters long
    const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    answers.firebaseProjectId = `${answers.clientCode}-lhc-${randomSuffix}`;

    // Validate project ID length (GCP limit is 30 characters)
    if (answers.firebaseProjectId.length > 30) {
      logger.error(
        `Firebase Project ID is too long (${answers.firebaseProjectId.length} chars, max 30)`
      );
      logger.error(`Generated ID: ${answers.firebaseProjectId}`);
      logger.error(`Please use a shorter client code (max ${30 - 9} characters)`);
      process.exit(1);
    }

    this.config = answers;

    // Check if client code already exists
    const exists = await firebaseClient.clientExists(answers.clientCode);
    if (exists) {
      logger.error(`Client code ${answers.clientCode} already exists!`);
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Client already exists. Continue anyway?',
          default: false,
        },
      ]);

      if (!overwrite) {
        process.exit(1);
      }
    }

    return answers;
  }

  // Step 2: Confirm creation
  async confirmCreation() {
    logger.blank();
    logger.subSection('Review Configuration');
    logger.keyValue('Client Name', this.config.clientName);
    logger.keyValue('Client Code', this.config.clientCode);
    logger.keyValue('Bundle ID', this.config.bundleId);
    logger.keyValue('Firebase Project', this.config.firebaseProjectId);
    logger.keyValue('Admin Email', this.config.adminEmail);
    logger.blank();

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Create this client?',
        default: true,
      },
    ]);

    if (!confirmed) {
      logger.warn('Client creation cancelled');
      process.exit(0);
    }
  }

  // Step 3: Create Firebase project
  async createFirebaseProject() {
    logger.section('Firebase Project Setup');

    await telegram.clientCreationStarted(this.config.clientName, this.config.clientCode);

    const clientFolder = path.join(process.cwd(), 'clients', this.config.folderName);

    const creator = new FirebaseProjectCreator();
    const result = await creator.setupCompleteProject({
      projectId: this.config.firebaseProjectId,
      displayName: this.config.clientName,
      bundleIdAndroid: this.config.bundleId,
      bundleIdIos: this.config.bundleId,
      appName: this.config.appName,
      clientFolder,
    });

    this.config.firebaseOptions = result.firebaseOptions;
    this.config.clientFolder = clientFolder;
    this.config.serviceAccountPath = result.serviceAccountPath;

    await telegram.firebaseProjectCreated(this.config.clientName, this.config.firebaseProjectId);

    return result;
  }

  // Step 4: Save to Master Firebase
  async saveToMasterFirebase() {
    logger.section('Saving to Master Firebase');

    firebaseClient.initializeMasterFirebase();

    await firebaseClient.saveClientToMaster(
      this.config.clientCode,
      this.config.firebaseOptions,
      true,
      this.config.tinifyApiKey || null
    );

    logger.success('Client saved to Master Firebase');
  }

  // Step 5: Deploy Firestore rules
  async deployFirestoreRules() {
    logger.section('Deploying Firestore Security Rules');

    const rulesPath = path.join(__dirname, '../../shared/templates/firestore.rules');
    const tempRulesPath = path.join(this.config.clientFolder, 'firestore.rules');

    // Copy rules to client folder
    fs.copyFileSync(rulesPath, tempRulesPath);

    // Create firebase.json if it doesn't exist
    const firebaseJsonPath = path.join(this.config.clientFolder, 'firebase.json');
    if (!fs.existsSync(firebaseJsonPath)) {
      const firebaseJson = {
        firestore: {
          rules: 'firestore.rules',
        },
      };
      fs.writeFileSync(firebaseJsonPath, JSON.stringify(firebaseJson, null, 2));
    }

    // Deploy rules
    await firebaseClient.deployFirestoreRules(this.config.firebaseProjectId, tempRulesPath);

    logger.success('Firestore rules deployed');
  }

  // Step 5.5: Setup Remote Config
  async setupRemoteConfig() {
    logger.section('Setting up Firebase Remote Config');

    // Initialize client Firebase connection if not already done
    if (!firebaseClient.apps.has(this.config.clientCode)) {
      await firebaseClient.initializeClientFirebase(
        this.config.clientCode,
        this.config.firebaseOptions,
        this.config.serviceAccountPath
      );
    }

    const remoteConfigSetup = new RemoteConfigSetup(
      firebaseClient.apps.get(this.config.clientCode)
    );

    const remoteConfigData = await remoteConfigSetup.setupRemoteConfig({
      featureFlags: this.config.featureFlags,
      clarityProjectId: this.config.clarityProjectId,
      clientCode: this.config.clientCode,
    });

    // Store remote config data in config for later use
    this.config.remoteConfig = remoteConfigData;

    logger.success('Remote Config setup completed');
  }

  // Step 6: Seed default data
  async seedDefaultData() {
    logger.section('Seeding Default Data');

    // Use the client-specific service account for authentication
    await firebaseClient.initializeClientFirebase(
      this.config.clientCode,
      this.config.firebaseOptions,
      this.config.serviceAccountPath
    );

    const clientApp = firebaseClient.apps.get(this.config.clientCode);
    const targetBucket = this.config.firebaseOptions.storageBucket;
    const seeder = new DataSeeder(clientApp, targetBucket);

    if (seeder.hasSnapshot()) {
      logger.info('Usando snapshot do demo project...');

      // 1. Upload Storage files first and get URL mapping
      let urlMapping = {};
      logger.startSpinner('Importando arquivos do Storage...');
      try {
        const storageImporter = new StorageImporter(clientApp, targetBucket);
        urlMapping = await storageImporter.importAll();
        logger.succeedSpinner('Arquivos do Storage importados');
      } catch (error) {
        logger.failSpinner(`Erro ao importar Storage: ${error.message}`);
        // Continue anyway - Firestore data can work without images
      }

      // 2. Seed Firestore data (with URLs mapped to new bucket with valid tokens)
      await seeder.seedFromSnapshot(urlMapping);

      // Store seeder reference for later test user configuration
      this.seeder = seeder;
    } else {
      logger.warn('Snapshot não encontrado. Usando dados básicos...');
      await seeder.seedWithDefaults(
        this.config.clientName,
        this.config.businessType,
        this.config.primaryColor
      );
    }

    logger.success('Default data seeded');
  }

  // Step 6b: Create and configure test user
  // This creates the test user in Firebase Auth and migrates the demo user data to match
  async createTestUser() {
    logger.section('Creating Test User');

    const testEmail = 'contato@loyaltyhub.club';
    const testPassword = 'LoyaltyHub2024!';

    const clientApp = firebaseClient.apps.get(this.config.clientCode);
    const auth = admin.auth(clientApp);

    let testUserUid = null;

    try {
      // Try to get existing user
      const existingUser = await auth.getUserByEmail(testEmail);
      testUserUid = existingUser.uid;
      logger.info(`Usuário de teste existente encontrado: ${testUserUid}`);
    } catch {
      // User doesn't exist, create it
      try {
        const newUser = await auth.createUser({
          email: testEmail,
          password: testPassword,
          displayName: 'Loyalty Hub User',
          emailVerified: true,
        });
        testUserUid = newUser.uid;
        logger.info(`Usuário de teste criado: ${testUserUid}`);
      } catch (createError) {
        logger.warn(`Falha ao criar usuário de teste: ${createError.message}`);
        return;
      }
    }

    // Configure test user (migrate demo user data to this UID)
    if (testUserUid && this.seeder) {
      await this.seeder.configureTestUser(testUserUid);
    }

    // Store test user credentials
    this.config.testUserCredentials = {
      email: testEmail,
      password: testPassword,
      uid: testUserUid,
    };

    logger.success('Test user configured');
  }

  // Step 7: Create admin user
  async createAdminUser() {
    logger.section('Creating Admin User');

    const creator = new AdminUserCreator(firebaseClient.apps.get(this.config.clientCode));
    const result = await creator.createAndNotify({
      email: this.config.adminEmail,
      name: 'Admin',
      clientCode: this.config.clientCode,
      clientName: this.config.folderName,
      clientFolder: this.config.clientFolder,
      sendTelegram: true,
      displayNow: false, // Don't display now - will show at the end
    });

    this.config.adminCredentials = {
      email: result.email,
      password: result.password,
    };

    logger.success('Admin user created');
  }

  // Step 8: Commit client config to main
  async commitClientConfig() {
    logger.section('Saving Client Configuration to Git');

    const gitManager = new GitBranchManager();

    const result = await gitManager.commitClientToMain(this.config.folderName);

    this.config.commitHash = result.commitHash;

    logger.success('Client configuration committed to main');
  }

  // Step 9: Generate app store metadata
  async generateMetadata() {
    const locale = this.config.locale || 'pt-BR';
    const generator = new MetadataGenerator(this.config.clientFolder, locale);

    await generator.generateAll({
      clientName: this.config.clientName,
      appDisplayName: this.config.appName,
      businessType: this.config.businessType,
      adminEmail: this.config.adminEmail,
      supportUrl: this.config.supportUrl || '',
      marketingUrl: this.config.websiteUrl || '',
      websiteUrl: this.config.websiteUrl || '',
      privacyUrl: this.config.privacyUrl || '',
    });

    logger.success('App store metadata generated');
  }

  // Helper: Generate color palette from primary color
  generateColorPalette(primaryColor) {
    // Parse hex color
    const hex = primaryColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Generate lighter version (increase brightness by ~30%)
    const lighten = (value) => Math.min(255, Math.floor(value + (255 - value) * 0.3));
    const primaryLight =
      `#${lighten(r).toString(16).padStart(2, '0')}${lighten(g).toString(16).padStart(2, '0')}${lighten(b).toString(16).padStart(2, '0')}`.toUpperCase();

    return {
      dark: '#000000',
      darkContrast: '#A8A8A8',
      light: '#FFFFFF',
      primary: primaryColor.toUpperCase(),
      primaryLight: primaryLight,
      warning: '#F57C00',
      error: '#EA4C46',
      backgroundPage: '#F5F5F5',
      dividerGrey: '#EAEAEA',
      buttonBorder: '#DEDEDE',
      searchBarBackground: '#FFFFFF1A',
      gradientDark: '#131313',
      gradientContrast: '#303030',
    };
  }

  // Helper: Get company hint from business type
  getCompanyHintFromBusinessType(businessType) {
    const hints = {
      coffee: 'Café',
      beer: 'Cervejaria',
      sportfood: 'Club',
      restaurant: 'Restaurante',
      retail: 'Loja',
      gym: 'Academia',
    };
    return hints[businessType] || 'Club';
  }

  // Step 10: Save local config
  saveLocalConfig() {
    logger.section('Saving Local Configuration');

    const configData = {
      clientCode: this.config.clientCode,
      clientName: this.config.clientName,
      bundleId: this.config.bundleId,
      appName: this.config.appName,
      loversName: this.config.loversName,
      companyHint: this.getCompanyHintFromBusinessType(this.config.businessType),
      businessType: this.config.businessType,
      firebaseProjectId: this.config.firebaseProjectId,
      adminEmail: this.config.adminEmail,
      locale: this.config.locale || 'pt-BR',
      storeUrls: {
        android: '',
        ios: '',
      },
      colors: this.generateColorPalette(this.config.primaryColor),
      firebaseOptions: this.config.firebaseOptions,
      remoteConfig: this.config.remoteConfig || {
        featureFlags: this.config.featureFlags || {},
        clarityProjectId: this.config.clarityProjectId || '',
        versionarte: {
          android: {
            version: {
              minimum: '1.0.0',
              latest: '0.0.1',
            },
            download_url: '',
            status: {
              active: true,
              message: {
                pt: 'O Aplicativo está em manutenção. Por favor, tente mais tarde.',
              },
            },
          },
          iOS: {
            version: {
              minimum: '1.0.0',
              latest: '0.0.1',
            },
            download_url: '',
            status: {
              active: true,
              message: {
                pt: 'O Aplicativo está em manutenção. Por favor, tente mais tarde.',
              },
            },
          },
        },
      },
      metadata: {
        websiteUrl: this.config.websiteUrl || 'https://www.loyaltyhub.club',
        supportUrl: this.config.supportUrl || 'https://www.loyaltyhub.club/contact',
        privacyUrl: this.config.privacyUrl || 'https://www.loyaltyhub.club/legal#privacy',
        shortDescription: `Rewards Hub ${this.config.clientName}`,
        fullDescription: `Aplicativo Rewards Hub ${this.config.clientName}`,
        keywords: `fidelidade,loyalty,rewards,${this.config.clientCode}`,
      },
      createdAt: new Date().toISOString(),
      createdBy: 'automation',
      version: '1.0.0',
      environment: 'development',
    };

    const configPath = path.join(this.config.clientFolder, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');

    logger.success(`Config saved: ${configPath}`);
  }

  // Step 10b: Create package_rename_config.yaml
  createPackageRenameConfig() {
    logger.section('Creating package_rename_config.yaml');

    // Extract bundle name from bundleId (e.g., "club.loyaltyhub.demo" -> "loyaltyhubdemo")
    const bundleName = this.config.bundleId
      .split('.')
      .slice(1) // Remove first part (club)
      .join(''); // Join remaining parts without dots

    const yamlContent = `package_rename_config:
  android:
    app_name: ${this.config.appName}
    package_name: ${this.config.bundleId}

  ios:
    app_name: ${this.config.appName}
    bundle_name: ${bundleName}
    package_name: ${this.config.bundleId}
`;

    const yamlPath = path.join(this.config.clientFolder, 'package_rename_config.yaml');
    fs.writeFileSync(yamlPath, yamlContent, 'utf8');

    logger.success(`package_rename_config.yaml created: ${yamlPath}`);
  }

  // Step 10c: Copy business type assets
  copyBusinessTypeAssets() {
    logger.section('Copying Business Type Assets');

    const assetsDir = path.join(this.config.clientFolder, 'assets');
    const clientSpecificDir = path.join(assetsDir, 'client_specific_assets');

    // Create directories
    if (!fs.existsSync(clientSpecificDir)) {
      fs.mkdirSync(clientSpecificDir, { recursive: true });
      logger.info(`Created directory: ${clientSpecificDir}`);
    }

    // Try to copy logo templates from business type shared assets
    const sharedAssetsDir = path.join(__dirname, '../../shared/shared_assets');
    const businessTypeImagesDir = path.join(sharedAssetsDir, 'images', this.config.businessType);

    let copiedFromBusinessType = false;

    // Try to find logo files in business type images
    if (fs.existsSync(businessTypeImagesDir)) {
      const logoFile = path.join(businessTypeImagesDir, 'logo.png');
      const transparentLogoFile = path.join(businessTypeImagesDir, 'transparent-logo.png');

      if (fs.existsSync(logoFile)) {
        fs.copyFileSync(logoFile, path.join(clientSpecificDir, 'logo.png'));
        logger.info('Copied logo.png from business type');
        copiedFromBusinessType = true;
      }

      if (fs.existsSync(transparentLogoFile)) {
        fs.copyFileSync(transparentLogoFile, path.join(clientSpecificDir, 'transparent-logo.png'));
        logger.info('Copied transparent-logo.png from business type');
        copiedFromBusinessType = true;
      }
    }

    // If business type doesn't have logos, copy from demo as placeholder
    if (!copiedFromBusinessType) {
      logger.warn(`Business type ${this.config.businessType} doesn't have logo templates`);
      logger.info('Copying placeholders from demo client...');

      const demoAssetsDir = path.join(
        process.cwd(),
        'clients',
        'demo',
        'assets',
        'client_specific_assets'
      );

      if (fs.existsSync(demoAssetsDir)) {
        const demoLogo = path.join(demoAssetsDir, 'logo.png');
        const demoTransparentLogo = path.join(demoAssetsDir, 'transparent-logo.png');

        if (fs.existsSync(demoLogo)) {
          fs.copyFileSync(demoLogo, path.join(clientSpecificDir, 'logo.png'));
          logger.info('Copied placeholder logo.png from demo');
        }

        if (fs.existsSync(demoTransparentLogo)) {
          fs.copyFileSync(
            demoTransparentLogo,
            path.join(clientSpecificDir, 'transparent-logo.png')
          );
          logger.info('Copied placeholder transparent-logo.png from demo');
        }
      } else {
        logger.error('Demo assets not found - please add logos manually');
        // Create empty placeholder files
        const placeholderPath = path.join(clientSpecificDir, 'PLEASE_ADD_LOGOS_HERE.txt');
        fs.writeFileSync(
          placeholderPath,
          'Please add logo.png and transparent-logo.png to this directory.\n\nRequired files:\n- logo.png (app icon and branding)\n- transparent-logo.png (transparent background version)',
          'utf8'
        );
        logger.warn('Created placeholder reminder file');
      }
    }

    logger.success('Business type assets copied');
  }

  // Generate Android Keystore for App Check
  async generateAndroidKeystore() {
    logger.section('Generating Android Keystore');

    try {
      const androidSetup = new AndroidCredentialsSetup();
      const result = await androidSetup.setupCredentials(this.config.clientCode);

      if (!result.success) {
        if (result.skipped) {
          logger.warn(`Android keystore skipped: ${result.reason}`);
          return null;
        }
        throw new Error(result.error || 'Failed to setup Android credentials');
      }

      logger.success('✓ Android keystore generated successfully');
      logger.info(`  Debug SHA-256: ${result.debug.sha256}`);
      logger.info(`  Release SHA-256: ${result.release.sha256}`);

      // Store BOTH SHA-256s in config for later use
      this.config.androidSHA256Debug = result.debug.sha256;
      this.config.androidSHA256Release = result.release.sha256;
      this.config.keystoreResults = result; // Store full result for automation

      return result;
    } catch (error) {
      logger.error('Failed to generate Android keystore:', error.message);
      throw error;
    }
  }

  // Register App Check and generate setup instructions
  async generateAppCheckSetup() {
    logger.section('Registering App Check');

    try {
      const clientsDir = path.join(process.cwd(), 'clients');

      // Automatically register SHA-256 fingerprints in Firebase
      logger.info('Registering SHA-256 fingerprints in Firebase...');
      const registrationResult = await registerAppCheckFingerprints(
        this.config.firebaseProjectId,
        this.config.bundleId,
        this.config.keystoreResults
      );

      logger.success('✓ SHA-256 fingerprints registered in Firebase');

      // Generate instructions for remaining manual steps
      const instructionsPath = generateAppCheckInstructions(
        this.config.clientCode,
        this.config.firebaseProjectId,
        this.config.androidSHA256Debug,
        this.config.androidSHA256Release,
        this.config.bundleId,
        clientsDir
      );

      logger.success('✓ App Check instructions generated');
      logger.info(`  Arquivo: ${instructionsPath}`);
      logger.info('  ℹ️  Detalhes das ações manuais serão exibidos ao final da execução');

      return { instructionsPath, registrationResult };
    } catch (error) {
      logger.error('Failed to setup App Check:', error.message);
      logger.warn('⚠️  Continuing with manual setup instructions only...');

      // Fallback: Generate instructions without automation
      try {
        const clientsDir = path.join(process.cwd(), 'clients');
        const instructionsPath = generateAppCheckInstructions(
          this.config.clientCode,
          this.config.firebaseProjectId,
          this.config.androidSHA256Debug,
          this.config.androidSHA256Release,
          this.config.bundleId,
          clientsDir
        );

        logger.info(`  Manual instructions: ${instructionsPath}`);
        return { instructionsPath, registrationResult: null };
      } catch (fallbackError) {
        throw error; // Throw original error if fallback also fails
      }
    }
  }

  // Step: Create APNs key for iOS push notifications
  async createAPNsKey() {
    logger.section('Creating APNs Key for iOS Push Notifications');

    const pushEnabled = this.config.featureFlags?.pushNotifications || false;

    if (!pushEnabled) {
      logger.warn('Push Notifications: DISABLED (feature flag = false)');
      logger.info('Skipping APNs key creation');
      return null;
    }

    const apnsCreator = new APNsKeyCreator();

    // Check if key already exists
    const existingKey = apnsCreator.checkExistingKey();
    if (existingKey.exists) {
      logger.info(`✅ APNs key already exists: ${existingKey.keyFile}`);
      logger.info(`   Key ID: ${existingKey.keyId}`);
      this.config.apnsKeyInfo = {
        keyId: existingKey.keyId,
        keyFile: existingKey.keyFile,
        teamId: apnsCreator.getTeamId(),
      };
      return this.config.apnsKeyInfo;
    }

    // Create new key (interactive - requires Apple ID auth)
    const result = await apnsCreator.createKey({
      logger,
      inquirer,
    });

    if (result.success && !result.skipped) {
      this.config.apnsKeyInfo = {
        keyId: result.keyId,
        keyFile: result.keyFile,
        teamId: result.teamId,
      };
      logger.success('APNs key created successfully');
    } else if (result.skipped) {
      logger.info(`APNs key creation skipped: ${result.reason}`);
      // If skipped but key exists, store the info
      if (result.keyId) {
        this.config.apnsKeyInfo = {
          keyId: result.keyId,
          keyFile: result.keyFile,
          teamId: result.teamId,
        };
      }
    } else {
      logger.warn(`APNs key creation failed: ${result.error}`);
      logger.info('You can create the key manually later');
    }

    return this.config.apnsKeyInfo || null;
  }

  // Step: Copy Firebase credentials to Cloud Service
  async copyCredentialsToCloudService() {
    logger.section('Copying Firebase Credentials to Cloud Service');

    const serviceAccountPath = this.config.serviceAccountPath;
    if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
      logger.warn('Service account file not found, skipping cloud service credentials copy');
      return;
    }

    // Path to cloud service credentials folder (relative to loyalty-compose root)
    // From: 01-client-setup/cli/ -> ../../../loyalty-cloud-service/credentials
    const cloudServiceCredentialsDir = path.resolve(
      __dirname,
      '../../../loyalty-cloud-service/credentials'
    );

    // Ensure the credentials directory exists
    if (!fs.existsSync(cloudServiceCredentialsDir)) {
      fs.mkdirSync(cloudServiceCredentialsDir, { recursive: true });
      logger.info(`Created credentials directory: ${cloudServiceCredentialsDir}`);
    }

    // Destination file: {clientCode}.json
    const destinationPath = path.join(cloudServiceCredentialsDir, `${this.config.clientCode}.json`);

    // Copy the service account file
    fs.copyFileSync(serviceAccountPath, destinationPath);

    logger.success(`Firebase credentials copied to: ${destinationPath}`);
    logger.info('Cloud Service will auto-detect this credential on next restart');
  }

  // Step: Generate Push Notifications setup instructions
  generatePushNotificationsSetupInstructions() {
    logger.section('Generating Push Notifications Instructions');

    const pushEnabled = this.config.featureFlags?.pushNotifications || false;
    const clientsDir = path.join(process.cwd(), 'clients');

    const instructionsPath = generatePushNotificationsInstructions({
      clientCode: this.config.clientCode,
      projectId: this.config.firebaseProjectId,
      bundleId: this.config.bundleId,
      outputDir: clientsDir,
      pushEnabled,
      apnsKeyInfo: this.config.apnsKeyInfo, // Pass key info if created
    });

    this.config.pushNotificationsInstructionsPath = instructionsPath;

    if (pushEnabled) {
      logger.success('Push Notifications instructions generated');
      logger.info(`  📄 ${instructionsPath}`);
    } else {
      logger.warn('Push Notifications: DISABLED (feature flag = false)');
      logger.info('  Instructions generated for future reference');
    }
  }

  // Step: Create Shorebird configuration for OTA updates
  async createShorebirdConfig() {
    logger.section('Creating Shorebird Configuration');

    const clientCode = this.config.clientCode;
    const clientShorebirdPath = path.join(this.config.clientFolder, 'shorebird.yaml');
    const whiteLabelPath = path.resolve(__dirname, '../../../white_label_app');
    const whiteLabelShorebirdPath = path.join(whiteLabelPath, 'shorebird.yaml');

    // Check if shorebird CLI is installed
    const { execSync } = require('child_process');
    let shorebirdInstalled = false;
    try {
      execSync('which shorebird', { stdio: 'ignore' });
      shorebirdInstalled = true;
    } catch {
      shorebirdInstalled = false;
    }

    if (!shorebirdInstalled) {
      logger.warn('Shorebird CLI não instalado - criando placeholder');
      logger.info('Instale com: curl --proto "=https" --tlsv1.2 https://raw.githubusercontent.com/shorebirdtech/install/main/install.sh -sSf | bash');

      const yamlContent = `# Shorebird configuration for ${clientCode}
# Learn more at https://docs.shorebird.dev
# Run 'shorebird init' in white_label_app/ after setup to generate real app_id

app_id: placeholder-${clientCode}
auto_update: true
`;
      fs.writeFileSync(clientShorebirdPath, yamlContent, 'utf8');
      logger.warn('Execute "cd white_label_app && shorebird init" após setup para gerar app_id real');
      return;
    }

    // Run shorebird init in white_label_app
    logger.info('Executando shorebird init para gerar app_id real...');

    try {
      // shorebird init requires the project to have proper Flutter setup
      // We run it with --force to overwrite any existing config
      execSync('shorebird init --force', {
        cwd: whiteLabelPath,
        stdio: 'inherit',
        env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' }
      });

      // Copy the generated shorebird.yaml to client folder
      if (fs.existsSync(whiteLabelShorebirdPath)) {
        fs.copyFileSync(whiteLabelShorebirdPath, clientShorebirdPath);
        logger.success(`shorebird.yaml gerado e copiado para: ${clientShorebirdPath}`);

        // Verify it's not a placeholder
        const content = fs.readFileSync(clientShorebirdPath, 'utf8');
        if (content.includes('placeholder-')) {
          logger.warn('shorebird init gerou placeholder - verifique se está logado (shorebird login)');
        } else {
          logger.success('Shorebird configurado com app_id real - OTA updates habilitados!');
        }
      } else {
        logger.error('shorebird.yaml não foi gerado - verifique erros acima');
      }
    } catch (error) {
      logger.error(`Falha ao executar shorebird init: ${error.message}`);
      logger.info('Você pode executar manualmente: cd white_label_app && shorebird init');

      // Create placeholder as fallback
      const yamlContent = `# Shorebird configuration for ${clientCode}
# Learn more at https://docs.shorebird.dev
# shorebird init failed - run manually to generate real app_id

app_id: placeholder-${clientCode}
auto_update: true
`;
      fs.writeFileSync(clientShorebirdPath, yamlContent, 'utf8');
    }
  }

  // Format duration
  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Execute a step with checkpoint support
   * @param {string} stepName - Name of the step
   * @param {Function} stepFunction - Function to execute
   * @returns {Promise<any>} Result of the step function
   */
  async executeStep(stepName, stepFunction) {
    // Skip if already completed (when resuming)
    if (this.completedSteps.has(stepName)) {
      logger.info(`⏭️  Skipping ${stepName} (already completed)`);
      return;
    }

    // Execute the step
    const result = await stepFunction();

    // Mark as completed
    this.completedSteps.add(stepName);

    // Save checkpoint if manager is initialized
    if (this.checkpointManager) {
      this.checkpointManager.saveCheckpoint(stepName, {
        config: this.config,
        completedSteps: Array.from(this.completedSteps),
      });
    }

    return result;
  }

  /**
   * Attempt to resume from checkpoint
   * @returns {Promise<boolean>} True if resuming, false if starting fresh
   */
  async tryResumeFromCheckpoint() {
    if (!this.checkpointManager || !this.checkpointManager.exists()) {
      return false;
    }

    const shouldResume = await this.checkpointManager.promptResume(inquirer);

    if (shouldResume) {
      const checkpoint = this.checkpointManager.getLastCheckpoint();
      this.config = checkpoint.state.config || {};
      this.completedSteps = new Set(checkpoint.state.completedSteps || []);

      // Check if Firebase Project ID needs to be regenerated (old format)
      // New format: {code}-loyalty-hub-club-{random}
      // Old format: just {code}
      if (
        this.config.firebaseProjectId &&
        !this.config.firebaseProjectId.includes('loyalty-hub-club')
      ) {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
        const newFirebaseProjectId = `${this.config.clientCode}-loyalty-hub-club-${randomSuffix}`;
        logger.warn(
          `⚠️  Old Firebase Project ID format detected: ${this.config.firebaseProjectId}`
        );
        logger.info(`✓ Regenerating with new format: ${newFirebaseProjectId}`);
        this.config.firebaseProjectId = newFirebaseProjectId;
      }

      logger.info(`✓ Resuming from: ${checkpoint.stepName}`);
      logger.info(`✓ Completed steps: ${this.completedSteps.size}`);
      return true;
    }

    return false;
  }

  // Main execution flow
  async run() {
    try {
      this.startTime = Date.now();

      // Welcome
      logger.section('LoyaltyHub Client Creation');
      logger.info('This wizard will create a complete white-label client setup');
      logger.blank();

      // Run preflight checks (skip if already run by workflow)
      if (!process.env.SKIP_PREFLIGHT_CHECK) {
        await preflightCheck.runAll();
      }

      // Step 1: Collect information
      await this.collectClientInfo();

      // Initialize checkpoint manager now that we have clientCode
      this.checkpointManager = new CheckpointManager('client-creation', this.config.clientCode);

      // Try to resume from checkpoint
      const resumed = await this.tryResumeFromCheckpoint();
      if (resumed) {
        logger.info('✓ Resuming client creation from checkpoint');
        logger.blank();
      }

      // Step 2: Confirm
      await this.executeStep('confirm_creation', () => this.confirmCreation());

      // Step 3: Create Firebase project
      await this.executeStep('create_firebase_project', async () => {
        await this.createFirebaseProject();
        this.resourceTracker.trackFirebaseProject(this.config.firebaseProjectId);
      });

      // Step 4: Save to Master Firebase
      await this.executeStep('save_to_master_firebase', async () => {
        await this.saveToMasterFirebase();
        this.resourceTracker.trackMasterFirebaseEntry(this.config.clientCode, firebaseClient);
      });

      // Step 4b: Copy Firebase credentials to Cloud Service
      await this.executeStep('copy_credentials_to_cloud_service', () =>
        this.copyCredentialsToCloudService()
      );

      // Step 5: Deploy Firestore rules
      await this.executeStep('deploy_firestore_rules', () => this.deployFirestoreRules());

      // Step 5.5: Generate Android Keystore for App Check
      await this.executeStep('generate_android_keystore', () => this.generateAndroidKeystore());

      // Step 5.5b: Commit Android keystores to loyalty-credentials
      await this.executeStep('commit_android_keystores', async () => {
        const credentialsManager = new GitCredentialsManager();
        await credentialsManager.commitAndroidKeystores(
          this.config.clientCode,
          this.config.clientName
        );
      });

      // Step 5.5c: Save local config (MUST happen before iOS certificates)
      // iOS certificate setup needs to read config.json to discover bundle ID
      await this.executeStep('save_local_config', () => {
        this.saveLocalConfig();
        const clientDir = path.join(process.cwd(), 'clients', this.config.folderName);
        this.resourceTracker.trackDirectory(clientDir);
      });

      // Step 5.5d: Setup iOS certificates and provisioning profiles
      await this.executeStep('setup_ios_certificates', async () => {
        const iosSetup = new IOSCertificateSetup();
        const result = await iosSetup.setupCertificates(
          this.config.clientCode,
          this.config.bundleId
        );
        this.config.iosCertificatesResult = result;
      });

      // Step 5.6: Generate App Check setup instructions
      await this.executeStep('generate_app_check_instructions', () => this.generateAppCheckSetup());

      // Step 5.7: Setup Remote Config
      await this.executeStep('setup_remote_config', () => this.setupRemoteConfig());

      // Step 6: Seed default data
      await this.executeStep('seed_default_data', async () => {
        await this.seedDefaultData();
        this.resourceTracker.trackFirestoreCollection(
          this.config.clientCode,
          'Categories',
          firebaseClient
        );
        this.resourceTracker.trackFirestoreCollection(
          this.config.clientCode,
          'Products',
          firebaseClient
        );
        this.resourceTracker.trackFirestoreCollection(
          this.config.clientCode,
          'Store_Configs',
          firebaseClient
        );
        this.resourceTracker.trackFirestoreCollection(
          this.config.clientCode,
          'Our_Story',
          firebaseClient
        );
      });

      // Step 6b: Create and configure test user
      await this.executeStep('create_test_user', () => this.createTestUser());

      // Step 7: Create admin user
      await this.executeStep('create_admin_user', () => this.createAdminUser());

      // Step 8: Commit client config to main
      await this.executeStep('commit_client_config', () => this.commitClientConfig());

      // Step 9: Generate app store metadata
      await this.executeStep('generate_metadata', () => this.generateMetadata());

      // Step 10: Create package_rename_config.yaml
      await this.executeStep('create_package_rename_config', () =>
        this.createPackageRenameConfig()
      );

      // Step 10c: Copy business type assets
      await this.executeStep('copy_business_type_assets', () => this.copyBusinessTypeAssets());

      // Step 10d: Create Shorebird configuration for OTA updates
      await this.executeStep('create_shorebird_config', () => this.createShorebirdConfig());

      // Step 10e: Create APNs key for iOS push notifications (if enabled)
      await this.executeStep('create_apns_key', () => this.createAPNsKey());

      // Step 10f: Generate Push Notifications setup instructions
      await this.executeStep('generate_push_notifications_instructions', () =>
        this.generatePushNotificationsSetupInstructions()
      );

      // Clear resource tracker on success (no rollback needed)
      this.resourceTracker.clear();
      logger.success('✓ All resources tracked and confirmed successful');

      // Clear checkpoint on successful completion
      if (this.checkpointManager) {
        this.checkpointManager.clear();
      }

      // Run health check on the newly created client
      logger.blank();
      logger.info('🔍 Running health check on newly created client...');
      const healthCheck = new ClientHealthCheck(this.config.clientCode);
      await healthCheck.runAll();

      // Calculate duration
      const duration = this.formatDuration(Date.now() - this.startTime);

      // Final summary
      logger.blank();
      logger.summaryBox({
        Client: `${this.config.clientName} (${this.config.clientCode})`,
        'Bundle ID': this.config.bundleId,
        'Firebase Project': this.config.firebaseProjectId,
        'Git Commit': this.config.commitHash,
        'Admin Email': this.config.adminEmail,
        'Android SHA-256': this.config.androidSHA256
          ? this.config.androidSHA256.substring(0, 40) + '...'
          : 'N/A',
        'Config File': `clients/${this.config.folderName}/config.json`,
        'Total Time': duration,
      });

      logger.success('🎉 Phase 01: Client Setup completed successfully!');
      logger.blank();
      logger.info('✓ Client configuration saved to main branch');
      logger.info('✓ Firebase project and Firestore configured');
      logger.info('✓ Admin user created and ready');
      logger.blank();

      // ============================================================================
      // 🔴 FINAL SECTION: MANUAL ACTIONS REQUIRED
      // ============================================================================
      logger.blank();
      logger.blank();
      logger.section('═'.repeat(80));
      logger.section('🔴 ATENÇÃO: AÇÕES MANUAIS NECESSÁRIAS');
      logger.section('═'.repeat(80));
      logger.blank();

      // 1. Admin Credentials - MOST CRITICAL
      if (this.config.adminCredentials) {
        logger.subSection('1️⃣  CREDENCIAIS DO ADMINISTRADOR (SALVE AGORA!)');
        logger.blank();
        logger.credentialsBox(
          this.config.clientCode,
          this.config.adminCredentials.email,
          this.config.adminCredentials.password
        );
        logger.info(
          `📄 Credenciais também salvas em: clients/${this.config.folderName}/admin-credentials.txt`
        );
        logger.blank();
        logger.warn('⚠️  IMPORTANTE: Salve essas credenciais em um local seguro AGORA!');
        logger.blank();
        logger.blank();
      }

      // 2. App Check Manual Setup
      logger.subSection('2️⃣  CONFIGURAÇÃO DO APP CHECK (2 cliques necessários)');
      logger.blank();
      logger.info('🔗 Abra o Firebase Console:');
      logger.log(
        `   ${chalk.cyan(`https://console.firebase.google.com/project/${this.config.firebaseProjectId}/appcheck`)}`
      );
      logger.blank();
      logger.info('📋 Passos:');
      logger.info('   a) Encontre seu app Android na lista');
      logger.info('   b) Clique em "Register" (Registrar) sob "Play Integrity"');
      logger.info(
        '   c) Clique em "Register" (Registrar) sob "App Attest" para iOS (se aplicável)'
      );
      logger.blank();
      logger.info('✅ SHA-256 fingerprints já foram registrados automaticamente!');
      logger.info(
        `📄 Instruções detalhadas: clients/${this.config.folderName}/APP_CHECK_SETUP_${this.config.clientCode}.md`
      );
      logger.blank();
      logger.blank();

      // 3. Push Notifications Setup (iOS APNs)
      logger.subSection('3️⃣  PUSH NOTIFICATIONS - iOS (APNs)');
      logger.blank();
      displayPushNotificationsManualSteps(
        {
          clientCode: this.config.clientCode,
          projectId: this.config.firebaseProjectId,
          pushEnabled: this.config.featureFlags?.pushNotifications || false,
          apnsKeyInfo: this.config.apnsKeyInfo, // Pass key info if created
        },
        logger
      );
      logger.blank();
      logger.blank();
      logger.section('═'.repeat(80));
      logger.blank();
      process.exit(0);
    } catch (error) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      logger.error(`Client creation failed after ${duration}`);
      logger.error(error.message);

      // Execute rollback for all tracked resources
      if (this.resourceTracker.count() > 0) {
        logger.warn('');
        logger.warn('Initiating rollback of created resources...');
        await this.resourceTracker.rollback();
      }

      // Checkpoint kept for potential resume - inform user
      if (this.checkpointManager && this.checkpointManager.exists()) {
        logger.blank();
        logger.info('💾 Checkpoint saved - you can resume by running the wizard again');
        logger.info('   The wizard will ask if you want to continue from where it left off');
        logger.blank();
      }

      // Send error notification via Telegram
      if (this.config.clientName) {
        await telegram.error(this.config.clientName, error.message, 'Client Creation');
      }

      // Use error handler for consistent cleanup
      await errorHandler.handleCLIError(error, {
        sendTelegram: false, // Already sent above
        cleanup: () => firebaseClient.cleanup(),
        exitCode: 1,
      });
    } finally {
      // Cleanup Firebase connections
      firebaseClient.cleanup();
    }
  }
}

// Run wizard
const wizard = new ClientCreationWizard();
wizard.run().catch((error) => {
  logger.error(`Unhandled error in wizard: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});
