const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const {
  validateGitUrl,
  validateAppleTeamId,
  validateEnvironmentVariables,
} = require('../shared/input-validator');
const { ValidationError } = require('../../shared/utils/error-handler');

/**
 * iOS Certificate Setup
 *
 * Automatically generates iOS certificates and provisioning profiles using Fastlane Match
 * Called during client creation Phase 01
 */

class IOSCertificateSetup {
  constructor() {
    this.fastlaneDir = this.getFastlaneDir();
  }

  /**
   * Get path to Fastlane directory
   */
  getFastlaneDir() {
    // From automation/01-client-setup/steps/ → automation/02-build-deploy/fastlane/
    const automationRoot = path.resolve(__dirname, '../..');
    const fastlaneDir = path.join(automationRoot, '02-build-deploy', 'fastlane');

    if (!fs.existsSync(fastlaneDir)) {
      throw new Error(`Fastlane directory not found at: ${fastlaneDir}`);
    }

    return fastlaneDir;
  }

  /**
   * Check if required environment variables are set and valid
   * SECURITY FIX: Enhanced validation of environment variable formats
   */
  checkEnvironmentVariables() {
    const requiredVars = [
      'MATCH_GIT_URL',
      'MATCH_PASSWORD',
      'APPLE_TEAM_ID',
      'APP_STORE_CONNECT_API_KEY_ID',
      'APP_STORE_CONNECT_API_ISSUER_ID',
      'APP_STORE_CONNECT_API_KEY',
    ];

    // SECURITY FIX: Check if variables exist and are not empty
    try {
      validateEnvironmentVariables(requiredVars);
    } catch (error) {
      console.log(chalk.yellow('\n⚠️  Missing or empty iOS environment variables:'));
      if (error instanceof ValidationError && error.metadata.missing) {
        error.metadata.missing.forEach((varName) => {
          console.log(chalk.gray(`   - ${varName}`));
        });
      }
      console.log(chalk.yellow('\n   iOS certificate generation will be skipped.'));
      console.log(chalk.gray('   You can run it manually later with:'));
      console.log(
        chalk.gray(
          '   cd automation/02-build-deploy && fastlane ios sync_certificates_appstore client:<code>'
        )
      );
      return false;
    }

    // SECURITY FIX: Validate format of specific variables
    try {
      // Validate MATCH_GIT_URL format
      validateGitUrl(process.env.MATCH_GIT_URL, 'MATCH_GIT_URL');

      // Validate APPLE_TEAM_ID format (should be 10 alphanumeric characters)
      validateAppleTeamId(process.env.APPLE_TEAM_ID, 'APPLE_TEAM_ID');

      // Additional validation: API keys should not be empty strings
      const apiVars = [
        'APP_STORE_CONNECT_API_KEY_ID',
        'APP_STORE_CONNECT_API_ISSUER_ID',
        'APP_STORE_CONNECT_API_KEY',
      ];
      for (const varName of apiVars) {
        const value = process.env[varName];
        if (!value || value.trim().length === 0) {
          throw new ValidationError(`${varName} is empty`, varName);
        }
      }

      return true;
    } catch (error) {
      console.log(chalk.yellow('\n⚠️  Invalid iOS environment variable format:'));
      console.log(chalk.gray(`   ${error.message}`));
      console.log(
        chalk.yellow(
          '\n   Please check your .env file and ensure all values are correctly formatted.'
        )
      );
      return false;
    }
  }

  /**
   * Check if client config exists (for dynamic bundle ID discovery)
   * Note: Matchfile and Fastfile now dynamically discover bundle IDs from config.json
   * No manual configuration needed!
   */
  checkClientConfigured(clientCode, bundleId) {
    // Use relative path from script location instead of process.cwd()
    const loyaltyAppRoot = path.resolve(__dirname, '..', '..', '..');
    const clientsDir = path.join(loyaltyAppRoot, 'clients');
    const configPath = path.join(clientsDir, clientCode, 'config.json');

    if (!fs.existsSync(configPath)) {
      console.log(chalk.yellow(`\n⚠️  Client config not found: ${configPath}`));
      console.log(chalk.yellow('   Make sure the client was created with the setup wizard'));
      return false;
    }

    console.log(chalk.cyan(`   ✓ Client config found: ${configPath}`));
    console.log(chalk.cyan(`   ✓ Fastlane will auto-discover bundle ID: ${bundleId}`));
    return true;
  }

  /**
   * Execute Fastlane command
   */
  execFastlane(command, options = {}) {
    try {
      const result = execSync(command, {
        cwd: this.fastlaneDir,
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        env: {
          ...process.env,
          // Ensure environment variables are passed
          LC_ALL: 'en_US.UTF-8',
          LANG: 'en_US.UTF-8',
        },
        ...options,
      });
      return result ? result.trim() : '';
    } catch (error) {
      throw new Error(`Fastlane command failed: ${command}\n${error.message}`);
    }
  }

  /**
   * Generate iOS certificates and provisioning profiles for a client
   */
  async setupCertificates(clientCode, bundleId) {
    console.log(chalk.blue('\n📱 Setting up iOS certificates and provisioning profiles...'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
      // Check environment variables
      if (!this.checkEnvironmentVariables()) {
        console.log(chalk.yellow('\n⚠️  Skipping iOS certificate generation'));
        console.log(
          chalk.gray('   Configure iOS environment variables in .env to enable automatic setup')
        );
        return {
          success: false,
          skipped: true,
          reason: 'missing_env_vars',
        };
      }

      // Check if client is configured
      if (!this.checkClientConfigured(clientCode, bundleId)) {
        console.log(chalk.yellow('\n⚠️  Skipping iOS certificate generation'));
        console.log(chalk.gray('   Client config.json not found'));
        return {
          success: false,
          skipped: true,
          reason: 'client_not_configured',
        };
      }

      console.log(chalk.cyan(`\n   Client: ${clientCode}`));
      console.log(chalk.cyan(`   Bundle ID: ${bundleId}`));
      console.log(chalk.cyan('   Type: App Store Distribution'));
      console.log(chalk.cyan('\n   📝 The following will be created automatically:'));
      console.log(chalk.gray('      1. App registered in Apple Developer Portal'));
      console.log(chalk.gray('      2. App created in App Store Connect'));
      console.log(chalk.gray('      3. Distribution certificates generated'));
      console.log(chalk.gray('      4. Provisioning profiles created'));

      // Run Fastlane Match for App Store (includes app registration)
      console.log(chalk.cyan('\n   🚀 Running Fastlane automation...'));
      this.execFastlane(`fastlane ios sync_certificates_appstore client:${clientCode}`);

      console.log(chalk.green('\n✅ iOS setup completed successfully!'));
      console.log(chalk.green('   ✓ App registered in Apple Developer Portal'));
      console.log(chalk.green('   ✓ App created in App Store Connect'));
      console.log(chalk.green('   ✓ Certificates stored in loyalty-credentials/shared/ios/certs/'));
      console.log(
        chalk.green(`   ✓ Profiles organized to loyalty-credentials/clients/${clientCode}/ios/`)
      );
      console.log(chalk.green('   ✓ Changes committed and pushed to loyalty-credentials repo'));

      return {
        success: true,
        skipped: false,
      };
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to setup iOS:'), error.message);
      console.log(chalk.yellow('\n   📝 Manual steps required:'));
      console.log(chalk.gray('\n   1. Check your Apple Developer account:'));
      console.log(chalk.gray('      - Verify APPLE_TEAM_ID is correct'));
      console.log(chalk.gray('      - Ensure API key has admin access'));
      console.log(chalk.gray(`      - Bundle ID: ${bundleId}`));
      console.log(chalk.gray('\n   2. Run setup manually:'));
      console.log(chalk.gray(`      cd automation/02-build-deploy`));
      console.log(chalk.gray(`      fastlane ios register_app client:${clientCode}`));
      console.log(chalk.gray(`      fastlane ios sync_certificates_appstore client:${clientCode}`));

      return {
        success: false,
        skipped: false,
        error: error.message,
      };
    }
  }
}

module.exports = IOSCertificateSetup;
