#!/usr/bin/env node

/**
 * iOS Certificates Setup CLI
 *
 * Interactive CLI wrapper for IOSCertificateSetup class
 * Allows manual setup of iOS certificates for a specific client
 */

const inquirer = require('inquirer');
const fs = require('fs');
const chalk = require('chalk');
const IOSCertificateSetup = require('../steps/setup-ios-certificates');
const { loadEnvWithExpansion } = require('../shared/env-loader');
const { CLIENTS_DIR, getClientDir, getClientConfigPath } = require('../../shared/utils/paths');

// Load environment variables from automation/.env and expand paths
loadEnvWithExpansion(__dirname);

async function main() {
  console.log(chalk.bold.cyan('\n🍎 iOS Certificates Setup\n'));
  console.log(chalk.gray('Configure iOS certificates and provisioning profiles for a client\n'));

  // Get list of available clients
  if (!fs.existsSync(CLIENTS_DIR)) {
    console.log(chalk.red('❌ Clients directory not found'));
    process.exit(1);
  }

  const clients = fs.readdirSync(CLIENTS_DIR).filter((name) => {
    const clientPath = getClientDir(name);
    const configPath = getClientConfigPath(name);
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

  // Load client config to get bundle ID
  const configPath = getClientConfigPath(clientCode);
  let bundleId;

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    bundleId = config.bundleId;

    if (!bundleId) {
      console.log(chalk.red('❌ Bundle ID not found in client config'));
      process.exit(1);
    }

    console.log(chalk.gray(`\n✓ Client config found: ${configPath}`));
    console.log(chalk.gray(`   ✓ Fastlane will auto-discover bundle ID: ${bundleId}\n`));
  } catch (error) {
    console.log(chalk.red(`❌ Error reading client config: ${error.message}`));
    process.exit(1);
  }

  // Prompt for certificate type
  const { certType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'certType',
      message: 'Select certificate type:',
      choices: [
        { name: 'Development (for testing on devices)', value: 'development' },
        { name: 'App Store Distribution (for production release)', value: 'appstore' },
        { name: 'Both (Development + App Store)', value: 'both' },
      ],
    },
  ]);

  console.log(chalk.cyan(`\n   Client: ${clientCode}`));
  console.log(chalk.cyan(`   Bundle ID: ${bundleId}`));
  console.log(
    chalk.cyan(`   Type: ${certType === 'both' ? 'Development + App Store' : certType}\n`)
  );

  console.log(chalk.yellow('   📝 The following will be created automatically:'));
  console.log(chalk.gray('      1. App registered in Apple Developer Portal'));
  console.log(chalk.gray('      2. App created in App Store Connect'));
  console.log(chalk.gray('      3. Distribution certificates generated'));
  console.log(chalk.gray('      4. Provisioning profiles created\n'));

  // Confirm before proceeding
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Continue with iOS certificate setup?',
      default: true,
    },
  ]);

  if (!confirmed) {
    console.log(chalk.yellow('\n📋 Setup cancelled\n'));
    process.exit(0);
  }

  // Execute iOS certificate setup
  try {
    const iosSetup = new IOSCertificateSetup();
    const result = await iosSetup.setupCertificates(clientCode, bundleId, certType);

    console.log(chalk.green('\n✅ iOS certificates setup completed successfully!\n'));

    if (result.devCertCreated) {
      console.log(chalk.cyan('   ✓ Development certificates configured'));
    }
    if (result.appstoreCertCreated) {
      console.log(chalk.cyan('   ✓ App Store certificates configured'));
    }

    console.log(chalk.gray('\n   Certificates are stored in the Match repository'));
    console.log(chalk.gray('   Provisioning profiles are ready for building\n'));
  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to setup iOS: ${error.message}\n`));

    // Print manual instructions
    console.log(chalk.yellow('   📝 Manual steps required:\n'));
    console.log(chalk.white('   1. Check your Apple Developer account:'));
    console.log(chalk.gray('      - Verify APPLE_TEAM_ID is correct'));
    console.log(chalk.gray('      - Ensure API key has admin access'));
    console.log(chalk.gray(`      - Bundle ID: ${bundleId}\n`));

    console.log(chalk.white('   2. Run setup manually:'));
    console.log(chalk.cyan('      cd automation/02-build-deploy'));
    console.log(chalk.cyan(`      fastlane ios register_app client:${clientCode}`));
    console.log(
      chalk.cyan(`      fastlane ios sync_certificates_${certType} client:${clientCode}\n`)
    );

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
