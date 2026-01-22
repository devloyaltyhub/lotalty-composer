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
 *
 * This file is a thin wrapper that delegates to the modular implementation
 * in ./update-screenshots/ for better maintainability.
 */

const { ScreenshotUpdater } = require('./update-screenshots/index');

module.exports = { ScreenshotUpdater };

if (require.main === module) {
  require('./update-screenshots/index');
}
