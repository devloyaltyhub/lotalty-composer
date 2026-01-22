const { execSync } = require('child_process');
const fs = require('fs');
const chalk = require('chalk');

/**
 * Android Keystore Operations
 *
 * Handles keystore generation, validation, and fingerprint extraction.
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
  validity: 10000,
  keyalg: 'RSA',
  keysize: 2048,
  storetype: 'JKS',
};

/**
 * Formats the dname string for keytool command
 */
function formatDname(type = 'release') {
  const { CN, OU, O, L, ST, C } = KEYSTORE_BASE_CONFIG.dname;
  const name = type === 'debug' ? 'Loyalty Hub Debug' : CN;
  return `CN=${name}, OU=${OU}, O=${O}, L=${L}, ST=${ST}, C=${C}`;
}

/**
 * Check if keytool is available
 */
function checkKeytoolAvailable() {
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
 * Gets the SHA-256 fingerprint from a keystore
 */
async function getSHA256Fingerprint(keystorePath, password, alias) {
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

/**
 * Generates a single keystore file
 */
async function generateSingleKeystore(config) {
  const { keystorePath, password, alias, dname, type } = config;

  if (fs.existsSync(keystorePath)) {
    console.log(chalk.yellow(`   ⚠️  ${type} keystore already exists. Skipping generation.`));
    return {
      keystorePath,
      sha256: await getSHA256Fingerprint(keystorePath, password, alias),
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

    const sha256 = await getSHA256Fingerprint(keystorePath, password, alias);
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

module.exports = {
  KEYSTORE_BASE_CONFIG,
  formatDname,
  checkKeytoolAvailable,
  getSHA256Fingerprint,
  validateKeystore,
  generateSingleKeystore,
};
