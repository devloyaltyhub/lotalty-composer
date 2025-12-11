#!/usr/bin/env node

/**
 * Android Credentials Setup CLI
 *
 * Interactive CLI wrapper for AndroidCredentialsSetup class
 * Allows manual setup of Android keystores and Google Play credentials for a specific client
 */

const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const AndroidCredentialsSetup = require('../steps/setup-android-credentials');
const { loadEnvWithExpansion } = require('../shared/env-loader');

// Load environment variables from automation/.env and expand paths
loadEnvWithExpansion(__dirname);

async function main() {
  console.log(chalk.bold.cyan('\n🤖 Android Credentials Setup\n'));
  console.log(chalk.gray('Configure Android keystores and Google Play credentials for a client\n'));

  // Get list of available clients
  const clientsDir = path.join(__dirname, '../../../clients');
  const clients = fs.readdirSync(clientsDir).filter((name) => {
    const clientPath = path.join(clientsDir, name);
    const configPath = path.join(clientPath, 'config.json');
    return fs.statSync(clientPath).isDirectory() && fs.existsSync(configPath);
  });

  if (clients.length === 0) {
    console.log(chalk.red('❌ No clients found in clients/ directory'));
    console.log(chalk.yellow('   Run "Criar Cliente" first to create a client\n'));
    process.exit(1);
  }

  // Prompt for client selection
  const { clientCode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'clientCode',
      message: 'Select client:',
      choices: clients.sort(),
    },
  ]);

  // Load client config
  const configPath = path.join(clientsDir, clientCode, 'config.json');
  let config;

  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(chalk.gray(`\n✓ Client config found: ${configPath}`));
    console.log(chalk.gray(`   Bundle ID: ${config.bundleId}\n`));
  } catch (error) {
    console.log(chalk.red(`❌ Error reading client config: ${error.message}`));
    process.exit(1);
  }

  // Check if credentials already exist
  const androidSetup = new AndroidCredentialsSetup();
  const credentialsDir = path.join(
    androidSetup.credentialsPath,
    'clients',
    clientCode,
    'android'
  );
  const keystorePropertiesPath = path.join(credentialsDir, 'keystore.properties');
  const hasExistingCredentials = fs.existsSync(keystorePropertiesPath);

  // Prompt for action type
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        {
          name: hasExistingCredentials
            ? 'Validate existing credentials'
            : 'Generate new keystores',
          value: hasExistingCredentials ? 'validate' : 'generate',
        },
        {
          name: hasExistingCredentials
            ? 'Regenerate keystores (CAUTION: will replace existing)'
            : 'Generate new keystores',
          value: 'generate',
          disabled: !hasExistingCredentials ? false : false,
        },
        { name: 'View SHA-256 fingerprints', value: 'fingerprints' },
      ].filter(
        (choice, index, self) =>
          self.findIndex((c) => c.value === choice.value) === index
      ),
    },
  ]);

  if (action === 'validate') {
    // Validate existing credentials
    const result = await androidSetup.validateCredentials(clientCode);

    if (result.valid) {
      console.log(chalk.green('\n✅ All credentials are valid!\n'));
    } else {
      console.log(chalk.red('\n❌ Some issues found:'));
      result.issues.forEach((issue) => {
        console.log(chalk.yellow(`   - ${issue}`));
      });
      console.log('');

      const { shouldRegenerate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldRegenerate',
          message: 'Would you like to regenerate the keystores?',
          default: false,
        },
      ]);

      if (shouldRegenerate) {
        await generateKeystores(androidSetup, clientCode);
      }
    }
  } else if (action === 'fingerprints') {
    // Show fingerprints
    if (!hasExistingCredentials) {
      console.log(chalk.red('\n❌ No credentials found for this client'));
      console.log(chalk.yellow('   Generate keystores first\n'));
      process.exit(1);
    }

    const props = fs.readFileSync(keystorePropertiesPath, 'utf8');
    const debugSha = props.match(/debug\.sha256Fingerprint=(.+)/)?.[1]?.trim();
    const releaseSha = props.match(/release\.sha256Fingerprint=(.+)/)?.[1]?.trim();

    console.log(chalk.cyan('\n📋 SHA-256 Fingerprints for Firebase App Check:\n'));
    console.log(chalk.white(`   Debug:   ${debugSha || 'Not found'}`));
    console.log(chalk.white(`   Release: ${releaseSha || 'Not found'}`));
    console.log('');
    console.log(chalk.gray('   Add these to Firebase Console > App Check > Android app'));
    console.log('');
  } else {
    // Generate new keystores
    if (hasExistingCredentials) {
      console.log(chalk.yellow('\n⚠️  WARNING: Existing credentials found!'));
      console.log(chalk.yellow('   Regenerating will create new keystores.'));
      console.log(
        chalk.red('   If you have already published the app, this will break updates!\n')
      );

      const { confirmRegenerate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmRegenerate',
          message: 'Are you sure you want to regenerate the keystores?',
          default: false,
        },
      ]);

      if (!confirmRegenerate) {
        console.log(chalk.yellow('\n📋 Operation cancelled\n'));
        process.exit(0);
      }

      // Backup existing credentials
      const backupDir = path.join(credentialsDir, `backup-${Date.now()}`);
      fs.mkdirSync(backupDir, { recursive: true });

      const filesToBackup = ['keystore-debug.jks', 'keystore-release.jks', 'keystore.properties'];
      filesToBackup.forEach((file) => {
        const srcPath = path.join(credentialsDir, file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, path.join(backupDir, file));
        }
      });

      console.log(chalk.cyan(`\n✓ Existing credentials backed up to: ${backupDir}\n`));

      // Remove existing files to force regeneration
      filesToBackup.forEach((file) => {
        const filePath = path.join(credentialsDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }

    await generateKeystores(androidSetup, clientCode);
  }
}

async function generateKeystores(androidSetup, clientCode) {
  console.log(chalk.cyan(`\n   Client: ${clientCode}`));
  console.log(chalk.yellow('\n   📝 The following will be created:'));
  console.log(chalk.gray('      1. Debug keystore (for development builds)'));
  console.log(chalk.gray('      2. Release keystore (for production builds)'));
  console.log(chalk.gray('      3. keystore.properties file with passwords\n'));

  // Confirm before proceeding
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Continue with Android credentials setup?',
      default: true,
    },
  ]);

  if (!confirmed) {
    console.log(chalk.yellow('\n📋 Setup cancelled\n'));
    process.exit(0);
  }

  // Execute Android credentials setup
  try {
    const result = await androidSetup.setupCredentials(clientCode);

    if (result.success) {
      console.log(chalk.green('\n✅ Android credentials setup completed successfully!\n'));

      console.log(chalk.cyan('   Next steps:'));
      console.log(chalk.gray('   1. Commit keystores to loyalty-credentials repo'));
      console.log(chalk.gray('   2. Register SHA-256 fingerprints in Firebase App Check'));
      console.log(chalk.gray('   3. Configure Google Play service account for deployment\n'));

      if (!result.hasGooglePlayCredentials) {
        console.log(chalk.yellow('   ⚠️  Google Play credentials not configured'));
        console.log(chalk.gray('      Add GOOGLE_PLAY_JSON_KEY to automation/.env'));
        console.log(chalk.gray('      to enable automatic deployment to Play Store\n'));
      }
    } else if (result.skipped) {
      console.log(chalk.yellow(`\n⚠️  Setup skipped: ${result.reason}\n`));
    } else {
      console.log(chalk.red(`\n❌ Setup failed: ${result.error}\n`));
      process.exit(1);
    }
  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to setup Android credentials: ${error.message}\n`));
    process.exit(1);
  }
}

// Run CLI
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('\n❌ Unexpected error:'), error);
    process.exit(1);
  });
}

module.exports = { main };
