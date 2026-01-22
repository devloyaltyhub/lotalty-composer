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

const { loadEnvWithExpansion } = require('../../../01-client-setup/shared/env-loader');
loadEnvWithExpansion(path.join(__dirname, '..'));

const logger = require('../../../shared/utils/logger');
const ScreenshotUpdater = require('./screenshot-updater');
const { loadConfiguredClient } = require('./client-loader');

/**
 * Main function
 */
async function main() {
  try {
    logger.section('Atualizar Screenshots nas Stores');
    logger.blank();

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
