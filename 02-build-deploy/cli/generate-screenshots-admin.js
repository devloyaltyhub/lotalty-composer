#!/usr/bin/env node

/**
 * Generate Screenshots Admin CLI
 *
 * Capture screenshots from Android devices (phone + tablet) for
 * loyalty-admin-main Google Play Store listing.
 *
 * IMPORTANT: Screenshots are captured from REAL ANDROID DEVICES/EMULATORS.
 * This script orchestrates:
 * 1. Detecting Android devices (phone + tablet)
 * 2. Running integration tests on Android
 * 3. Generating mockups via Python pipeline
 * 4. Copying to metadata folder
 *
 * Usage:
 *   node generate-screenshots-admin.js
 *   node generate-screenshots-admin.js --phone-device=<device_id>
 *   node generate-screenshots-admin.js --tablet-device=<device_id>
 *   node generate-screenshots-admin.js --skip-tests
 *   node generate-screenshots-admin.js --skip-mockups
 */

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');
const inquirer = require('inquirer');
const { COMPOSE_ROOT } = require('../../shared/utils/paths');

// Load environment variables
require('dotenv').config({ path: path.join(COMPOSE_ROOT, '.env') });

const logger = require('../../shared/utils/logger');

// Constants
// COMPOSE_ROOT is loyalty-composer, parent is loyaltyhub/
const REPO_ROOT = path.dirname(COMPOSE_ROOT);
const ADMIN_ROOT = path.join(REPO_ROOT, 'loyalty-admin-main');
const SCREENSHOTS_DIR = path.join(ADMIN_ROOT, 'screenshots');
const METADATA_DIR = path.join(ADMIN_ROOT, 'metadata', 'android', 'pt-BR', 'images');
const PYTHON_PIPELINE = path.join(COMPOSE_ROOT, '02-build-deploy', 'screenshots', 'main.py');

/**
 * Admin Screenshot Generator
 */
class AdminScreenshotGenerator {
  constructor(options = {}) {
    this.options = options;
    this.phoneDevice = options.phoneDevice;
    this.tabletDevice = options.tabletDevice;
    this.skipTests = options.skipTests || false;
    this.skipMockups = options.skipMockups || false;
  }

  /**
   * Execute shell command
   */
  exec(command, options = {}) {
    try {
      return execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: options.cwd || ADMIN_ROOT,
        ...options,
      }).trim();
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  /**
   * Get list of available Android devices
   */
  getAndroidDevices() {
    try {
      const output = this.exec('flutter devices --machine', { silent: true });
      const devices = JSON.parse(output);

      return devices.filter((d) =>
        d.platform === 'android-x64' ||
        d.platform === 'android' ||
        d.platform === 'android-arm' ||
        d.platform === 'android-arm64'
      );
    } catch (error) {
      logger.warn('Erro ao listar dispositivos Android');
      return [];
    }
  }

  /**
   * Check if any Android device is connected via adb
   */
  checkAdbDevices() {
    try {
      const output = this.exec('adb devices', { silent: true });
      const lines = output.split('\n').filter(line =>
        line.trim() &&
        !line.includes('List of devices') &&
        line.includes('device')
      );
      return lines.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get list of available emulators
   */
  getAvailableEmulators() {
    try {
      const output = this.exec('flutter emulators', { silent: true });
      const lines = output.split('\n');

      const emulators = [];
      let parsingData = false;

      for (const line of lines) {
        // Skip until we find the header line
        if (line.includes('Id') && line.includes('Name') && line.includes('Platform')) {
          parsingData = true;
          continue;
        }

        // Stop parsing when we hit instructions
        if (line.includes('To run an emulator') || line.includes('To create a new emulator')) {
          break;
        }

        // Parse emulator lines (they contain '•' separator)
        if (parsingData && line.includes('•')) {
          const parts = line.split('•').map(p => p.trim());
          if (parts.length >= 4) {
            const [id, name, manufacturer, platform] = parts;
            if (platform === 'android' && id && name) {
              emulators.push({ id, name, manufacturer, platform });
            }
          }
        }
      }

      return emulators;
    } catch (error) {
      logger.warn('Erro ao listar emuladores');
      return [];
    }
  }

  /**
   * Launch an Android emulator
   */
  async launchEmulator(emulatorId) {
    logger.startSpinner(`Iniciando emulador ${emulatorId}...`);

    try {
      // Launch emulator in background using emulator command directly
      const { spawn } = require('child_process');
      const emulatorProcess = spawn('flutter', ['emulators', '--launch', emulatorId], {
        detached: true,
        stdio: 'ignore',
      });
      emulatorProcess.unref();

      logger.succeedSpinner(`Comando de inicializacao enviado para ${emulatorId}`);

      // Wait for emulator to be ready with better feedback
      logger.startSpinner('Aguardando emulador inicializar (isso pode levar 1-2 minutos)...');

      let attempts = 0;
      const maxAttempts = 120; // 2 minutes
      let lastDeviceCount = 0;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check both flutter devices and adb
        const devices = this.getAndroidDevices();
        const adbHasDevices = this.checkAdbDevices();

        // Update spinner with progress
        if (attempts % 10 === 0 && attempts > 0) {
          logger.updateSpinner(`Aguardando emulador... (${attempts}s/${maxAttempts}s)`);
        }

        // Device detected
        if (devices.length > 0 || adbHasDevices) {
          // Wait a bit more to ensure device is fully booted
          if (lastDeviceCount === 0) {
            logger.updateSpinner('Dispositivo detectado, verificando se esta pronto...');
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
          lastDeviceCount = devices.length;

          // Double-check after wait
          const finalDevices = this.getAndroidDevices();
          if (finalDevices.length > 0) {
            logger.succeedSpinner(`Emulador pronto! (${attempts}s)`);
            return true;
          }
        }

        attempts++;
      }

      logger.failSpinner(`Timeout esperando emulador inicializar (${maxAttempts}s)`);
      logger.warn('Tente iniciar o emulador manualmente e execute o script novamente.');
      return false;
    } catch (error) {
      logger.failSpinner('Falha ao iniciar emulador');
      throw error;
    }
  }

  /**
   * Detect Android phone and tablet devices
   */
  async detectDevices() {
    logger.startSpinner('Detectando dispositivos Android...');

    let devices = this.getAndroidDevices();

    if (devices.length === 0) {
      logger.failSpinner('Nenhum dispositivo Android encontrado');

      // Try to find and launch an available emulator
      logger.info('Procurando emuladores disponiveis...');
      const emulators = this.getAvailableEmulators();

      if (emulators.length === 0) {
        throw new Error(
          'Nenhum emulador Android disponivel.\n' +
            'Crie um emulador usando Android Studio ou execute:\n' +
            '  flutter emulators --create'
        );
      }

      logger.info(`Encontrados ${emulators.length} emuladores Android:`);
      emulators.forEach(e => {
        logger.keyValue(`  ${e.name}`, e.id, 2);
      });
      logger.blank();

      // Find a phone emulator (prefer Pixel)
      let selectedEmulator = emulators.find(e =>
        e.name.toLowerCase().includes('pixel') &&
        !e.name.toLowerCase().includes('tablet')
      ) || emulators[0];

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Deseja iniciar o emulador ${selectedEmulator.name}?`,
          default: true,
        },
      ]);

      if (!confirm) {
        throw new Error('Operacao cancelada. Inicie um emulador manualmente e execute o script novamente.');
      }

      const launched = await this.launchEmulator(selectedEmulator.id);

      if (!launched) {
        throw new Error('Falha ao iniciar emulador. Tente iniciar manualmente.');
      }

      // Get devices again after launching emulator
      devices = this.getAndroidDevices();

      if (devices.length === 0) {
        throw new Error('Falha ao detectar emulador apos inicializacao.');
      }
    } else {
      logger.succeedSpinner(`Encontrados ${devices.length} dispositivos Android`);
    }

    // Categorize devices by type (heuristic based on name)
    const phones = devices.filter(
      (d) =>
        d.name.toLowerCase().includes('phone') ||
        d.name.toLowerCase().includes('pixel') ||
        (!d.name.toLowerCase().includes('tablet') && !d.name.toLowerCase().includes('pad'))
    );

    const tablets = devices.filter(
      (d) => d.name.toLowerCase().includes('tablet') || d.name.toLowerCase().includes('pad')
    );

    return { phones, tablets, all: devices };
  }

  /**
   * Prompt user to select devices
   */
  async selectDevices() {
    const { phones, tablets, all } = await this.detectDevices();

    logger.blank();
    logger.info('Dispositivos disponiveis:');
    all.forEach((d, i) => {
      const type = phones.includes(d) ? '📱 Phone' : '📱 Tablet';
      logger.keyValue(`  ${i + 1}. ${type}`, d.name);
    });
    logger.blank();

    // Select phone
    let phoneDevice = this.phoneDevice;
    if (!phoneDevice) {
      if (phones.length === 0) {
        logger.warn('Nenhum phone Android detectado. Usando primeiro dispositivo disponivel.');
        phoneDevice = all[0].id;
      } else if (phones.length === 1) {
        phoneDevice = phones[0].id;
        logger.info(`Phone selecionado automaticamente: ${phones[0].name}`);
      } else {
        const { selectedPhone } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedPhone',
            message: 'Selecione o dispositivo PHONE para screenshots:',
            choices: phones.map((d) => ({ name: d.name, value: d.id })),
          },
        ]);
        phoneDevice = selectedPhone;
      }
    }

    // Select tablet (optional)
    let tabletDevice = this.tabletDevice;
    if (!tabletDevice && tablets.length > 0) {
      const { useTablet } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useTablet',
          message: 'Deseja tambem gerar screenshots para TABLET?',
          default: true,
        },
      ]);

      if (useTablet) {
        if (tablets.length === 1) {
          tabletDevice = tablets[0].id;
          logger.info(`Tablet selecionado automaticamente: ${tablets[0].name}`);
        } else {
          const { selectedTablet } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedTablet',
              message: 'Selecione o dispositivo TABLET para screenshots:',
              choices: tablets.map((d) => ({ name: d.name, value: d.id })),
            },
          ]);
          tabletDevice = selectedTablet;
        }
      }
    }

    return { phoneDevice, tabletDevice };
  }

  /**
   * Check if integration tests exist
   */
  checkIntegrationTests() {
    const testFile = path.join(ADMIN_ROOT, 'integration_test', 'all_screenshots_test.dart');
    const testDriver = path.join(ADMIN_ROOT, 'test_driver', 'integration_test.dart');

    if (!fs.existsSync(testFile)) {
      throw new Error(`Integration test nao encontrado: ${testFile}`);
    }

    if (!fs.existsSync(testDriver)) {
      throw new Error(`Test driver nao encontrado: ${testDriver}`);
    }

    return true;
  }

  /**
   * Run integration tests on Android device
   */
  runIntegrationTest(deviceId, deviceType = 'phone') {
    logger.section(`Capturando Screenshots: ${deviceType.toUpperCase()}`);

    logger.info(`Dispositivo: ${deviceId}`);
    logger.blank();

    // Clean old screenshots
    const screenshotsPattern = path.join(SCREENSHOTS_DIR, '*.png');
    try {
      this.exec(`rm -f ${screenshotsPattern}`, { silent: true });
    } catch {
      // Ignore if no files to delete
    }

    logger.startSpinner('Executando integration tests no Android...');

    try {
      this.exec(
        `flutter drive \
          --driver=test_driver/integration_test.dart \
          --target=integration_test/all_screenshots_test.dart \
          -d ${deviceId}`,
        { cwd: ADMIN_ROOT }
      );

      logger.succeedSpinner('Integration tests concluidos');

      // Check if screenshots were captured
      const screenshots = fs.readdirSync(SCREENSHOTS_DIR).filter((f) => f.endsWith('.png'));

      if (screenshots.length === 0) {
        logger.warn('Nenhum screenshot capturado. Verifique os logs do teste.');
        return false;
      }

      logger.success(`✅ ${screenshots.length} screenshots capturados com sucesso`);
      return true;
    } catch (error) {
      logger.failSpinner('Integration tests falharam');
      throw error;
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
      logger.error('Instale Python 3 para gerar mockups');
      logger.error('brew install python3');
      return false;
    }
  }

  /**
   * Generate mockups using Python pipeline
   */
  generateMockups() {
    logger.section('Gerando Mockups');

    if (!fs.existsSync(PYTHON_PIPELINE)) {
      throw new Error(`Python pipeline nao encontrado: ${PYTHON_PIPELINE}`);
    }

    // Check if screenshots exist
    const screenshots = fs.readdirSync(SCREENSHOTS_DIR).filter((f) => f.endsWith('.png'));

    if (screenshots.length === 0) {
      throw new Error('Nenhum screenshot encontrado para gerar mockups');
    }

    logger.info(`Screenshots encontrados: ${screenshots.length}`);
    logger.blank();

    logger.startSpinner('Gerando mockups com Python pipeline...');

    try {
      // Use project flag -p admin to use LoyaltyAdminConfig
      // gradient-choice 0 = use project primary color (#6366F1)
      // gplay-only = only Google Play screenshots (no iOS)
      this.exec(
        `python3 ${PYTHON_PIPELINE} -p admin mockups \
          --device-choice 1 \
          --gradient-choice 0 \
          --no-logo \
          --gplay-only`,
        { cwd: COMPOSE_ROOT }
      );

      logger.succeedSpinner('Mockups gerados com sucesso');
      return true;
    } catch (error) {
      logger.failSpinner('Geracao de mockups falhou');
      throw error;
    }
  }

  /**
   * Copy mockups to metadata folder
   */
  copyToMetadata() {
    logger.section('Copiando para Metadata');

    const mockupsDir = path.join(SCREENSHOTS_DIR, 'mockups');
    const phoneDir = path.join(mockupsDir, 'gplay_phone');
    const tabletDir = path.join(mockupsDir, 'gplay_tablet');
    const featureGraphicSrc = path.join(mockupsDir, 'feature_graphic', 'featureGraphic.png');

    // Ensure metadata directories exist
    const phoneMetadataDir = path.join(METADATA_DIR, 'phoneScreenshots');
    const tabletMetadataDir = path.join(METADATA_DIR, 'tenInchScreenshots');

    fs.mkdirSync(phoneMetadataDir, { recursive: true });
    fs.mkdirSync(tabletMetadataDir, { recursive: true });

    let copiedCount = 0;

    // Copy phone screenshots
    if (fs.existsSync(phoneDir)) {
      const phoneScreenshots = fs.readdirSync(phoneDir).filter((f) => f.endsWith('.png'));

      if (phoneScreenshots.length > 0) {
        logger.startSpinner(`Copiando ${phoneScreenshots.length} phone screenshots...`);

        // Clean old screenshots
        fs.readdirSync(phoneMetadataDir).forEach((f) => {
          if (f.endsWith('.png')) {
            fs.unlinkSync(path.join(phoneMetadataDir, f));
          }
        });

        // Copy new screenshots
        phoneScreenshots.forEach((file) => {
          fs.copyFileSync(path.join(phoneDir, file), path.join(phoneMetadataDir, file));
        });

        logger.succeedSpinner(`Phone screenshots copiados (${phoneScreenshots.length})`);
        copiedCount += phoneScreenshots.length;
      }
    }

    // Copy tablet screenshots
    if (fs.existsSync(tabletDir)) {
      const tabletScreenshots = fs.readdirSync(tabletDir).filter((f) => f.endsWith('.png'));

      if (tabletScreenshots.length > 0) {
        logger.startSpinner(`Copiando ${tabletScreenshots.length} tablet screenshots...`);

        // Clean old screenshots
        fs.readdirSync(tabletMetadataDir).forEach((f) => {
          if (f.endsWith('.png')) {
            fs.unlinkSync(path.join(tabletMetadataDir, f));
          }
        });

        // Copy new screenshots
        tabletScreenshots.forEach((file) => {
          fs.copyFileSync(path.join(tabletDir, file), path.join(tabletMetadataDir, file));
        });

        logger.succeedSpinner(`Tablet screenshots copiados (${tabletScreenshots.length})`);
        copiedCount += tabletScreenshots.length;
      }
    }

    // Copy feature graphic
    if (fs.existsSync(featureGraphicSrc)) {
      const featureGraphicDest = path.join(METADATA_DIR, 'featureGraphic.png');
      fs.copyFileSync(featureGraphicSrc, featureGraphicDest);
      logger.success('✅ Feature Graphic copiado');
      copiedCount++;
    }

    if (copiedCount === 0) {
      logger.warn('Nenhum mockup encontrado para copiar');
      return false;
    }

    logger.blank();
    logger.success(`Total de arquivos copiados: ${copiedCount}`);
    return true;
  }

  /**
   * Run complete screenshot generation workflow
   */
  async generate() {
    const startTime = Date.now();

    try {
      logger.section('Screenshot Generator - Admin');
      logger.blank();

      // Step 1: Check integration tests
      this.checkIntegrationTests();

      // Step 2: Detect and select devices
      const devices = await this.selectDevices();

      logger.blank();
      logger.summaryBox({
        'Phone Device': devices.phoneDevice,
        'Tablet Device': devices.tabletDevice || 'N/A',
        'Skip Tests': this.skipTests ? 'Sim' : 'Nao',
        'Skip Mockups': this.skipMockups ? 'Sim' : 'Nao',
      });
      logger.blank();

      // Confirm
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

      // Step 3: Run integration tests (if not skipped)
      let testsSuccess = true;
      if (!this.skipTests) {
        testsSuccess = this.runIntegrationTest(devices.phoneDevice, 'phone');

        if (!testsSuccess) {
          throw new Error('Captura de screenshots falhou');
        }
      } else {
        logger.info('⏭️  Pulando execucao de testes (--skip-tests)');
      }

      // Step 4: Generate mockups (if not skipped)
      if (!this.skipMockups) {
        if (!this.checkPythonDependencies()) {
          throw new Error('Python nao disponivel');
        }

        this.generateMockups();
      } else {
        logger.info('⏭️  Pulando geracao de mockups (--skip-mockups)');
      }

      // Step 5: Copy to metadata folders
      this.copyToMetadata();

      // Summary
      const duration = Math.floor((Date.now() - startTime) / 1000);
      logger.blank();
      logger.summaryBox({
        Status: '✅ Concluido',
        Projeto: 'Loyalty Admin',
        Plataforma: 'Android (Google Play)',
        'Phone Screenshots': fs.existsSync(path.join(METADATA_DIR, 'phoneScreenshots'))
          ? fs.readdirSync(path.join(METADATA_DIR, 'phoneScreenshots')).filter((f) =>
              f.endsWith('.png')
            ).length
          : 0,
        'Tablet Screenshots': fs.existsSync(path.join(METADATA_DIR, 'tenInchScreenshots'))
          ? fs.readdirSync(path.join(METADATA_DIR, 'tenInchScreenshots')).filter((f) =>
              f.endsWith('.png')
            ).length
          : 0,
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

/**
 * Parse CLI arguments
 */
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

/**
 * Show help
 */
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

/**
 * Main function
 */
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
