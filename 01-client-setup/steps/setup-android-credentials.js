const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');
const { validateEnvironmentVariables } = require('../shared/input-validator');
const { ValidationError } = require('../../shared/utils/error-handler');

/**
 * Android Credentials Setup
 *
 * Generates Android keystores (debug + release) and validates Google Play credentials.
 * Can be called during client creation or standalone via CLI.
 */

const KEYSTORE_BASE_CONFIG = {
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

class AndroidCredentialsSetup {
  constructor() {
    this.credentialsPath = this.getLoyaltyCredentialsPath();
  }

  /**
   * Gets path to loyalty-credentials repository
   */
  getLoyaltyCredentialsPath() {
    const automationRoot = path.resolve(__dirname, '../..');
    const loyaltyAppRoot = path.resolve(automationRoot, '..');
    const credentialsPath = path.join(loyaltyAppRoot, '..', 'loyalty-credentials');

    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`loyalty-credentials repository not found at: ${credentialsPath}`);
    }

    return credentialsPath;
  }

  /**
   * Check if keytool is available
   */
  checkKeytoolAvailable() {
    try {
      execSync('keytool -version', { stdio: 'pipe' });
      return true;
    } catch (e) {
      console.log(chalk.red('\n❌ keytool not found!'));
      console.log(chalk.yellow('   Please install Java JDK to use keytool.'));
      console.log(chalk.gray('   Download from: https://www.oracle.com/java/technologies/downloads/'));
      return false;
    }
  }

  /**
   * Check Google Play environment variables
   */
  checkGooglePlayCredentials() {
    const requiredVars = ['GOOGLE_PLAY_JSON_KEY'];

    try {
      validateEnvironmentVariables(requiredVars);
    } catch (error) {
      console.log(chalk.yellow('\n⚠️  Missing Google Play credentials:'));
      if (error instanceof ValidationError && error.metadata?.missing) {
        error.metadata.missing.forEach((varName) => {
          console.log(chalk.gray(`   - ${varName}`));
        });
      }
      console.log(chalk.yellow('\n   Google Play deployment will not be available.'));
      console.log(chalk.gray('   Add GOOGLE_PLAY_JSON_KEY to automation/.env to enable deployment.'));
      return false;
    }

    // Validate the file exists
    const jsonKeyPath = process.env.GOOGLE_PLAY_JSON_KEY;
    if (!fs.existsSync(jsonKeyPath)) {
      console.log(chalk.yellow('\n⚠️  Google Play JSON key file not found:'));
      console.log(chalk.gray(`   ${jsonKeyPath}`));
      console.log(chalk.yellow('\n   Create a service account in Google Cloud Console and download the JSON key.'));
      return false;
    }

    console.log(chalk.green('   ✓ Google Play credentials validated'));
    return true;
  }

  /**
   * Generates a cryptographically secure random password component
   */
  generateSecureRandomString() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generates unique secure password for release keystore
   */
  generateReleasePassword(clientCode) {
    const randomString = this.generateSecureRandomString();
    return `lh-${clientCode}-${randomString}`;
  }

  /**
   * Formats the dname string for keytool command
   */
  formatDname(type = 'release') {
    const { CN, OU, O, L, ST, C } = KEYSTORE_BASE_CONFIG.dname;
    const name = type === 'debug' ? 'Loyalty Hub Debug' : CN;
    return `CN=${name}, OU=${OU}, O=${O}, L=${L}, ST=${ST}, C=${C}`;
  }

  /**
   * Gets the SHA-256 fingerprint from a keystore
   */
  async getSHA256Fingerprint(keystorePath, password, alias) {
    try {
      const command = `keytool -list -v -keystore "${keystorePath}" -alias ${alias} -storepass ${password}`;
      const output = execSync(command, { encoding: 'utf-8' });

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
   * Generates a single keystore file
   */
  async generateSingleKeystore(config) {
    const { keystorePath, password, alias, dname, type } = config;

    // Check if keystore already exists
    if (fs.existsSync(keystorePath)) {
      console.log(chalk.yellow(`   ⚠️  ${type} keystore already exists. Skipping generation.`));
      return {
        keystorePath,
        sha256: await this.getSHA256Fingerprint(keystorePath, password, alias),
        password,
        alias,
        alreadyExisted: true,
      };
    }

    try {
      console.log(chalk.cyan(`\n   Generating ${type} keystore...`));
      console.log(chalk.gray(`   Alias: ${alias}`));
      console.log(chalk.gray(`   DN: ${dname}`));

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

      if (!fs.existsSync(keystorePath)) {
        throw new Error(`${type} keystore file was not created`);
      }

      console.log(chalk.green(`   ✅ ${type} keystore generated`));

      const sha256 = await this.getSHA256Fingerprint(keystorePath, password, alias);
      console.log(chalk.cyan(`   SHA-256: ${chalk.white(sha256)}`));

      return {
        keystorePath,
        sha256,
        password,
        alias,
        alreadyExisted: false,
      };
    } catch (error) {
      console.error(chalk.red(`\n❌ Failed to generate ${type} keystore:`), error.message);
      throw error;
    }
  }

  /**
   * Validates that keystore exists and is valid
   */
  async validateKeystore(keystorePath, password, alias) {
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

  /**
   * Check if client config exists
   */
  checkClientConfigured(clientCode) {
    const loyaltyAppRoot = path.resolve(__dirname, '..', '..', '..');
    const clientsDir = path.join(loyaltyAppRoot, 'clients');
    const configPath = path.join(clientsDir, clientCode, 'config.json');

    if (!fs.existsSync(configPath)) {
      console.log(chalk.yellow(`\n⚠️  Client config not found: ${configPath}`));
      console.log(chalk.yellow('   Make sure the client was created with the setup wizard'));
      return null;
    }

    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(chalk.cyan(`   ✓ Client config found: ${configPath}`));
      return config;
    } catch (error) {
      console.log(chalk.red(`   ❌ Error reading config: ${error.message}`));
      return null;
    }
  }

  /**
   * Main setup method - generates keystores for a client
   */
  async setupCredentials(clientCode, options = {}) {
    console.log(chalk.blue('\n🤖 Setting up Android credentials...'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
      // Check keytool
      if (!this.checkKeytoolAvailable()) {
        return {
          success: false,
          skipped: true,
          reason: 'keytool_not_available',
        };
      }

      // Check Google Play credentials (optional, just warns)
      const hasGooglePlay = this.checkGooglePlayCredentials();

      // Create directory structure
      const clientCredentialsDir = path.join(this.credentialsPath, 'clients', clientCode, 'android');

      if (!fs.existsSync(clientCredentialsDir)) {
        fs.mkdirSync(clientCredentialsDir, { recursive: true });
        console.log(chalk.cyan(`   Created directory: ${clientCredentialsDir}`));
      }

      // Read existing keystore.properties if exists (to preserve passwords)
      const keystorePropertiesPath = path.join(clientCredentialsDir, 'keystore.properties');
      let existingReleasePassword = null;

      if (fs.existsSync(keystorePropertiesPath)) {
        const existingProps = fs.readFileSync(keystorePropertiesPath, 'utf8');
        const passwordMatch = existingProps.match(/release\.storePassword=(.+)/);
        if (passwordMatch) {
          existingReleasePassword = passwordMatch[1].trim();
        }
      }

      // Debug keystore configuration
      const debugConfig = {
        keystorePath: path.join(clientCredentialsDir, 'keystore-debug.jks'),
        password: 'android-debug-key',
        alias: 'androiddebugkey',
        dname: this.formatDname('debug'),
        type: 'DEBUG',
      };

      // Release keystore configuration
      const releasePassword = existingReleasePassword || this.generateReleasePassword(clientCode);
      const releaseConfig = {
        keystorePath: path.join(clientCredentialsDir, 'keystore-release.jks'),
        password: releasePassword,
        alias: 'loyaltyhub-release',
        dname: this.formatDname('release'),
        type: 'RELEASE',
      };

      // Generate both keystores
      console.log(chalk.cyan('\n🔧 Debug Keystore:'));
      const debugResult = await this.generateSingleKeystore(debugConfig);

      console.log(chalk.cyan('\n🔧 Release Keystore:'));
      const releaseResult = await this.generateSingleKeystore(releaseConfig);

      // Create keystore.properties file
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
generated=${new Date().toISOString()}
clientCode=${clientCode}
`;

      fs.writeFileSync(keystorePropertiesPath, propertiesContent);

      // Set secure file permissions (owner read/write only)
      fs.chmodSync(keystorePropertiesPath, 0o600);
      fs.chmodSync(debugResult.keystorePath, 0o600);
      fs.chmodSync(releaseResult.keystorePath, 0o600);

      console.log(chalk.green('\n✅ keystore.properties created with secure permissions'));

      console.log(chalk.green('\n✅ Android credentials setup complete!'));
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
        success: true,
        skipped: false,
        debug: debugResult,
        release: releaseResult,
        keystorePropertiesPath,
        clientCredentialsDir,
        hasGooglePlayCredentials: hasGooglePlay,
      };
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to setup Android credentials:'), error.message);
      console.log(chalk.yellow('\n   📝 Manual steps required:'));
      console.log(chalk.gray('\n   1. Ensure Java JDK is installed'));
      console.log(chalk.gray('   2. Run: keytool -version'));
      console.log(chalk.gray('   3. Try again after fixing the issue'));

      return {
        success: false,
        skipped: false,
        error: error.message,
      };
    }
  }

  /**
   * Validate existing credentials for a client
   */
  async validateCredentials(clientCode) {
    console.log(chalk.blue('\n🔍 Validating Android credentials...'));
    console.log(chalk.gray('─'.repeat(50)));

    const clientCredentialsDir = path.join(this.credentialsPath, 'clients', clientCode, 'android');
    const keystorePropertiesPath = path.join(clientCredentialsDir, 'keystore.properties');

    const results = {
      valid: true,
      issues: [],
      debug: { exists: false, valid: false },
      release: { exists: false, valid: false },
      googlePlay: { configured: false },
    };

    // Check keystore.properties
    if (!fs.existsSync(keystorePropertiesPath)) {
      results.valid = false;
      results.issues.push('keystore.properties not found');
      console.log(chalk.red('   ❌ keystore.properties not found'));
      return results;
    }

    // Parse properties
    const props = fs.readFileSync(keystorePropertiesPath, 'utf8');
    const debugPassword = props.match(/debug\.storePassword=(.+)/)?.[1]?.trim();
    const debugAlias = props.match(/debug\.keyAlias=(.+)/)?.[1]?.trim();
    const releasePassword = props.match(/release\.storePassword=(.+)/)?.[1]?.trim();
    const releaseAlias = props.match(/release\.keyAlias=(.+)/)?.[1]?.trim();

    // Validate debug keystore
    const debugKeystorePath = path.join(clientCredentialsDir, 'keystore-debug.jks');
    if (fs.existsSync(debugKeystorePath)) {
      results.debug.exists = true;
      results.debug.valid = await this.validateKeystore(debugKeystorePath, debugPassword, debugAlias);
      if (results.debug.valid) {
        console.log(chalk.green('   ✓ Debug keystore valid'));
      } else {
        results.valid = false;
        results.issues.push('Debug keystore invalid or password incorrect');
        console.log(chalk.red('   ❌ Debug keystore invalid'));
      }
    } else {
      results.valid = false;
      results.issues.push('Debug keystore not found');
      console.log(chalk.red('   ❌ Debug keystore not found'));
    }

    // Validate release keystore
    const releaseKeystorePath = path.join(clientCredentialsDir, 'keystore-release.jks');
    if (fs.existsSync(releaseKeystorePath)) {
      results.release.exists = true;
      results.release.valid = await this.validateKeystore(releaseKeystorePath, releasePassword, releaseAlias);
      if (results.release.valid) {
        console.log(chalk.green('   ✓ Release keystore valid'));
      } else {
        results.valid = false;
        results.issues.push('Release keystore invalid or password incorrect');
        console.log(chalk.red('   ❌ Release keystore invalid'));
      }
    } else {
      results.valid = false;
      results.issues.push('Release keystore not found');
      console.log(chalk.red('   ❌ Release keystore not found'));
    }

    // Check Google Play credentials
    results.googlePlay.configured = this.checkGooglePlayCredentials();

    if (results.valid) {
      console.log(chalk.green('\n✅ All Android credentials are valid!'));
    } else {
      console.log(chalk.red('\n❌ Some credentials are invalid or missing'));
      console.log(chalk.yellow('   Run setup again to fix issues'));
    }

    return results;
  }
}

module.exports = AndroidCredentialsSetup;
