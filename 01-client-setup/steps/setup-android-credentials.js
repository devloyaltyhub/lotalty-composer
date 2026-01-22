const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const {
  formatDname,
  checkKeytoolAvailable,
  validateKeystore,
  generateSingleKeystore,
} = require('./android/keystore-operations');

const {
  getLoyaltyCredentialsPath,
  generateReleasePassword,
  checkGooglePlayCredentials,
  parseExistingKeystoreProperties,
  createKeystorePropertiesContent,
  parseKeystoreProperties,
  getClientCredentialsDir,
} = require('./android/credentials-helpers');

/**
 * Android Credentials Setup
 *
 * Generates Android keystores (debug + release) and validates Google Play credentials.
 * Can be called during client creation or standalone via CLI.
 */

class AndroidCredentialsSetup {
  constructor() {
    this.credentialsPath = getLoyaltyCredentialsPath();
  }

  /**
   * Main setup method - generates keystores for a client
   */
  async setupCredentials(clientCode, _options = {}) {
    console.log(chalk.blue('\n🤖 Setting up Android credentials...'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
      if (!checkKeytoolAvailable()) {
        return { success: false, skipped: true, reason: 'keytool_not_available' };
      }

      const hasGooglePlay = checkGooglePlayCredentials();

      const clientCredentialsDir = getClientCredentialsDir(this.credentialsPath, clientCode);

      if (!fs.existsSync(clientCredentialsDir)) {
        fs.mkdirSync(clientCredentialsDir, { recursive: true });
        console.log(chalk.cyan(`   Created directory: ${clientCredentialsDir}`));
      }

      const keystorePropertiesPath = path.join(clientCredentialsDir, 'keystore.properties');
      const existingReleasePassword = parseExistingKeystoreProperties(keystorePropertiesPath);

      const debugConfig = {
        keystorePath: path.join(clientCredentialsDir, 'keystore-debug.jks'),
        password: 'android-debug-key',
        alias: 'androiddebugkey',
        dname: formatDname('debug'),
        type: 'DEBUG',
      };

      const releasePassword = existingReleasePassword || generateReleasePassword(clientCode);
      const releaseConfig = {
        keystorePath: path.join(clientCredentialsDir, 'keystore-release.jks'),
        password: releasePassword,
        alias: 'loyaltyhub-release',
        dname: formatDname('release'),
        type: 'RELEASE',
      };

      console.log(chalk.cyan('\n🔧 Debug Keystore:'));
      const debugResult = await generateSingleKeystore(debugConfig);

      console.log(chalk.cyan('\n🔧 Release Keystore:'));
      const releaseResult = await generateSingleKeystore(releaseConfig);

      const propertiesContent = createKeystorePropertiesContent(clientCode, debugResult, releaseResult);
      fs.writeFileSync(keystorePropertiesPath, propertiesContent);

      fs.chmodSync(keystorePropertiesPath, 0o600);
      fs.chmodSync(debugResult.keystorePath, 0o600);
      fs.chmodSync(releaseResult.keystorePath, 0o600);

      console.log(chalk.green('\n✅ keystore.properties created with secure permissions'));
      this.printSuccessMessage(clientCredentialsDir, debugResult, releaseResult);

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
      return this.handleSetupError(error);
    }
  }

  /**
   * Validate existing credentials for a client
   */
  async validateCredentials(clientCode) {
    console.log(chalk.blue('\n🔍 Validating Android credentials...'));
    console.log(chalk.gray('─'.repeat(50)));

    const clientCredentialsDir = getClientCredentialsDir(this.credentialsPath, clientCode);
    const keystorePropertiesPath = path.join(clientCredentialsDir, 'keystore.properties');

    const results = {
      valid: true,
      issues: [],
      debug: { exists: false, valid: false },
      release: { exists: false, valid: false },
      googlePlay: { configured: false },
    };

    if (!fs.existsSync(keystorePropertiesPath)) {
      results.valid = false;
      results.issues.push('keystore.properties not found');
      console.log(chalk.red('   ❌ keystore.properties not found'));
      return results;
    }

    const props = parseKeystoreProperties(keystorePropertiesPath);

    await this.validateDebugKeystore(clientCredentialsDir, props, results);
    await this.validateReleaseKeystore(clientCredentialsDir, props, results);

    results.googlePlay.configured = checkGooglePlayCredentials();

    if (results.valid) {
      console.log(chalk.green('\n✅ All Android credentials are valid!'));
    } else {
      console.log(chalk.red('\n❌ Some credentials are invalid or missing'));
      console.log(chalk.yellow('   Run setup again to fix issues'));
    }

    return results;
  }

  async validateDebugKeystore(clientCredentialsDir, props, results) {
    const debugKeystorePath = path.join(clientCredentialsDir, 'keystore-debug.jks');
    if (fs.existsSync(debugKeystorePath)) {
      results.debug.exists = true;
      results.debug.valid = await validateKeystore(debugKeystorePath, props.debugPassword, props.debugAlias);
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
  }

  async validateReleaseKeystore(clientCredentialsDir, props, results) {
    const releaseKeystorePath = path.join(clientCredentialsDir, 'keystore-release.jks');
    if (fs.existsSync(releaseKeystorePath)) {
      results.release.exists = true;
      results.release.valid = await validateKeystore(releaseKeystorePath, props.releasePassword, props.releaseAlias);
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
  }

  printSuccessMessage(clientCredentialsDir, debugResult, releaseResult) {
    console.log(chalk.green('\n✅ Android credentials setup complete!'));
    console.log(chalk.cyan('\n📁 Keystores saved to:'));
    console.log(chalk.gray(`   ${clientCredentialsDir}`));
    console.log(chalk.yellow('\n⚠️  IMPORTANT:'));
    console.log(chalk.yellow('   - Keep the keystore files secure'));
    console.log(chalk.yellow('   - Keystores are in loyalty-credentials repo (NOT committed to loyalty-compose)'));
    console.log(chalk.yellow('   - Register SHA-256 fingerprints in Firebase Console for App Check'));
    console.log(chalk.yellow('\n📋 SHA-256 Fingerprints to add to Firebase:'));
    console.log(chalk.white(`   Debug:   ${debugResult.sha256}`));
    console.log(chalk.white(`   Release: ${releaseResult.sha256}`));
  }

  handleSetupError(error) {
    console.error(chalk.red('\n❌ Failed to setup Android credentials:'), error.message);
    console.log(chalk.yellow('\n   📝 Manual steps required:'));
    console.log(chalk.gray('\n   1. Ensure Java JDK is installed'));
    console.log(chalk.gray('   2. Run: keytool -version'));
    console.log(chalk.gray('   3. Try again after fixing the issue'));

    return { success: false, skipped: false, error: error.message };
  }
}

module.exports = AndroidCredentialsSetup;
