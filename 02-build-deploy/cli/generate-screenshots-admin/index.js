#!/usr/bin/env node

const path = require('path');
const inquirer = require('inquirer');
const { COMPOSE_ROOT } = require('../../../shared/utils/paths');

require('dotenv').config({ path: path.join(COMPOSE_ROOT, '.env') });

const logger = require('../../../shared/utils/logger');
const DeviceManager = require('./device-manager');
const ScreenshotRunner = require('./screenshot-runner');
const MockupGenerator = require('./mockup-generator');
const MetadataCopier = require('./metadata-copier');

const REPO_ROOT = path.dirname(COMPOSE_ROOT);
const ADMIN_ROOT = path.join(REPO_ROOT, 'loyalty-admin-main');
const SCREENSHOTS_DIR = path.join(ADMIN_ROOT, 'screenshots');
const METADATA_DIR = path.join(ADMIN_ROOT, 'metadata', 'android', 'pt-BR', 'images');
const PYTHON_PIPELINE = path.join(COMPOSE_ROOT, '02-build-deploy', 'screenshots', 'main.py');

class AdminScreenshotGenerator {
  constructor(options = {}) {
    this.options = options;
    this.phoneDevice = options.phoneDevice;
    this.tabletDevice = options.tabletDevice;
    this.skipTests = options.skipTests || false;
    this.skipMockups = options.skipMockups || false;

    this.deviceManager = new DeviceManager(ADMIN_ROOT);
    this.screenshotRunner = new ScreenshotRunner(ADMIN_ROOT, SCREENSHOTS_DIR);
    this.mockupGenerator = new MockupGenerator(ADMIN_ROOT, SCREENSHOTS_DIR, COMPOSE_ROOT, PYTHON_PIPELINE);
    this.metadataCopier = new MetadataCopier(SCREENSHOTS_DIR, METADATA_DIR);
  }

  async generate() {
    const startTime = Date.now();

    try {
      logger.section('Screenshot Generator - Admin');
      logger.blank();

      this.screenshotRunner.checkIntegrationTests();

      const devices = await this.deviceManager.selectDevices(this.phoneDevice, this.tabletDevice);

      logger.blank();
      logger.summaryBox({
        'Phone Device': devices.phoneDevice,
        'Tablet Device': devices.tabletDevice || 'N/A',
        'Skip Tests': this.skipTests ? 'Sim' : 'Nao',
        'Skip Mockups': this.skipMockups ? 'Sim' : 'Nao',
      });
      logger.blank();

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Iniciar geracao de screenshots?',
          default: true,
        },
      ]);

      if (!confirm) {
        logger.info('Cancelado');
        return { success: false, cancelled: true };
      }

      let testsSuccess = true;
      if (!this.skipTests) {
        testsSuccess = this.screenshotRunner.runIntegrationTest(devices.phoneDevice, 'phone');

        if (!testsSuccess) {
          throw new Error('Captura de screenshots falhou');
        }
      } else {
        logger.info('Pulando execucao de testes (--skip-tests)');
      }

      if (!this.skipMockups) {
        if (!this.mockupGenerator.checkPythonDependencies()) {
          throw new Error('Python nao disponivel');
        }

        this.mockupGenerator.generateMockups();
      } else {
        logger.info('Pulando geracao de mockups (--skip-mockups)');
      }

      this.metadataCopier.copyToMetadata();

      const duration = Math.floor((Date.now() - startTime) / 1000);
      const { phoneCount, tabletCount } = this.metadataCopier.countScreenshots();

      logger.blank();
      logger.summaryBox({
        Status: 'Concluido',
        Projeto: 'Loyalty Admin',
        Plataforma: 'Android (Google Play)',
        'Phone Screenshots': phoneCount,
        'Tablet Screenshots': tabletCount,
        Duracao: `${duration}s`,
      });

      return {
        success: true,
        duration,
      };
    } catch (error) {
      logger.error(`Erro: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    phoneDevice: args.find((a) => a.startsWith('--phone-device='))?.split('=')[1],
    tabletDevice: args.find((a) => a.startsWith('--tablet-device='))?.split('=')[1],
    skipTests: args.includes('--skip-tests'),
    skipMockups: args.includes('--skip-mockups'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function showHelp() {
  console.log(`
  Generate Screenshots Admin - Captura screenshots Android para Google Play

  Usage:
    npm run screenshots-admin              Interactive mode
    npm run screenshots-admin -- --phone-device=<id>
    npm run screenshots-admin -- --skip-tests

  Options:
    --phone-device=<id>     Android phone device ID
    --tablet-device=<id>    Android tablet device ID
    --skip-tests            Skip integration tests (use existing screenshots)
    --skip-mockups          Skip mockup generation
    --help, -h              Show this help
  `);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const generator = new AdminScreenshotGenerator(args);
  const result = await generator.generate();

  if (result.success) {
    logger.success('Screenshots gerados com sucesso!');
    process.exit(0);
  } else if (result.cancelled) {
    process.exit(0);
  } else {
    logger.error(`Falha: ${result.error}`);
    process.exit(1);
  }
}

module.exports = { AdminScreenshotGenerator };

if (require.main === module) {
  main();
}
