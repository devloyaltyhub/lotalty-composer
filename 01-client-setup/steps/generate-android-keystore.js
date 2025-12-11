const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');

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

const KEYSTORE_BASE_CONFIG = {
  // Standard details for all clients
  dname: {
    CN: 'Loyalty Hub Client',
    OU: 'Mobile Development',
    O: 'Loyalty Hub',
    L: 'Rio de Janeiro',
    ST: 'RJ',
    C: 'BR',
  },
  validity: 10000, // days (~27 years)
  keyalg: 'RSA',
  keysize: 2048,
  storetype: 'JKS',
};

/**
 * Generates a cryptographically secure random password component
 * @returns {string} Secure random string (hex encoded)
 */
function generateSecureRandomString() {
  // Generate 16 bytes of random data (32 hex characters)
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates unique secure password for release keystore
 * @param {string} clientCode - Client code for password generation
 * @returns {string} Cryptographically secure password
 */
function generateReleasePassword(clientCode) {
  const randomString = generateSecureRandomString();
  return `lh-${clientCode}-${randomString}`;
}

/**
 * Formats the dname string for keytool command
 */
function formatDname(type = 'release') {
  const { CN, OU, O, L, ST, C } = KEYSTORE_BASE_CONFIG.dname;
  const name = type === 'debug' ? 'Loyalty Hub Debug' : CN;
  return `CN=${name}, OU=${OU}, O=${O}, L=${L}, ST=${ST}, C=${C}`;
}

/**
 * Gets path to loyalty-credentials repository
 */
function getLoyaltyCredentialsPath() {
  // From automation/01-client-setup/steps/ go up to loyaltyhub/loyalty-credentials
  const automationRoot = path.resolve(__dirname, '../..');
  const loyaltyAppRoot = path.resolve(automationRoot, '..');
  const credentialsPath = path.join(loyaltyAppRoot, '..', 'loyalty-credentials');

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`loyalty-credentials repository not found at: ${credentialsPath}`);
  }

  return credentialsPath;
}

/**
 * Generates a single keystore file
 */
async function generateSingleKeystore(config) {
  const { keystorePath, password, alias, dname, type } = config;

  // Check if keystore already exists
  if (fs.existsSync(keystorePath)) {
    console.log(chalk.yellow(`   ⚠️  ${type} keystore already exists. Skipping generation.`));
    return {
      keystorePath,
      sha256: await getSHA256Fingerprint(keystorePath, password, alias),
      password,
      alias,
    };
  }

  try {
    console.log(chalk.cyan(`\n   Generating ${type} keystore...`));
    console.log(chalk.gray(`   Alias: ${alias}`));
    console.log(chalk.gray(`   DN: ${dname}`));

    // Generate keystore using keytool
    const command = [
      'keytool',
      '-genkeypair',
      `-alias ${alias}`,
      `-keyalg ${KEYSTORE_BASE_CONFIG.keyalg}`,
      `-keysize ${KEYSTORE_BASE_CONFIG.keysize}`,
      `-validity ${KEYSTORE_BASE_CONFIG.validity}`,
      `-keystore "${keystorePath}"`,
      `-storetype ${KEYSTORE_BASE_CONFIG.storetype}`,
      `-storepass ${password}`,
      `-keypass ${password}`,
      `-dname "${dname}"`,
    ].join(' ');

    execSync(command, { stdio: 'pipe' });

    // Verify keystore was created
    if (!fs.existsSync(keystorePath)) {
      throw new Error(`${type} keystore file was not created`);
    }

    console.log(chalk.green(`   ✅ ${type} keystore generated`));

    // Get SHA-256 fingerprint
    const sha256 = await getSHA256Fingerprint(keystorePath, password, alias);
    console.log(chalk.cyan(`   SHA-256: ${chalk.white(sha256)}`));

    return {
      keystorePath,
      sha256,
      password,
      alias,
    };
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to generate ${type} keystore:`), error.message);
    throw error;
  }
}

/**
 * Generates both debug and release keystores for a client
 */
async function generateKeystore(clientCode, clientsDir) {
  console.log(chalk.blue('\n📱 Generating Android Keystores...'));
  console.log(chalk.gray('─'.repeat(50)));

  try {
    // Verify keytool is available
    try {
      execSync('keytool -version', { stdio: 'pipe' });
    } catch (e) {
      console.error(chalk.red('\n❌ keytool not found!'));
      console.error(chalk.yellow('   Please install Java JDK to use keytool.'));
      console.error(
        chalk.gray('   Download from: https://www.oracle.com/java/technologies/downloads/')
      );
      throw new Error('keytool not available');
    }

    // Get path to loyalty-credentials
    const credentialsPath = getLoyaltyCredentialsPath();
    const clientCredentialsDir = path.join(credentialsPath, 'clients', clientCode, 'android');

    // Create directory if it doesn't exist
    if (!fs.existsSync(clientCredentialsDir)) {
      fs.mkdirSync(clientCredentialsDir, { recursive: true });
      console.log(chalk.cyan(`   Created directory: ${clientCredentialsDir}`));
    }

    // Debug keystore configuration
    const debugConfig = {
      keystorePath: path.join(clientCredentialsDir, 'keystore-debug.jks'),
      password: 'android-debug-key',
      alias: 'androiddebugkey',
      dname: formatDname('debug'),
      type: 'DEBUG',
    };

    // Release keystore configuration
    const releasePassword = generateReleasePassword(clientCode);
    const releaseConfig = {
      keystorePath: path.join(clientCredentialsDir, 'keystore-release.jks'),
      password: releasePassword,
      alias: 'loyaltyhub-release',
      dname: formatDname('release'),
      type: 'RELEASE',
    };

    // Generate both keystores
    console.log(chalk.cyan('\n🔧 Debug Keystore:'));
    const debugResult = await generateSingleKeystore(debugConfig);

    console.log(chalk.cyan('\n🔧 Release Keystore:'));
    const releaseResult = await generateSingleKeystore(releaseConfig);

    // Create keystore.properties file
    const keystorePropertiesPath = path.join(clientCredentialsDir, 'keystore.properties');
    const propertiesContent = `# Android Keystore Properties
# Generated automatically for client: ${clientCode}
# DO NOT commit to version control

# Debug Keystore (for development builds)
debug.storeFile=keystore-debug.jks
debug.storePassword=${debugResult.password}
debug.keyAlias=${debugResult.alias}
debug.keyPassword=${debugResult.password}
debug.sha256Fingerprint=${debugResult.sha256}

# Release Keystore (for production builds)
release.storeFile=keystore-release.jks
release.storePassword=${releaseResult.password}
release.keyAlias=${releaseResult.alias}
release.keyPassword=${releaseResult.password}
release.sha256Fingerprint=${releaseResult.sha256}

# Details
generated=$(new Date().toISOString())
clientCode=${clientCode}
`;

    fs.writeFileSync(keystorePropertiesPath, propertiesContent);

    // Set secure file permissions (owner read/write only)
    fs.chmodSync(keystorePropertiesPath, 0o600);
    fs.chmodSync(debugResult.keystorePath, 0o600);
    fs.chmodSync(releaseResult.keystorePath, 0o600);

    console.log(chalk.green('\n✅ keystore.properties created with secure permissions'));

    console.log(chalk.green('\n✅ Android keystores setup complete!'));
    console.log(chalk.cyan('\n📁 Keystores saved to:'));
    console.log(chalk.gray(`   ${clientCredentialsDir}`));
    console.log(chalk.yellow('\n⚠️  IMPORTANT:'));
    console.log(chalk.yellow('   - Keep the keystore files secure'));
    console.log(
      chalk.yellow('   - Keystores are in loyalty-credentials repo (NOT committed to loyalty-compose)')
    );
    console.log(
      chalk.yellow('   - Register SHA-256 fingerprints in Firebase Console for App Check')
    );
    console.log(chalk.yellow('\n📋 SHA-256 Fingerprints to add to Firebase:'));
    console.log(chalk.white(`   Debug:   ${debugResult.sha256}`));
    console.log(chalk.white(`   Release: ${releaseResult.sha256}`));

    return {
      debug: debugResult,
      release: releaseResult,
      keystorePropertiesPath,
      clientCredentialsDir,
    };
  } catch (error) {
    console.error(chalk.red('\n❌ Failed to generate keystores:'), error.message);
    throw error;
  }
}

/**
 * Gets the SHA-256 fingerprint from a keystore
 */
async function getSHA256Fingerprint(keystorePath, password, alias) {
  try {
    const command = `keytool -list -v -keystore "${keystorePath}" -alias ${alias} -storepass ${password}`;
    const output = execSync(command, { encoding: 'utf-8' });

    // Extract SHA-256 fingerprint from output
    const sha256Match = output.match(/SHA256:\s*([A-F0-9:]+)/);

    if (!sha256Match) {
      throw new Error('Could not extract SHA-256 fingerprint');
    }

    return sha256Match[1];
  } catch (error) {
    console.error(chalk.red('Failed to get SHA-256 fingerprint:'), error.message);
    throw error;
  }
}

/**
 * Validates that keystore exists and is valid
 */
async function validateKeystore(keystorePath, password, alias) {
  if (!fs.existsSync(keystorePath)) {
    return false;
  }

  try {
    const command = `keytool -list -keystore "${keystorePath}" -alias ${alias} -storepass ${password}`;
    execSync(command, { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  generateKeystore,
  getSHA256Fingerprint,
  validateKeystore,
  getLoyaltyCredentialsPath,
};
