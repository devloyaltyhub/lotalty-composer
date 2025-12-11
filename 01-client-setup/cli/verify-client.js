#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const logger = require('../../shared/utils/logger');
const clientSelector = require('../../shared/utils/client-selector');
const firebaseClient = require('../shared/firebase-manager');
const { execSync } = require('child_process');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Client Health Check Script
 * Verifies that a client setup is complete and healthy
 *
 * Checks:
 * - Config file exists and is valid
 * - Firebase project exists and is accessible
 * - Assets are complete (all required categories)
 * - Git branch exists
 * - Metadata exists (Android/iOS)
 * - Android certificates (keystores and properties)
 * - iOS certificates (provisioning profiles and distribution certs)
 * - Firestore has seed data
 */

/**
 * Expand environment variables in a path string (e.g., $HOME, $USER)
 */
function expandEnvVars(pathStr) {
  if (!pathStr) return pathStr;
  return pathStr.replace(/\$([A-Z_][A-Z0-9_]*)/gi, (match, varName) => {
    return process.env[varName] || match;
  });
}
class ClientHealthCheck {
  constructor(clientName) {
    this.clientName = clientName;
    this.clientDir = clientSelector.getClientDir(clientName);
    this.config = null;
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
    };
  }

  /**
   * Add a passed check
   */
  pass(message) {
    this.results.passed.push(message);
    logger.success(`✓ ${message}`);
  }

  /**
   * Add a failed check
   */
  fail(message) {
    this.results.failed.push(message);
    logger.error(`✗ ${message}`);
  }

  /**
   * Add a warning
   */
  warn(message) {
    this.results.warnings.push(message);
    logger.warn(`⚠️  ${message}`);
  }

  /**
   * Add an info message (not critical, just informative)
   */
  info(message) {
    logger.info(`ℹ️  ${message}`);
  }

  /**
   * Check if config file exists and is valid
   */
  checkConfig() {
    logger.info('Checking configuration...');

    try {
      const configPath = clientSelector.getClientConfigPath(this.clientName);

      if (!fs.existsSync(configPath)) {
        this.fail('Config file not found');
        return false;
      }

      this.config = clientSelector.loadClientConfig(this.clientName);

      // Validate required fields
      const requiredFields = [
        'clientName',
        'clientCode',
        'bundleId',
        'firebaseProjectId',
        'adminEmail',
        'businessType',
      ];

      const missing = requiredFields.filter((field) => !this.config[field]);

      if (missing.length > 0) {
        this.fail(`Config missing fields: ${missing.join(', ')}`);
        return false;
      }

      this.pass('Config file valid');
      return true;
    } catch (error) {
      this.fail(`Config error: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if Firebase project exists and is accessible
   */
  async checkFirebase() {
    logger.info('Checking Firebase project...');

    if (!this.config) {
      this.fail('Cannot check Firebase: config not loaded');
      return false;
    }

    try {
      // Try to list Firebase projects to see if it exists
      const projects = execSync('firebase projects:list --json', {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const projectList = JSON.parse(projects);
      const exists = projectList.result?.some((p) => p.projectId === this.config.firebaseProjectId);

      if (!exists) {
        this.fail(`Firebase project not found: ${this.config.firebaseProjectId}`);
        return false;
      }

      this.pass(`Firebase project exists: ${this.config.firebaseProjectId}`);

      // Note: Firestore data check is done separately in checkFirestoreData()
      // which properly initializes Firebase with service account credentials

      return true;
    } catch (error) {
      this.fail(`Firebase check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if assets are complete
   */
  checkAssets() {
    logger.info('Checking assets...');

    const assetsDir = path.join(this.clientDir, 'assets');

    if (!fs.existsSync(assetsDir)) {
      this.fail('Assets directory not found');
      return false;
    }

    // Check client-specific assets
    const clientSpecificDir = path.join(assetsDir, 'client_specific_assets');

    if (!fs.existsSync(clientSpecificDir)) {
      this.fail('client_specific_assets directory not found');
      return false;
    }

    const requiredAssets = ['logo.png', 'transparent-logo.png'];
    const missingAssets = requiredAssets.filter(
      (asset) => !fs.existsSync(path.join(clientSpecificDir, asset))
    );

    if (missingAssets.length > 0) {
      this.fail(`Missing client assets: ${missingAssets.join(', ')}`);
      return false;
    }

    this.pass('Client-specific assets complete');
    return true;
  }

  /**
   * Check if git branch exists
   */
  checkGitBranch() {
    logger.info('Checking git branch...');

    if (!this.config || !this.config.clientCode) {
      this.warn('Client code not in config, skipping git check');
      return true;
    }

    try {
      const branches = execSync('git branch -a', {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      // Check if deploy branch exists (created in Phase 02)
      const deployBranch = `deploy/${this.config.clientCode}`;
      const branchExists = branches.includes(deployBranch);

      if (!branchExists) {
        // This is normal for Phase 01 - deploy branch is only created during build
        logger.info(`ℹ️  Deploy branch will be created during build phase: ${deployBranch}`);
      } else {
        this.pass(`Deploy branch exists: ${deployBranch}`);
      }

      // Check if client config is in main branch
      try {
        const clientDir = `clients/${this.config.clientCode}`;
        execSync(`git ls-tree -r main --name-only | grep "^${clientDir}/"`, {
          stdio: 'pipe',
        });
        this.pass(`Client config exists in main branch`);
      } catch {
        this.fail(`Client config not found in main branch`);
        return false;
      }

      return true;
    } catch (error) {
      this.fail(`Git check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if metadata exists
   */
  checkMetadata() {
    logger.info('Checking app store metadata...');

    const metadataDir = path.join(this.clientDir, 'metadata');

    if (!fs.existsSync(metadataDir)) {
      this.fail('Metadata directory not found');
      return false;
    }

    // Get locale from config (default to pt-BR for backwards compatibility)
    const locale = this.config?.locale || 'pt-BR';

    // Check Android metadata
    const androidMetadata = path.join(metadataDir, 'android', locale, 'title.txt');
    if (!fs.existsSync(androidMetadata)) {
      this.fail('Android metadata incomplete');
    } else {
      this.pass('Android metadata exists');
    }

    // Check iOS metadata
    const iosMetadata = path.join(metadataDir, 'ios', locale, 'name.txt');
    if (!fs.existsSync(iosMetadata)) {
      this.fail('iOS metadata incomplete');
    } else {
      this.pass('iOS metadata exists');
    }

    return true;
  }

  /**
   * Check if Firestore has seed data
   */
  async checkFirestoreData() {
    logger.info('Checking Firestore data...');

    if (!this.config || !this.config.firebaseOptions) {
      this.warn('Cannot check Firestore data: Firebase not configured');
      return true;
    }

    try {
      // Initialize Firebase app if not already initialized
      const serviceAccountPath = path.join(this.clientDir, 'service-account.json');

      if (!fs.existsSync(serviceAccountPath)) {
        this.warn('Service account not found, skipping Firestore check');
        return true;
      }

      await firebaseClient.initializeClientFirebase(
        this.config.clientCode,
        this.config.firebaseOptions,
        serviceAccountPath,
      );

      const firestore = firebaseClient.getClientFirestore(this.config.clientCode);

      // Check for seed collections
      const collectionsToCheck = ['Categories', 'Products', 'Store_Configs'];
      let foundCollections = 0;

      for (const collection of collectionsToCheck) {
        const snapshot = await firestore.collection(collection).limit(1).get();
        if (!snapshot.empty) {
          foundCollections++;
        }
      }

      if (foundCollections === 0) {
        this.fail('No seed data found in Firestore');
        return false;
      }

      if (foundCollections < collectionsToCheck.length) {
        this.warn(
          `Some seed collections missing (found ${foundCollections}/${collectionsToCheck.length})`
        );
      } else {
        this.pass('Firestore seed data present');
      }

      return true;
    } catch (error) {
      this.fail(`Firestore data check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if Android certificates exist
   */
  checkAndroidCertificates() {
    logger.info('Checking Android certificates...');

    if (!this.config || !this.config.clientCode) {
      this.warn('Client code not in config, skipping Android certificates check');
      return true;
    }

    // Check for loyalty-credentials directory (relative to script location)
    const loyaltyAppRoot = path.join(__dirname, '..', '..', '..');
    const credentialsDir = path.join(loyaltyAppRoot, '..', 'loyalty-credentials');

    if (!fs.existsSync(credentialsDir)) {
      this.warn('loyalty-credentials directory not found');
      logger.info('   Run the setup wizard to generate Android keystores');
      return true;
    }

    const androidDir = path.join(credentialsDir, 'clients', this.config.clientCode, 'android');

    if (!fs.existsSync(androidDir)) {
      this.fail('Android certificates directory not found');
      logger.info('   Run: npm run setup:keystore');
      return false;
    }

    // Check for required keystores
    const keystoreDebug = path.join(androidDir, 'keystore-debug.jks');
    const keystoreRelease = path.join(androidDir, 'keystore-release.jks');
    const keystoreProps = path.join(androidDir, 'keystore.properties');

    let allPresent = true;

    if (!fs.existsSync(keystoreDebug)) {
      this.fail('Android debug keystore not found');
      allPresent = false;
    } else {
      this.pass('Android debug keystore exists');
    }

    if (!fs.existsSync(keystoreRelease)) {
      this.fail('Android release keystore not found');
      allPresent = false;
    } else {
      this.pass('Android release keystore exists');
    }

    if (!fs.existsSync(keystoreProps)) {
      this.fail('Android keystore.properties not found');
      allPresent = false;
    } else {
      this.pass('Android keystore.properties exists');

      // Validate keystore.properties has required fields
      try {
        const propsContent = fs.readFileSync(keystoreProps, 'utf8');
        const requiredProps = [
          'debug.storeFile',
          'debug.storePassword',
          'debug.keyAlias',
          'release.storeFile',
          'release.storePassword',
          'release.keyAlias',
        ];

        const missingProps = requiredProps.filter((prop) => !propsContent.includes(prop));

        if (missingProps.length > 0) {
          this.warn(`keystore.properties missing fields: ${missingProps.join(', ')}`);
        }
      } catch (error) {
        this.warn(`Could not validate keystore.properties: ${error.message}`);
      }
    }

    if (!allPresent) {
      logger.info('   Run: npm run setup:keystore');
    }

    return allPresent;
  }

  /**
   * Check if deployment credentials are configured
   */
  checkDeploymentCredentials() {
    logger.info('Checking deployment credentials...');

    let hasIssues = false;

    // Google Play credentials (optional - only needed for automated Play Store deployment)
    const googlePlayKey = expandEnvVars(process.env.GOOGLE_PLAY_JSON_KEY);
    if (!googlePlayKey) {
      this.info('Google Play API not configured (manual upload required for first release)');
    } else if (!fs.existsSync(path.resolve(googlePlayKey))) {
      this.info('Google Play JSON key file not found (configure after first app upload)');
    } else {
      this.pass('Google Play credentials configured');
    }

    // App Store Connect credentials
    const appStoreKeyId = process.env.APP_STORE_CONNECT_API_KEY_ID;
    const appStoreIssuerId = process.env.APP_STORE_CONNECT_API_ISSUER_ID;
    const appStoreKeyPath = expandEnvVars(process.env.APP_STORE_CONNECT_API_KEY);

    if (!appStoreKeyId || !appStoreIssuerId) {
      this.warn('App Store Connect API credentials not configured (iOS deploy disabled)');
      hasIssues = true;
    } else if (appStoreKeyPath && !fs.existsSync(path.resolve(appStoreKeyPath))) {
      this.warn(`App Store Connect API key file not found: ${appStoreKeyPath}`);
      hasIssues = true;
    } else if (appStoreKeyId && appStoreIssuerId) {
      this.pass('App Store Connect credentials configured');
    }

    if (!hasIssues) {
      this.pass('All deployment credentials configured');
    }

    return !hasIssues;
  }

  /**
   * Check if screenshots exist for store submission
   * Screenshots are stored in white_label_app/metadata/ (not in clients/{client}/metadata/)
   */
  checkScreenshotsPresent() {
    logger.info('Checking screenshots...');

    // Screenshots are stored in white_label_app/metadata/, not in client directory
    const loyaltyAppRoot = path.join(__dirname, '..', '..', '..');
    const metadataDir = path.join(loyaltyAppRoot, 'white_label_app', 'metadata');

    // Android screenshots
    const androidScreenshots = path.join(metadataDir, 'android', 'pt-BR', 'images', 'phoneScreenshots');
    let androidCount = 0;

    if (fs.existsSync(androidScreenshots)) {
      androidCount = fs.readdirSync(androidScreenshots).filter((f) => f.endsWith('.png')).length;
    }

    if (androidCount < 2) {
      this.warn(`Android screenshots: ${androidCount} (minimo 2 necessarios para Play Store)`);
    } else {
      this.pass(`Android screenshots: ${androidCount}`);
    }

    // iOS screenshots (check main size) - device folders directly under locale (Fastlane format)
    const iosScreenshots = path.join(metadataDir, 'ios', 'pt-BR', 'APP_IPHONE_65');
    let iosCount = 0;

    if (fs.existsSync(iosScreenshots)) {
      iosCount = fs.readdirSync(iosScreenshots).filter((f) => f.endsWith('.png')).length;
    }

    if (iosCount < 2) {
      this.warn(`iOS screenshots (6.5"): ${iosCount} (minimo 2 necessarios para App Store)`);
    } else {
      this.pass(`iOS screenshots (6.5"): ${iosCount}`);
    }

    // Check additional iOS sizes (Fastlane folder names)
    const iosSizes = ['APP_IPHONE_55', 'APP_IPAD_PRO_129'];
    for (const size of iosSizes) {
      const sizePath = path.join(metadataDir, 'ios', 'pt-BR', size);
      if (fs.existsSync(sizePath)) {
        const count = fs.readdirSync(sizePath).filter((f) => f.endsWith('.png')).length;
        if (count > 0) {
          this.pass(`iOS screenshots (${size}): ${count}`);
        }
      }
    }

    return androidCount >= 2 || iosCount >= 2;
  }

  /**
   * Check if iOS certificates exist
   */
  checkIosCertificates() {
    logger.info('Checking iOS certificates...');

    if (!this.config || !this.config.clientCode) {
      this.warn('Client code not in config, skipping iOS certificates check');
      return true;
    }

    // Check for loyalty-credentials directory (relative to script location)
    const loyaltyAppRoot = path.join(__dirname, '..', '..', '..');
    const credentialsDir = path.join(loyaltyAppRoot, '..', 'loyalty-credentials');

    if (!fs.existsSync(credentialsDir)) {
      this.warn('loyalty-credentials directory not found');
      logger.info('   iOS certificates are stored in loyalty-credentials repository');
      return true;
    }

    // Check for iOS certificates directory
    const iosClientDir = path.join(credentialsDir, 'clients', this.config.clientCode, 'ios');
    const iosSharedDir = path.join(credentialsDir, 'certs', 'distribution');

    // Check for environment variables required for iOS certificate generation
    const requiredEnvVars = [
      'MATCH_GIT_URL',
      'MATCH_PASSWORD',
      'APPLE_TEAM_ID',
      'APP_STORE_CONNECT_API_KEY_ID',
      'APP_STORE_CONNECT_API_ISSUER_ID',
      'APP_STORE_CONNECT_API_KEY',
    ];

    const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingEnvVars.length > 0) {
      this.warn(`iOS certificate environment variables not set: ${missingEnvVars.join(', ')}`);
      logger.info('   Set these variables to enable iOS certificate generation');
    }

    // Check if iOS certificates exist
    if (!fs.existsSync(iosClientDir)) {
      this.fail('iOS certificates directory not found');
      logger.info('   Run: npm run setup:ios');
      return false;
    }

    // Check for provisioning profiles
    const profiles = fs.readdirSync(iosClientDir).filter((f) => f.endsWith('.mobileprovision'));

    if (profiles.length === 0) {
      this.fail('No iOS provisioning profiles found');
      logger.info('   Run: npm run setup:ios');
      return false;
    }

    this.pass(
      `iOS provisioning profiles found (${profiles.length} profile${profiles.length > 1 ? 's' : ''})`
    );

    // Check for shared distribution certificates
    if (fs.existsSync(iosSharedDir)) {
      const certs = fs
        .readdirSync(iosSharedDir)
        .filter((f) => f.endsWith('.cer') || f.endsWith('.p12'));
      if (certs.length > 0) {
        this.pass(
          `iOS distribution certificates found (${certs.length} certificate${certs.length > 1 ? 's' : ''})`
        );
      } else {
        this.warn('No iOS distribution certificates found in shared directory');
      }
    }

    return true;
  }

  /**
   * Run all health checks
   */
  async runAll() {
    logger.section(`Health Check: ${this.clientName}`);
    logger.blank();

    // Run checks in sequence
    this.checkConfig();

    if (this.config) {
      await this.checkFirebase();
      this.checkAssets();
      this.checkGitBranch();
      this.checkMetadata();
      this.checkScreenshotsPresent();
      this.checkAndroidCertificates();
      this.checkIosCertificates();
      this.checkDeploymentCredentials();
      await this.checkFirestoreData();
    }

    // Print summary
    logger.blank();
    logger.section('Health Check Summary');

    if (this.results.passed.length > 0) {
      logger.success(`\nPassed: ${this.results.passed.length}`);
      this.results.passed.forEach((msg) => logger.info(`  ✓ ${msg}`));
    }

    if (this.results.warnings.length > 0) {
      logger.warn(`\nWarnings: ${this.results.warnings.length}`);
      this.results.warnings.forEach((msg) => logger.warn(`  ⚠️  ${msg}`));
    }

    if (this.results.failed.length > 0) {
      logger.error(`\nFailed: ${this.results.failed.length}`);
      this.results.failed.forEach((msg) => logger.error(`  ✗ ${msg}`));
    }

    logger.blank();

    // Overall status
    if (this.results.failed.length === 0) {
      logger.success('🎉 Client is healthy!');
      return true;
    } else {
      logger.error('❌ Client has issues that need attention');
      return false;
    }
  }
}

// Main execution
async function main() {
  try {
    // Select client (skip prompt if client name is provided)
    const clientName = await clientSelector.selectClientOrPrompt(process.argv[2], {
      message: 'Select client to verify:',
    });

    // Run health check
    const healthCheck = new ClientHealthCheck(clientName);
    const healthy = await healthCheck.runAll();

    process.exit(healthy ? 0 : 1);
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    process.exit(1);
  } finally {
    firebaseClient.cleanup();
  }
}

// Export for programmatic use
module.exports = ClientHealthCheck;

// Only run if executed directly (not imported)
if (require.main === module) {
  main();
}
