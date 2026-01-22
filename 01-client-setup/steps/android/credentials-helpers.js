const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');
const { validateEnvironmentVariables } = require('../../shared/input-validator');
const { ValidationError } = require('../../../shared/utils/error-handler');
const { LOYALTY_CREDENTIALS_ROOT, getClientConfigPath } = require('../../../shared/utils/paths');

/**
 * Android Credentials Helpers
 *
 * Password generation, Google Play validation, and client config utilities.
 */

/**
 * Gets path to loyalty-credentials repository
 */
function getLoyaltyCredentialsPath() {
  if (!fs.existsSync(LOYALTY_CREDENTIALS_ROOT)) {
    throw new Error(`loyalty-credentials repository not found at: ${LOYALTY_CREDENTIALS_ROOT}`);
  }
  return LOYALTY_CREDENTIALS_ROOT;
}

/**
 * Generates a cryptographically secure random password component
 */
function generateSecureRandomString() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates unique secure password for release keystore
 */
function generateReleasePassword(clientCode) {
  const randomString = generateSecureRandomString();
  return `lh-${clientCode}-${randomString}`;
}

/**
 * Check Google Play environment variables
 */
function checkGooglePlayCredentials() {
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
 * Check if client config exists
 */
function checkClientConfigured(clientCode) {
  const configPath = getClientConfigPath(clientCode);

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
 * Parse existing keystore.properties to preserve passwords
 */
function parseExistingKeystoreProperties(keystorePropertiesPath) {
  if (!fs.existsSync(keystorePropertiesPath)) {
    return null;
  }

  const existingProps = fs.readFileSync(keystorePropertiesPath, 'utf8');
  const passwordMatch = existingProps.match(/release\.storePassword=(.+)/);
  return passwordMatch ? passwordMatch[1].trim() : null;
}

/**
 * Creates keystore.properties content
 */
function createKeystorePropertiesContent(clientCode, debugResult, releaseResult) {
  return `# Android Keystore Properties
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
}

/**
 * Parses keystore properties file
 */
function parseKeystoreProperties(keystorePropertiesPath) {
  if (!fs.existsSync(keystorePropertiesPath)) {
    return null;
  }

  const props = fs.readFileSync(keystorePropertiesPath, 'utf8');
  return {
    debugPassword: props.match(/debug\.storePassword=(.+)/)?.[1]?.trim(),
    debugAlias: props.match(/debug\.keyAlias=(.+)/)?.[1]?.trim(),
    releasePassword: props.match(/release\.storePassword=(.+)/)?.[1]?.trim(),
    releaseAlias: props.match(/release\.keyAlias=(.+)/)?.[1]?.trim(),
  };
}

/**
 * Get client credentials directory path
 */
function getClientCredentialsDir(credentialsPath, clientCode) {
  return path.join(credentialsPath, 'clients', clientCode, 'android');
}

module.exports = {
  getLoyaltyCredentialsPath,
  generateSecureRandomString,
  generateReleasePassword,
  checkGooglePlayCredentials,
  checkClientConfigured,
  parseExistingKeystoreProperties,
  createKeystorePropertiesContent,
  parseKeystoreProperties,
  getClientCredentialsDir,
};
