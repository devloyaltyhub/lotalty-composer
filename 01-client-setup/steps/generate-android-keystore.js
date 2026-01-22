const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const {
  KEYSTORE_BASE_CONFIG,
  formatDname,
  checkKeytoolAvailable,
  getSHA256Fingerprint,
  validateKeystore,
  generateSingleKeystore,
} = require('./android/keystore-operations');

const {
  getLoyaltyCredentialsPath,
  generateReleasePassword,
  createKeystorePropertiesContent,
} = require('./android/credentials-helpers');

/**
 * Generate Android Keystores for Client (Debug + Release)
 *
 * This step generates TWO keystore files for signing the Android app:
 * 1. Debug keystore - for development builds (standard password)
 * 2. Release keystore - for production builds (unique password per client)
 *
 * The keystores are required for:
 * - Play Store releases
 * - App Check Play Integrity API
 * - Consistent app signing across builds
 *
 * Keystores are stored in loyalty-credentials repository for security.
 */

const DEBUG_KEYSTORE_CONFIG = {
  password: 'android-debug-key',
  alias: 'androiddebugkey',
  filename: 'keystore-debug.jks',
};

const RELEASE_KEYSTORE_CONFIG = {
  alias: 'loyaltyhub-release',
  filename: 'keystore-release.jks',
};

/**
 * Creates the client credentials directory if it doesn't exist
 */
function ensureClientCredentialsDir(clientCredentialsDir) {
  if (!fs.existsSync(clientCredentialsDir)) {
    fs.mkdirSync(clientCredentialsDir, { recursive: true });
    console.log(chalk.cyan(`   Created directory: ${clientCredentialsDir}`));
  }
}

/**
 * Creates debug keystore configuration
 */
function createDebugConfig(clientCredentialsDir) {
  return {
    keystorePath: path.join(clientCredentialsDir, DEBUG_KEYSTORE_CONFIG.filename),
    password: DEBUG_KEYSTORE_CONFIG.password,
    alias: DEBUG_KEYSTORE_CONFIG.alias,
    dname: formatDname('debug'),
    type: 'DEBUG',
  };
}

/**
 * Creates release keystore configuration
 */
function createReleaseConfig(clientCredentialsDir, clientCode) {
  return {
    keystorePath: path.join(clientCredentialsDir, RELEASE_KEYSTORE_CONFIG.filename),
    password: generateReleasePassword(clientCode),
    alias: RELEASE_KEYSTORE_CONFIG.alias,
    dname: formatDname('release'),
    type: 'RELEASE',
  };
}

/**
 * Sets secure file permissions on keystore files
 */
function setSecurePermissions(keystorePropertiesPath, debugKeystorePath, releaseKeystorePath) {
  fs.chmodSync(keystorePropertiesPath, 0o600);
  fs.chmodSync(debugKeystorePath, 0o600);
  fs.chmodSync(releaseKeystorePath, 0o600);
}

/**
 * Displays completion summary with SHA-256 fingerprints
 */
function displayCompletionSummary(clientCredentialsDir, debugResult, releaseResult) {
  console.log(chalk.green('\n✅ Android keystores setup complete!'));
  console.log(chalk.cyan('\n   Keystores saved to:'));
  console.log(chalk.gray(`   ${clientCredentialsDir}`));
  console.log(chalk.yellow('\n   IMPORTANT:'));
  console.log(chalk.yellow('   - Keep the keystore files secure'));
  console.log(
    chalk.yellow('   - Keystores are in loyalty-credentials repo (NOT committed to loyalty-composer)')
  );
  console.log(chalk.yellow('   - Register SHA-256 fingerprints in Firebase Console for App Check'));
  console.log(chalk.yellow('\n   SHA-256 Fingerprints to add to Firebase:'));
  console.log(chalk.white(`   Debug:   ${debugResult.sha256}`));
  console.log(chalk.white(`   Release: ${releaseResult.sha256}`));
}

/**
 * Generates both debug and release keystores for a client
 */
async function generateKeystore(clientCode, _clientsDir) {
  console.log(chalk.blue('\n   Generating Android Keystores...'));
  console.log(chalk.gray('   ' + '-'.repeat(47)));

  try {
    if (!checkKeytoolAvailable()) {
      throw new Error('keytool not available');
    }

    const credentialsPath = getLoyaltyCredentialsPath();
    const clientCredentialsDir = path.join(credentialsPath, 'clients', clientCode, 'android');

    ensureClientCredentialsDir(clientCredentialsDir);

    const debugConfig = createDebugConfig(clientCredentialsDir);
    const releaseConfig = createReleaseConfig(clientCredentialsDir, clientCode);

    console.log(chalk.cyan('\n   Debug Keystore:'));
    const debugResult = await generateSingleKeystore(debugConfig);

    console.log(chalk.cyan('\n   Release Keystore:'));
    const releaseResult = await generateSingleKeystore(releaseConfig);

    const keystorePropertiesPath = path.join(clientCredentialsDir, 'keystore.properties');
    const propertiesContent = createKeystorePropertiesContent(clientCode, debugResult, releaseResult);

    fs.writeFileSync(keystorePropertiesPath, propertiesContent);
    setSecurePermissions(keystorePropertiesPath, debugResult.keystorePath, releaseResult.keystorePath);

    console.log(chalk.green('\n   keystore.properties created with secure permissions'));

    displayCompletionSummary(clientCredentialsDir, debugResult, releaseResult);

    return {
      debug: debugResult,
      release: releaseResult,
      keystorePropertiesPath,
      clientCredentialsDir,
    };
  } catch (error) {
    console.error(chalk.red('\n   Failed to generate keystores:'), error.message);
    throw error;
  }
}

module.exports = {
  generateKeystore,
  getSHA256Fingerprint,
  validateKeystore,
  getLoyaltyCredentialsPath,
  KEYSTORE_BASE_CONFIG,
};
