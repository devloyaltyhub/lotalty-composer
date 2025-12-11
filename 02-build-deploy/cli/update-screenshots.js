#!/usr/bin/env node

/**
 * Update Screenshots CLI
 *
 * Standalone script para atualizar screenshots nas app stores
 * sem necessidade de build do app.
 *
 * Funcionalidades:
 * - Detecta automaticamente o cliente configurado em white_label_app/
 * - Gera novos screenshots (pipeline Python)
 * - Copia para metadata
 * - Faz upload para Play Store e/ou App Store
 * - Screenshots existentes nas stores sao substituidos automaticamente
 *
 * Uso:
 *   npm run update-screenshots
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const inquirer = require('inquirer');

// Load environment variables with credential path expansion
const { loadEnvWithExpansion } = require('../../01-client-setup/shared/env-loader');
loadEnvWithExpansion(__dirname);

const logger = require('../../shared/utils/logger');
const { ScreenshotGenerator, checkExistingScreenshots } = require('./generate-screenshots');

// Constants
const REPO_PATH = path.resolve(__dirname, '../../..');
const FASTLANE_DIR = path.join(__dirname, '../fastlane');
const WHITE_LABEL_APP = path.join(REPO_PATH, 'white_label_app');

/**
 * Load client config from white_label_app/config.json
 * @returns {Object} Client config or null if not found
 */
function loadConfiguredClient() {
  const configPath = path.join(WHITE_LABEL_APP, 'config.json');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
      clientCode: config.clientCode,
      clientName: config.clientName,
      bundleId: config.bundleId,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Screenshot Updater - Orchestrates screenshot generation and upload to stores
 */
class ScreenshotUpdater {
  constructor(clientCode) {
    this.clientCode = clientCode;
    this.platforms = { android: false, ios: false };
    this.startTime = null;
  }

  /**
   * Check if Google Play credentials are configured
   */
  checkGooglePlayCredentials() {
    const keyPath = process.env.GOOGLE_PLAY_JSON_KEY;
    if (!keyPath) {
      return { configured: false, reason: 'GOOGLE_PLAY_JSON_KEY nao definido no .env' };
    }
    if (!fs.existsSync(keyPath)) {
      return { configured: false, reason: `Arquivo nao encontrado: ${keyPath}` };
    }
    return { configured: true, path: keyPath };
  }

  /**
   * Check if App Store credentials are configured
   */
  checkAppStoreCredentials() {
    if (!process.env.APP_STORE_CONNECT_API_KEY_ID) {
      return { configured: false, reason: 'APP_STORE_CONNECT_API_KEY_ID nao definido no .env' };
    }
    if (!process.env.APP_STORE_CONNECT_API_ISSUER_ID) {
      return { configured: false, reason: 'APP_STORE_CONNECT_API_ISSUER_ID nao definido no .env' };
    }
    const keyPath = process.env.APP_STORE_CONNECT_API_KEY;
    if (keyPath && !fs.existsSync(keyPath)) {
      return { configured: false, reason: `Arquivo .p8 nao encontrado: ${keyPath}` };
    }
    return { configured: true };
  }

  /**
   * Prompt user to select platforms
   */
  async promptPlatforms() {
    const isMac = process.platform === 'darwin';
    const googlePlayStatus = this.checkGooglePlayCredentials();
    const appStoreStatus = this.checkAppStoreCredentials();

    // Show credential warnings
    if (!googlePlayStatus.configured) {
      logger.warn(`Google Play: ${googlePlayStatus.reason}`);
    }
    if (!isMac) {
      logger.warn('iOS requer macOS - opcao nao disponivel');
    } else if (!appStoreStatus.configured) {
      logger.warn(`App Store: ${appStoreStatus.reason}`);
    }
    logger.blank();

    const choices = [];

    // Add "both" option only if both platforms are available
    if (googlePlayStatus.configured && isMac && appStoreStatus.configured) {
      choices.push({ name: 'Android e iOS', value: 'both' });
    }

    if (googlePlayStatus.configured) {
      choices.push({ name: 'Apenas Android (Play Store)', value: 'android' });
    }

    if (isMac && appStoreStatus.configured) {
      choices.push({ name: 'Apenas iOS (App Store)', value: 'ios' });
    }

    if (choices.length === 0) {
      throw new Error('Nenhuma plataforma disponivel. Verifique as credenciais no .env');
    }

    const { platform } = await inquirer.prompt([
      {
        type: 'list',
        name: 'platform',
        message: 'Qual plataforma atualizar?',
        choices,
      },
    ]);

    this.platforms.android = platform === 'both' || platform === 'android';
    this.platforms.ios = platform === 'both' || platform === 'ios';

    return this.platforms;
  }

  /**
   * Run white-label setup in validate-only mode
   */
  runWhiteLabelSetup() {
    logger.startSpinner('Validando configuracao white-label...');

    try {
      // Run setup in validate-only mode (skips icon generation, pod install, etc)
      execSync(`node ${path.join(REPO_PATH, 'automation/01-client-setup/cli/setup-white-label.js')} --client=${this.clientCode} --validate-only`, {
        cwd: REPO_PATH,
        stdio: 'pipe',
      });
      logger.succeedSpinner('White-label configurado');
    } catch (error) {
      logger.failSpinner('Falha na validacao white-label');
      throw new Error(`Setup white-label falhou: ${error.message}`);
    }
  }

  /**
   * Generate screenshots using Python pipeline
   */
  async generateScreenshots() {
    logger.section('Gerando Screenshots');

    const generator = new ScreenshotGenerator(this.clientCode, REPO_PATH);
    const result = await generator.generate({
      deviceChoice: 1,
      gradientChoice: 0, // Use client primary color
      angleChoice: 2,
    });

    if (!result.success) {
      throw new Error(`Falha na geracao de screenshots: ${result.error}`);
    }

    logger.success('Screenshots gerados e copiados para metadata');
    return result;
  }

  /**
   * Upload screenshots to stores via Fastlane
   */
  async uploadToStores() {
    logger.section('Upload para Stores');

    const uploadedPlatforms = [];

    if (this.platforms.android) {
      logger.info('Enviando para Play Store...');
      logger.info('  Screenshots existentes serao substituidos automaticamente');
      logger.blank();

      try {
        execSync(`bundle exec fastlane android upload_metadata_only client:${this.clientCode}`, {
          cwd: FASTLANE_DIR,
          stdio: 'inherit',
        });
        uploadedPlatforms.push('Android');
      } catch (error) {
        logger.error(`Falha no upload para Play Store: ${error.message}`);
        throw error;
      }
    }

    if (this.platforms.ios) {
      logger.blank();
      logger.info('Enviando para App Store...');
      logger.info('  Screenshots existentes serao DELETADOS antes do upload');
      logger.blank();

      try {
        execSync(`bundle exec fastlane ios upload_metadata_only client:${this.clientCode}`, {
          cwd: FASTLANE_DIR,
          stdio: 'inherit',
        });
        uploadedPlatforms.push('iOS');
      } catch (error) {
        logger.error(`Falha no upload para App Store: ${error.message}`);
        throw error;
      }
    }

    return uploadedPlatforms;
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Run complete screenshot update workflow
   */
  async run() {
    this.startTime = Date.now();

    try {
      // Step 1: Select platforms
      await this.promptPlatforms();

      // Step 2: Check existing screenshots
      const existingCheck = checkExistingScreenshots();

      if (existingCheck.exists) {
        logger.warn(`Screenshots ja existentes encontrados (${existingCheck.total} arquivos):`);
        for (const { platform, count } of existingCheck.details) {
          logger.keyValue(`  ${platform}`, `${count} screenshots`);
        }
        logger.blank();
      }

      // Step 3: Confirm action
      const platformList = [];
      if (this.platforms.android) platformList.push('Play Store');
      if (this.platforms.ios) platformList.push('App Store');

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Gerar e enviar novos screenshots para ${platformList.join(' e ')}?`,
          default: true,
        },
      ]);

      if (!confirm) {
        logger.info('Operacao cancelada');
        return { success: false, cancelled: true };
      }

      logger.blank();

      // Step 4: Validate white-label setup
      this.runWhiteLabelSetup();

      // Step 5: Generate screenshots
      await this.generateScreenshots();

      // Step 6: Upload to stores
      const uploadedPlatforms = await this.uploadToStores();

      // Summary
      const duration = this.formatDuration(Date.now() - this.startTime);

      logger.blank();
      logger.summaryBox({
        Cliente: this.clientCode,
        Plataformas: uploadedPlatforms.join(', '),
        Duracao: duration,
        Status: 'Screenshots atualizados',
      });

      return {
        success: true,
        client: this.clientCode,
        platforms: uploadedPlatforms,
        duration,
      };
    } catch (error) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      logger.error(`Atualizacao de screenshots falhou apos ${duration}`);
      logger.error(error.message);

      return { success: false, error: error.message };
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    logger.section('Atualizar Screenshots nas Stores');
    logger.blank();

    // Detect configured client from white_label_app/config.json
    const clientConfig = loadConfiguredClient();

    if (!clientConfig) {
      logger.error('Nenhum cliente configurado em white_label_app/');
      logger.error('Execute "npm run start" primeiro para configurar um cliente.');
      process.exit(1);
    }

    logger.info(`Cliente detectado: ${clientConfig.clientName} (${clientConfig.clientCode})`);
    logger.info('Este script gera novos screenshots e faz upload para as stores.');
    logger.info('Screenshots existentes nas stores serao substituidos.');
    logger.blank();

    // Run update
    const updater = new ScreenshotUpdater(clientConfig.clientCode);
    const result = await updater.run();

    if (result.success) {
      logger.success('Screenshots atualizados com sucesso!');
      process.exit(0);
    } else if (result.cancelled) {
      process.exit(0);
    } else {
      logger.error(`Falha: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { ScreenshotUpdater };

if (require.main === module) {
  main();
}
