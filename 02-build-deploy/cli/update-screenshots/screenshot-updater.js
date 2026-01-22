/**
 * Screenshot Updater Class
 *
 * Orchestrates screenshot generation and upload to app stores.
 */

const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');

const logger = require('../../../shared/utils/logger');
const { COMPOSE_ROOT, LOYALTY_APP_ROOT, FASTLANE_DIR } = require('../../../shared/utils/paths');
const { ScreenshotGenerator, checkExistingScreenshots } = require('../generate-screenshots');
const { checkGooglePlayCredentials, checkAppStoreCredentials } = require('./credentials-checker');

class ScreenshotUpdater {
  constructor(clientCode) {
    this.clientCode = clientCode;
    this.platforms = { android: false, ios: false };
    this.startTime = null;
  }

  /**
   * Prompt user to select platforms
   */
  async promptPlatforms() {
    const isMac = process.platform === 'darwin';
    const googlePlayStatus = checkGooglePlayCredentials();
    const appStoreStatus = checkAppStoreCredentials();

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
      const setupScript = path.join(COMPOSE_ROOT, '01-client-setup/cli/setup-white-label.js');
      execSync(`node ${setupScript} --client=${this.clientCode} --validate-only`, {
        cwd: LOYALTY_APP_ROOT,
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

    const generator = new ScreenshotGenerator(this.clientCode, LOYALTY_APP_ROOT);
    const result = await generator.generate({
      deviceChoice: 1,
      gradientChoice: 0,
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
      await this.promptPlatforms();

      const existingCheck = checkExistingScreenshots();

      if (existingCheck.exists) {
        logger.warn(`Screenshots ja existentes encontrados (${existingCheck.total} arquivos):`);
        for (const { platform, count } of existingCheck.details) {
          logger.keyValue(`  ${platform}`, `${count} screenshots`);
        }
        logger.blank();
      }

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

      this.runWhiteLabelSetup();
      await this.generateScreenshots();
      const uploadedPlatforms = await this.uploadToStores();

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

module.exports = ScreenshotUpdater;
