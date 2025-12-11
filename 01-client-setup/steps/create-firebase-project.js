const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');
const firebaseClient = require('../shared/firebase-manager');

class FirebaseProjectCreator {
  constructor() {
    this.projectId = null;
    this.clientFolder = null;
  }

  // Execute command and return output
  exec(command, options = {}) {
    try {
      return execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 30000, // Default 30 second timeout
        ...options,
      }).trim();
    } catch (error) {
      // Check if error was due to timeout
      if (error.killed && error.signal === 'SIGTERM') {
        throw new Error(`Command timed out after ${options.timeout || 30000}ms: ${command}`);
      }

      // Include stdout and stderr in the error message for better debugging
      const fullError = [error.message, error.stderr, error.stdout].filter(Boolean).join('\n');

      throw new Error(`Command failed: ${command}\n${fullError}`);
    }
  }

  // Create Firebase project using Firebase CLI
  async createProject(projectId, displayName) {
    logger.startSpinner(`Creating Firebase project: ${projectId}...`);

    try {
      // Create project with extended timeout (Firebase project creation can take 60-120 seconds)
      this.exec(`firebase projects:create ${projectId} --display-name "${displayName}"`, {
        timeout: 120000, // 2 minutes timeout for project creation
      });

      logger.succeedSpinner(`Firebase project created: ${projectId}`);
      this.projectId = projectId;
      return projectId;
    } catch (error) {
      logger.failSpinner('Failed to create Firebase project');

      // Check if project already exists (various error message formats)
      if (
        error.message.includes('already exists') ||
        error.message.includes('already a project with ID')
      ) {
        logger.warn(`Project ${projectId} already exists, continuing...`);
        this.projectId = projectId;
        return projectId;
      }

      throw error;
    }
  }

  // Add Android app to Firebase project
  async addAndroidApp(bundleId, appNickname) {
    logger.startSpinner('Adding Android app to Firebase...');

    try {
      // First, try to check if the app already exists
      try {
        const appsJson = this.exec(`firebase apps:list android --project ${this.projectId} --json`);
        const apps = JSON.parse(appsJson);

        if (apps.result && apps.result.length > 0) {
          // Check if any existing app has the same package name
          const existingApp = apps.result.find((app) => app.packageName === bundleId);
          if (existingApp) {
            logger.succeedSpinner(
              `Android app already exists: ${existingApp.displayName || bundleId}`
            );
            return true;
          }
        }
      } catch (listError) {
        // If listing fails (404), it means the project exists but Firebase is not enabled yet
        // Continue to create the app, which will enable Firebase
        const errorMsg = listError.message.toLowerCase();
        if (errorMsg.includes('not found') || errorMsg.includes('404')) {
          logger.info('Firebase not yet enabled on project, will enable it by creating app...');
        } else {
          throw listError;
        }
      }

      // App doesn't exist, create it
      this.exec(
        `firebase apps:create android "${appNickname}" --package-name ${bundleId} --project ${this.projectId}`,
        {
          timeout: 60000, // 1 minute timeout for app creation
        }
      );

      logger.succeedSpinner('Android app added to Firebase');
      return true;
    } catch (error) {
      logger.failSpinner('Failed to add Android app');

      // Fallback: Check if error message indicates app already exists
      const errorMsg = error.message.toLowerCase();
      if (
        errorMsg.includes('already exists') ||
        errorMsg.includes('already_exists') ||
        errorMsg.includes('entity already exists')
      ) {
        logger.warn(
          `Android app appears to already exist in project ${this.projectId}, continuing...`
        );
        return true;
      }

      throw error;
    }
  }

  // Add iOS app to Firebase project
  async addIosApp(bundleId, appNickname) {
    logger.startSpinner('Adding iOS app to Firebase...');

    try {
      // First, try to check if the app already exists
      try {
        const appsJson = this.exec(`firebase apps:list ios --project ${this.projectId} --json`);
        const apps = JSON.parse(appsJson);

        if (apps.result && apps.result.length > 0) {
          // Check if any existing app has the same bundle ID
          const existingApp = apps.result.find((app) => app.bundleId === bundleId);
          if (existingApp) {
            logger.succeedSpinner(`iOS app already exists: ${existingApp.displayName || bundleId}`);
            return true;
          }
        }
      } catch (listError) {
        // If listing fails (404), it means the project exists but Firebase is not enabled yet
        // Continue to create the app, which will enable Firebase
        const errorMsg = listError.message.toLowerCase();
        if (errorMsg.includes('not found') || errorMsg.includes('404')) {
          logger.info('Firebase not yet enabled on project, will enable it by creating app...');
        } else {
          throw listError;
        }
      }

      // App doesn't exist, create it
      this.exec(
        `firebase apps:create ios "${appNickname}" --bundle-id ${bundleId} --project ${this.projectId}`,
        {
          timeout: 60000, // 1 minute timeout for app creation
        }
      );

      logger.succeedSpinner('iOS app added to Firebase');
      return true;
    } catch (error) {
      logger.failSpinner('Failed to add iOS app');

      // Fallback: Check if error message indicates app already exists
      const errorMsg = error.message.toLowerCase();
      if (
        errorMsg.includes('already exists') ||
        errorMsg.includes('already_exists') ||
        errorMsg.includes('entity already exists')
      ) {
        logger.warn(`iOS app appears to already exist in project ${this.projectId}, continuing...`);
        return true;
      }

      // Don't fail entirely if iOS app creation fails (might be on non-macOS)
      logger.warn('iOS app creation failed, but continuing...');
      return false;
    }
  }

  // Add macOS app to Firebase project
  async addMacOsApp(bundleId, appNickname) {
    logger.startSpinner('Adding macOS app to Firebase...');

    try {
      // First, try to check if the app already exists
      try {
        const appsJson = this.exec(`firebase apps:list macos --project ${this.projectId} --json`);
        const apps = JSON.parse(appsJson);

        if (apps.result && apps.result.length > 0) {
          // Check if any existing app has the same bundle ID
          const existingApp = apps.result.find((app) => app.bundleId === bundleId);
          if (existingApp) {
            logger.succeedSpinner(
              `macOS app already exists: ${existingApp.displayName || bundleId}`
            );
            return true;
          }
        }
      } catch (listError) {
        // If listing fails (404), it means the project exists but Firebase is not enabled yet
        // Continue to create the app, which will enable Firebase
        const errorMsg = listError.message.toLowerCase();
        if (errorMsg.includes('not found') || errorMsg.includes('404')) {
          logger.info('Firebase not yet enabled on project, will enable it by creating app...');
        } else {
          throw listError;
        }
      }

      // App doesn't exist, create it
      this.exec(
        `firebase apps:create macos "${appNickname}" --bundle-id ${bundleId} --project ${this.projectId}`,
        {
          timeout: 60000, // 1 minute timeout for app creation
        }
      );

      logger.succeedSpinner('macOS app added to Firebase');
      return true;
    } catch (error) {
      logger.failSpinner('Failed to add macOS app');

      // Check if it's because Firebase CLI doesn't support macOS platform
      const errorMsg = error.message.toLowerCase();
      if (
        errorMsg.includes('platform') ||
        errorMsg.includes('invalid') ||
        errorMsg.includes('unsupported') ||
        errorMsg.includes('macos')
      ) {
        logger.warn('⚠️  Firebase CLI does not support macOS platform yet');
        logger.info(
          '💡 For macOS support, configure manually in Firebase Console or use iOS config'
        );
        return false;
      }

      // Fallback: Check if error message indicates app already exists
      if (
        errorMsg.includes('already exists') ||
        errorMsg.includes('already_exists') ||
        errorMsg.includes('entity already exists')
      ) {
        logger.warn(
          `macOS app appears to already exist in project ${this.projectId}, continuing...`
        );
        return true;
      }

      // Don't fail entirely if macOS app creation fails
      logger.warn('macOS app creation failed, but continuing...');
      logger.info(`Error details: ${error.message}`);
      return false;
    }
  }

  // Add Web app to Firebase project (used for Web and Windows)
  async addWebApp(appNickname) {
    logger.startSpinner('Adding Web app to Firebase (for Web and Windows)...');

    try {
      // First, try to check if the app already exists
      try {
        const appsJson = this.exec(`firebase apps:list web --project ${this.projectId} --json`);
        const apps = JSON.parse(appsJson);

        if (apps.result && apps.result.length > 0) {
          // Check if any existing app has similar name
          const existingApp = apps.result.find(
            (app) => app.displayName && app.displayName.includes(appNickname.split(' ')[0])
          );
          if (existingApp) {
            logger.succeedSpinner(`Web app already exists: ${existingApp.displayName}`);
            return true;
          }
        }
      } catch (listError) {
        // If listing fails (404), it means the project exists but Firebase is not enabled yet
        // Continue to create the app, which will enable Firebase
        const errorMsg = listError.message.toLowerCase();
        if (errorMsg.includes('not found') || errorMsg.includes('404')) {
          logger.info('Firebase not yet enabled on project, will enable it by creating app...');
        } else {
          throw listError;
        }
      }

      // App doesn't exist, create it
      this.exec(`firebase apps:create web "${appNickname}" --project ${this.projectId}`, {
        timeout: 60000, // 1 minute timeout for app creation
      });

      logger.succeedSpinner('Web app added to Firebase');
      return true;
    } catch (error) {
      logger.failSpinner('Failed to add Web app');

      // Fallback: Check if error message indicates app already exists
      const errorMsg = error.message.toLowerCase();
      if (
        errorMsg.includes('already exists') ||
        errorMsg.includes('already_exists') ||
        errorMsg.includes('entity already exists')
      ) {
        logger.warn(`Web app appears to already exist in project ${this.projectId}, continuing...`);
        return true;
      }

      // Don't fail entirely if Web app creation fails
      logger.warn('Web app creation failed, but continuing...');
      return false;
    }
  }

  // Download Android google-services.json
  async downloadAndroidConfig(outputPath) {
    logger.startSpinner('Downloading google-services.json...');

    try {
      // Get the first Android app ID
      const appsJson = this.exec(`firebase apps:list android --project ${this.projectId} --json`);
      const apps = JSON.parse(appsJson);

      if (!apps.result || apps.result.length === 0) {
        throw new Error('No Android app found');
      }

      const appId = apps.result[0].appId;

      // Download config
      const config = this.exec(
        `firebase apps:sdkconfig android ${appId} --project ${this.projectId}`
      );

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to file
      fs.writeFileSync(outputPath, config);

      logger.succeedSpinner(`google-services.json saved to ${outputPath}`);
      return true;
    } catch (error) {
      logger.failSpinner('Failed to download Android config');
      throw error;
    }
  }

  // Download iOS GoogleService-Info.plist
  async downloadIosConfig(outputPath) {
    logger.startSpinner('Downloading GoogleService-Info.plist...');

    try {
      // Get the first iOS app ID
      const appsJson = this.exec(`firebase apps:list ios --project ${this.projectId} --json`);
      const apps = JSON.parse(appsJson);

      if (!apps.result || apps.result.length === 0) {
        logger.warn('No iOS app found, skipping iOS config download');
        return false;
      }

      const appId = apps.result[0].appId;

      // Download config
      const config = this.exec(`firebase apps:sdkconfig ios ${appId} --project ${this.projectId}`);

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to file
      fs.writeFileSync(outputPath, config);

      logger.succeedSpinner(`GoogleService-Info.plist saved to ${outputPath}`);
      return true;
    } catch (error) {
      logger.warn('Failed to download iOS config, continuing without it...');
      return false;
    }
  }

  // Run flutterfire configure to generate firebase_options.dart
  async generateFlutterFireOptions(clientFolder) {
    logger.startSpinner('Generating firebase_options.dart...');

    try {
      // Find the Flutter app root directory (white_label_app)
      const flutterAppRoot = path.join(__dirname, '../../../white_label_app');

      // Verify it's a Flutter app
      const pubspecPath = path.join(flutterAppRoot, 'pubspec.yaml');
      if (!fs.existsSync(pubspecPath)) {
        throw new Error(`Flutter app not found at: ${flutterAppRoot}`);
      }

      const optionsPath = path.join(flutterAppRoot, 'lib', 'firebase_options.dart');

      // Run flutterfire configure from the Flutter app root
      // Increase timeout to 3 minutes as this can take a while, especially with multiple platforms
      this.exec(
        `flutterfire configure --project=${this.projectId} --out=lib/firebase_options.dart --yes`,
        {
          cwd: flutterAppRoot,
          timeout: 180000, // 3 minutes
        }
      );

      if (!fs.existsSync(optionsPath)) {
        throw new Error('firebase_options.dart was not generated');
      }

      // Copy the generated file to the client folder for reference
      const clientOptionsPath = path.join(clientFolder, 'lib', 'firebase_options.dart');
      const clientLibDir = path.dirname(clientOptionsPath);
      if (!fs.existsSync(clientLibDir)) {
        fs.mkdirSync(clientLibDir, { recursive: true });
      }
      fs.copyFileSync(optionsPath, clientOptionsPath);

      logger.succeedSpinner('firebase_options.dart generated successfully');
      return optionsPath;
    } catch (error) {
      logger.failSpinner('Failed to generate firebase_options.dart');
      throw error;
    }
  }

  // Parse firebase_options.dart to extract configuration
  parseFirebaseOptions(optionsPath) {
    const content = fs.readFileSync(optionsPath, 'utf8');

    // Extract platform-specific configuration sections
    const extractPlatformSection = (platform) => {
      const regex = new RegExp(
        `static\\s+const\\s+FirebaseOptions\\s+${platform}\\s*=\\s*FirebaseOptions\\s*\\([^)]+\\)`,
        's'
      );
      const match = content.match(regex);
      return match ? match[0] : null;
    };

    // Extract value from a specific section
    const extractValueFromSection = (section, key) => {
      if (!section) return null;
      const regex = new RegExp(`${key}:\\s*'([^']+)'`);
      const match = section.match(regex);
      return match ? match[1] : null;
    };

    // Extract generic value (first occurrence, typically from shared config)
    const extractValue = (key) => {
      const regex = new RegExp(`${key}:\\s*'([^']+)'`);
      const match = content.match(regex);
      return match ? match[1] : null;
    };

    // Get platform-specific sections
    const androidSection = extractPlatformSection('android');
    const iosSection = extractPlatformSection('ios');
    const webSection = extractPlatformSection('web');

    // Extract platform-specific values
    const androidAppId = extractValueFromSection(androidSection, 'appId');
    const androidApiKey = extractValueFromSection(androidSection, 'apiKey');
    const iosAppId = extractValueFromSection(iosSection, 'appId');
    const iosApiKey = extractValueFromSection(iosSection, 'apiKey');
    const webAppId = extractValueFromSection(webSection, 'appId');
    const webApiKey = extractValueFromSection(webSection, 'apiKey');

    // Extract common values (use generic extraction)
    const projectId = extractValue('projectId');
    const messagingSenderId = extractValue('messagingSenderId');
    const storageBucket = extractValue('storageBucket');
    const authDomain = extractValue('authDomain');
    const measurementId = extractValue('measurementId');
    const genericApiKey = extractValue('apiKey');
    const genericAppId = extractValue('appId');

    return {
      projectId,
      apiKey: genericApiKey,
      appId: genericAppId,
      messagingSenderId,
      storageBucket,
      authDomain,
      measurementId,
      // Platform-specific values with fallback to generic only if not found
      iosApiKey: iosApiKey || genericApiKey,
      iosAppId: iosAppId || genericAppId,
      androidApiKey: androidApiKey || genericApiKey,
      androidAppId: androidAppId || genericAppId,
      webApiKey: webApiKey || genericApiKey,
      webAppId: webAppId || genericAppId,
    };
  }

  // Grant service account access to the project
  grantServiceAccountAccess() {
    logger.startSpinner('Granting service account access to project...');

    try {
      // Get service account email from GOOGLE_APPLICATION_CREDENTIALS
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!credPath || !fs.existsSync(credPath)) {
        logger.failSpinner('Service account credentials not found');
        logger.warn('⚠️  GOOGLE_APPLICATION_CREDENTIALS not set or file not found');
        logger.info('💡 The service account will need manual IAM permissions');
        return;
      }

      const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      const serviceAccountEmail = credentials.client_email;

      // Add service account as Editor to the project with 30 second timeout
      this.exec(
        `gcloud projects add-iam-policy-binding ${this.projectId} --member="serviceAccount:${serviceAccountEmail}" --role="roles/editor" --quiet`,
        { timeout: 30000 }
      );

      // Add Service Usage Consumer role (required for Remote Config)
      this.exec(
        `gcloud projects add-iam-policy-binding ${this.projectId} --member="serviceAccount:${serviceAccountEmail}" --role="roles/serviceusage.serviceUsageConsumer" --quiet`,
        { timeout: 30000 }
      );

      logger.succeedSpinner(`Service account ${serviceAccountEmail} granted access`);
    } catch (error) {
      // Don't fail the entire process if this fails - log warning instead
      logger.failSpinner('Could not grant service account access');

      // Check if it was a timeout
      if (error.message.includes('timed out')) {
        logger.warn('⚠️  Command timed out after 30 seconds');
        logger.info('💡 This usually happens when:');
        logger.info('   - gcloud is not authenticated (run: gcloud auth login)');
        logger.info('   - Network connectivity issues');
        logger.info('   - The project is still being created (try again in a few minutes)');
      } else {
        logger.warn(`⚠️  ${error.message}`);
      }

      logger.blank();
      logger.info('📋 To grant permissions manually, run:');
      logger.info(`   gcloud projects add-iam-policy-binding ${this.projectId} \\`);
      logger.info(`     --member="serviceAccount:{your-service-account-email}" \\`);
      logger.info(`     --role="roles/editor"`);
      logger.info(`   gcloud projects add-iam-policy-binding ${this.projectId} \\`);
      logger.info(`     --member="serviceAccount:{your-service-account-email}" \\`);
      logger.info(`     --role="roles/serviceusage.serviceUsageConsumer"`);
      logger.blank();
      logger.info('✓ Continuing with client creation...');
    }
  }

  // Enable Firestore
  async enableFirestore() {
    logger.startSpinner('Enabling Firestore...');

    try {
      // Create Firestore database
      this.exec(
        `firebase firestore:databases:create "(default)" --project ${this.projectId} --location=us-central1`,
        {
          timeout: 90000, // 90 seconds timeout for Firestore creation
        }
      );

      logger.succeedSpinner('Firestore enabled');
      return true;
    } catch (error) {
      // Firestore might already be enabled
      if (error.message.includes('already exists') || error.message.includes('ALREADY_EXISTS')) {
        logger.succeedSpinner('Firestore already enabled');
        return true;
      }

      // If API not enabled error, handle it interactively
      if (
        error.message.includes('has not been used') ||
        error.message.includes('it is disabled') ||
        error.message.includes('403')
      ) {
        logger.failSpinner('Firestore API not enabled');

        const enableUrl = `https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=${this.projectId}`;

        logger.blank();
        logger.warn('⚠️  The Firestore API needs to be enabled for this project.');
        logger.blank();
        logger.info('📋 Opening browser to enable the API...');
        logger.blank();

        // Try to open browser automatically
        try {
          this.exec(`open "${enableUrl}"`, { stdio: 'ignore' });
          logger.success('✓ Browser opened automatically');
        } catch (openError) {
          logger.warn('Could not open browser automatically. Please visit:');
          logger.info(`   ${enableUrl}`);
        }

        logger.blank();
        logger.info('Please:');
        logger.info('1. Click the "ENABLE" button in the browser');
        logger.info('2. Wait for the API to be enabled (usually takes 10-30 seconds)');
        logger.blank();

        // Wait for user confirmation
        const inquirer = require('inquirer');
        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: 'Have you enabled the Firestore API?',
            default: false,
          },
        ]);

        if (!confirmed) {
          throw new Error('Firestore API enablement cancelled by user.');
        }

        logger.blank();
        logger.startSpinner('Waiting for API to propagate and creating Firestore database...');

        // Retry with exponential backoff
        const maxRetries = 3;
        let lastError = null;

        for (let i = 0; i < maxRetries; i++) {
          try {
            // Wait a bit before retrying
            await new Promise((resolve) => setTimeout(resolve, 5000 * (i + 1))); // 5s, 10s, 15s

            this.exec(
              `firebase firestore:databases:create "(default)" --project ${this.projectId} --location=us-central1`,
              {
                timeout: 90000, // 90 seconds timeout for Firestore creation
              }
            );
            logger.succeedSpinner('Firestore enabled successfully!');
            return true;
          } catch (retryError) {
            lastError = retryError;
            if (i < maxRetries - 1) {
              logger.updateSpinner(
                `Retry ${i + 2}/${maxRetries} - waiting for API to propagate...`
              );
            }
          }
        }

        // All retries failed
        logger.failSpinner('Failed to enable Firestore after retries');
        logger.blank();
        logger.error('The API may need more time to propagate. Please wait 1-2 minutes and run:');
        logger.info('   npm run loyalty');
        logger.info('   (The wizard will resume from where it left off)');
        logger.blank();
        throw lastError;
      }

      logger.failSpinner('Failed to enable Firestore');
      throw error;
    }
  }

  // Grant Firestore permissions to service account
  grantFirestorePermissions() {
    logger.startSpinner('Granting Firestore and Remote Config permissions to service account...');

    try {
      const serviceAccountEmail = `firebase-adminsdk-fbsvc@${this.projectId}.iam.gserviceaccount.com`;

      // Grant Cloud Datastore Owner role (required for Firestore access)
      this.exec(
        `gcloud projects add-iam-policy-binding ${this.projectId} --member="serviceAccount:${serviceAccountEmail}" --role="roles/datastore.owner" --quiet`,
        { timeout: 30000 }
      );

      // Grant Service Usage Consumer role (required for Remote Config)
      this.exec(
        `gcloud projects add-iam-policy-binding ${this.projectId} --member="serviceAccount:${serviceAccountEmail}" --role="roles/serviceusage.serviceUsageConsumer" --quiet`,
        { timeout: 30000 }
      );

      logger.succeedSpinner(
        `Firestore and Remote Config permissions granted to ${serviceAccountEmail}`
      );
    } catch (error) {
      // Don't fail the entire process if this fails - log warning instead
      logger.failSpinner('Could not grant Firestore/Remote Config permissions automatically');

      // Check if it was a timeout
      if (error.message.includes('timed out')) {
        logger.warn('⚠️  Command timed out after 30 seconds');
        logger.info('💡 This usually happens when:');
        logger.info('   - gcloud is not authenticated (run: gcloud auth login)');
        logger.info('   - Network connectivity issues');
      } else {
        logger.warn(`⚠️  ${error.message}`);
      }

      logger.blank();
      logger.info('📋 To grant permissions manually, run:');
      logger.info(`   gcloud projects add-iam-policy-binding ${this.projectId} \\`);
      logger.info(
        `     --member="serviceAccount:firebase-adminsdk-fbsvc@${this.projectId}.iam.gserviceaccount.com" \\`
      );
      logger.info(`     --role="roles/datastore.owner"`);
      logger.info(`   gcloud projects add-iam-policy-binding ${this.projectId} \\`);
      logger.info(
        `     --member="serviceAccount:firebase-adminsdk-fbsvc@${this.projectId}.iam.gserviceaccount.com" \\`
      );
      logger.info(`     --role="roles/serviceusage.serviceUsageConsumer"`);
      logger.blank();
      logger.info('✓ Continuing with client creation...');
    }
  }

  // Create service account key for the client project
  async createClientServiceAccountKey(outputPath) {
    logger.startSpinner('Creating service account key for client project...');

    try {
      const serviceAccountEmail = `firebase-adminsdk-fbsvc@${this.projectId}.iam.gserviceaccount.com`;

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create the key
      this.exec(
        `gcloud iam service-accounts keys create "${outputPath}" --iam-account="${serviceAccountEmail}" --project="${this.projectId}"`,
        { timeout: 30000 }
      );

      // Verify the key was created
      if (!fs.existsSync(outputPath)) {
        throw new Error('Service account key was not created');
      }

      logger.succeedSpinner(`Service account key created: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.failSpinner('Failed to create service account key');

      // Check if it was a timeout
      if (error.message.includes('timed out')) {
        logger.warn('⚠️  Command timed out after 30 seconds');
        logger.info('💡 This usually happens when gcloud is not authenticated');
        logger.info('   Run: gcloud auth login');
      } else {
        logger.warn(`⚠️  ${error.message}`);
      }

      throw error;
    }
  }

  // Complete Firebase project setup
  async setupCompleteProject(config) {
    const { projectId, displayName, bundleIdAndroid, bundleIdIos, appName, clientFolder } = config;

    this.clientFolder = clientFolder;

    try {
      // Step 1: Create Firebase project
      await this.createProject(projectId, displayName);

      // Step 2: Add Android app
      await this.addAndroidApp(bundleIdAndroid, `${appName} (Android)`);

      // Step 3: Add iOS app
      await this.addIosApp(bundleIdIos, `${appName} (iOS)`);

      // Step 4: Skip macOS app (not supported by Firebase CLI)
      // macOS apps can share the iOS configuration in Flutter
      logger.info('ℹ️  Skipping macOS app creation (uses iOS config in Flutter)');

      // Step 5: Add Web app (used for Web and Windows platforms)
      await this.addWebApp(`${appName} (Web)`);

      // Step 6: Enable Firestore
      await this.enableFirestore();

      // Step 7: Grant service account access (after project is fully set up)
      // Moving this after Firestore to give the project time to fully initialize
      this.grantServiceAccountAccess();

      // Step 8: Download configs
      const androidConfigPath = path.join(clientFolder, 'android', 'google-services.json');
      await this.downloadAndroidConfig(androidConfigPath);

      const iosConfigPath = path.join(clientFolder, 'ios', 'GoogleService-Info.plist');
      await this.downloadIosConfig(iosConfigPath);

      // Step 9: Generate firebase_options.dart
      const optionsPath = await this.generateFlutterFireOptions(clientFolder);

      // Step 10: Parse firebase options
      const firebaseOptions = this.parseFirebaseOptions(optionsPath);

      // Step 11: Grant Firestore permissions to the service account
      this.grantFirestorePermissions();

      // Step 12: Create service account key for the client project
      const serviceAccountPath = path.join(clientFolder, 'service-account.json');
      await this.createClientServiceAccountKey(serviceAccountPath);

      logger.success('Firebase project setup completed successfully!');

      return {
        projectId: this.projectId,
        firebaseOptions,
        serviceAccountPath,
        configFiles: {
          android: androidConfigPath,
          ios: iosConfigPath,
          options: optionsPath,
          serviceAccount: serviceAccountPath,
        },
      };
    } catch (error) {
      logger.error(`Firebase project setup failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = FirebaseProjectCreator;
