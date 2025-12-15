#!/usr/bin/env node

/**
 * Generate Screenshots CLI
 *
 * Standalone script to generate app store screenshots for a client.
 * Uses the Python screenshot pipeline for capture and mockup generation.
 *
 * IMPORTANT: White label must be configured BEFORE running this script.
 * Run 'npm run start' to configure the client first.
 *
 * Usage:
 *   node generate-screenshots.js
 *   node generate-screenshots.js --client=demo
 */

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');
const inquirer = require('inquirer');
const {
  COMPOSE_ROOT,
  LOYALTY_APP_ROOT,
  WHITE_LABEL_APP_ROOT,
  WHITE_LABEL_METADATA_DIR,
  WHITE_LABEL_CONFIG,
} = require('../../shared/utils/paths');

// Load environment variables
require('dotenv').config({ path: path.join(COMPOSE_ROOT, '.env') });

const logger = require('../../shared/utils/logger');
const clientSelector = require('../../shared/utils/client-selector');
const { ScreenshotMetadataCopier, IOS_DEVICES } = require('../utils/screenshot-metadata-copier');

// Constants - Use centralized paths
const REPO_PATH = LOYALTY_APP_ROOT;
const SCREENSHOTS_DIR = path.join(COMPOSE_ROOT, '02-build-deploy', 'screenshots');
const WHITE_LABEL_APP = WHITE_LABEL_APP_ROOT;

/**
 * Check if screenshots already exist in metadata folders
 * @returns {Object} Object with exists flag and details
 */
function checkExistingScreenshots() {
  const metadataDir = path.join(WHITE_LABEL_APP, 'metadata');

  // Check directories for screenshots
  const screenshotPaths = [
    { platform: 'Android Phone', path: path.join(metadataDir, 'android', 'pt-BR', 'images', 'phoneScreenshots') },
    { platform: 'Android Tablet', path: path.join(metadataDir, 'android', 'pt-BR', 'images', 'tenInchScreenshots') },
  ];

  const existingScreenshots = [];
  let totalCount = 0;

  // Check Android directories
  for (const { platform, path: screenshotPath } of screenshotPaths) {
    if (fs.existsSync(screenshotPath)) {
      const pngFiles = fs.readdirSync(screenshotPath).filter(f => f.endsWith('.png'));
      if (pngFiles.length > 0) {
        existingScreenshots.push({ platform, count: pngFiles.length });
        totalCount += pngFiles.length;
      }
    }
  }

  // Check iOS screenshots (directly in pt-BR folder, Fastlane detects device by resolution)
  // iPhone 6.7": 1290x2796, iPad 12.9": 2048x2732
  const iosDir = path.join(metadataDir, 'ios', 'pt-BR');
  if (fs.existsSync(iosDir)) {
    const pngFiles = fs.readdirSync(iosDir).filter(f => f.endsWith('.png'));
    if (pngFiles.length > 0) {
      existingScreenshots.push({ platform: 'iOS (iPhone + iPad)', count: pngFiles.length });
      totalCount += pngFiles.length;
    }
  }

  return {
    exists: totalCount > 0,
    total: totalCount,
    details: existingScreenshots,
  };
}

/**
 * Screenshot Generator
 */
class ScreenshotGenerator {
  constructor(clientCode, repoPath = REPO_PATH) {
    this.clientCode = clientCode;
    this.repoPath = repoPath;
    this.config = this._loadClientConfig();
  }

  /**
   * Load client configuration from white_label_app/config.json
   * (assumes white-label setup has already been run)
   */
  _loadClientConfig() {
    try {
      const configPath = path.join(this.repoPath, 'white_label_app', 'config.json');
      if (!fs.existsSync(configPath)) {
        logger.warn('config.json nao encontrado em white_label_app/. Execute o setup primeiro.');
        return null;
      }
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      logger.warn(`Nao foi possivel carregar config do cliente: ${error.message}`);
      return null;
    }
  }

  /**
   * Get client's primary color from config
   */
  getPrimaryColor() {
    return this.config?.colors?.primary || null;
  }

  /**
   * Execute shell command
   */
  exec(command, options = {}) {
    try {
      return execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: options.cwd || this.repoPath,
        ...options,
      }).trim();
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  /**
   * Check if Python dependencies are available
   */
  checkPythonDependencies() {
    logger.startSpinner('Verificando dependencias Python...');

    try {
      this.exec('python3 --version', { silent: true });
      logger.succeedSpinner('Python3 disponivel');
      return true;
    } catch (error) {
      logger.failSpinner('Python3 nao encontrado');
      logger.error('Instale Python 3 para gerar screenshots');
      return false;
    }
  }

  /**
   * Run Python screenshot pipeline
   * @param {Object} options - Pipeline options
   */
  runScreenshotPipeline(options = {}) {
    logger.section('Executando Pipeline de Screenshots');

    const {
      deviceChoice = 1, // Default device
      gradientChoice = 0, // Default: use client primary color
      angleChoice = 2, // Default angle
      addLogo = true, // Default: add logo
    } = options;

    const pipelineScript = path.join(SCREENSHOTS_DIR, 'main.py');

    if (!fs.existsSync(pipelineScript)) {
      throw new Error(`Pipeline script nao encontrado: ${pipelineScript}`);
    }

    // Get client's primary color for gradient
    const primaryColor = this.getPrimaryColor();

    logger.info('Opcoes do pipeline:');
    logger.keyValue('  Device Choice', deviceChoice);
    logger.keyValue('  Gradient Choice', gradientChoice === 0 ? '0 (Cor do Cliente)' : gradientChoice);
    if (primaryColor && gradientChoice === 0) {
      logger.keyValue('  Cor Primaria', primaryColor);
    }
    logger.keyValue('  Angle Choice', angleChoice);
    logger.keyValue('  Logo', addLogo ? 'Sim' : 'Nao');
    logger.blank();

    const logoFlag = addLogo ? '--with-logo' : '--no-logo';
    const command = `python3 ${pipelineScript} pipeline --device-choice ${deviceChoice} --gradient-choice ${gradientChoice} --angle-choice ${angleChoice} ${logoFlag}`;

    // Build environment with PRIMARY_COLOR if available
    const env = { ...process.env };
    if (primaryColor) {
      env.PRIMARY_COLOR = primaryColor;
    }

    logger.startSpinner('Capturando screenshots e gerando mockups...');

    try {
      execSync(command, {
        encoding: 'utf8',
        stdio: 'inherit',
        cwd: this.repoPath,
        env,
      });
      logger.succeedSpinner('Pipeline de screenshots concluido');
      return true;
    } catch (error) {
      logger.failSpinner('Pipeline de screenshots falhou');
      throw error;
    }
  }

  /**
   * Copy screenshots to client metadata folders
   */
  copyToMetadata() {
    const copier = new ScreenshotMetadataCopier(this.clientCode, this.repoPath);
    return copier.copyAll();
  }

  /**
   * Run complete screenshot generation workflow
   */
  async generate(options = {}) {
    const startTime = Date.now();

    try {
      logger.section(`Gerando Screenshots: ${this.clientCode}`);
      logger.blank();

      // Step 1: Check dependencies
      if (!this.checkPythonDependencies()) {
        return { success: false, error: 'Missing Python dependencies' };
      }

      // Step 2: Run screenshot pipeline
      await this.runScreenshotPipeline(options);

      // Step 3: Copy to metadata folders
      const copyResults = this.copyToMetadata();

      // Summary
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const iosTotal = Object.values(copyResults.ios).reduce((sum, r) => sum + (r?.count || 0), 0);
      logger.blank();
      logger.summaryBox({
        Cliente: this.clientCode,
        'Screenshots Android': copyResults.android.phone?.count + copyResults.android.tablet?.count || 0,
        'Screenshots iOS': iosTotal,
        'Tamanhos iOS': Object.keys(IOS_DEVICES).length,
        Duracao: `${duration}s`,
      });

      return {
        success: true,
        client: this.clientCode,
        screenshots: copyResults,
        duration,
      };
    } catch (error) {
      logger.error(`Geracao de screenshots falhou: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    logger.section('Screenshot Generator');
    logger.blank();

    // Check for existing screenshots
    const existingCheck = checkExistingScreenshots();

    if (existingCheck.exists) {
      logger.warn(`Screenshots ja existentes encontrados (${existingCheck.total} arquivos):`);
      for (const { platform, count } of existingCheck.details) {
        logger.keyValue(`  ${platform}`, `${count} screenshots`);
      }
      logger.blank();

      const { shouldRegenerate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldRegenerate',
          message: 'Deseja gerar novos screenshots? (Este processo e demorado)',
          default: false,
        },
      ]);

      if (!shouldRegenerate) {
        logger.success('Pulando geracao de screenshots. Screenshots existentes mantidos.');
        process.exit(0);
      }

      logger.blank();
    }

    // Parse arguments
    const args = process.argv.slice(2);
    let clientCode = args.find((arg) => arg.startsWith('--client='))?.split('=')[1];

    // If no client specified, prompt for selection
    if (!clientCode) {
      const clientNames = clientSelector.listClients();

      if (clientNames.length === 0) {
        logger.error('Nenhum cliente encontrado em clients/');
        process.exit(1);
      }

      // Load config for each client to display proper names
      const clients = clientNames.map((name) => {
        try {
          const config = clientSelector.loadClientConfig(name);
          return {
            name: `${config.clientName || name} (${config.clientCode || name})`,
            value: name,
          };
        } catch {
          return { name, value: name };
        }
      });

      const { selectedClient } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedClient',
          message: 'Selecione o cliente:',
          choices: clients,
        },
      ]);

      clientCode = selectedClient;
    }

    // Prompt for pipeline options
    const { useDefaults } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useDefaults',
        message: 'Usar configuracoes padrao para mockups?',
        default: true,
      },
    ]);

    let pipelineOptions = {
      deviceChoice: 1,
      gradientChoice: 0, // 0 = Use client primary color
      angleChoice: 2,
      addLogo: true, // Default: add logo
    };

    if (!useDefaults) {
      const customOptions = await inquirer.prompt([
        {
          type: 'number',
          name: 'deviceChoice',
          message: 'Device choice (1=iPhone, 2=Pixel):',
          default: 1,
        },
        {
          type: 'number',
          name: 'gradientChoice',
          message: 'Gradient (0=Cor Cliente, 1=Purple, 2=Blue, 3=Orange, 4=Green, 5=Dark, 6=Red):',
          default: 0,
        },
        {
          type: 'number',
          name: 'angleChoice',
          message: 'Angle choice (1=15°, 2=20°, 3=25°):',
          default: 2,
        },
        {
          type: 'confirm',
          name: 'addLogo',
          message: 'Adicionar logo no rodape dos mockups?',
          default: true,
        },
      ]);

      pipelineOptions = { ...pipelineOptions, ...customOptions };
    }

    // Generate screenshots
    const generator = new ScreenshotGenerator(clientCode, REPO_PATH);
    const result = await generator.generate(pipelineOptions);

    if (result.success) {
      logger.success('Screenshots gerados com sucesso!');
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

module.exports = { ScreenshotGenerator, checkExistingScreenshots };

if (require.main === module) {
  main();
}
