#!/usr/bin/env node

/**
 * Deploy Client CLI
 *
 * Complete deployment orchestrator for white-label loyalty apps.
 * Handles the full pipeline: screenshots → build → upload → submit.
 *
 * Features:
 * - Parallel Android and iOS builds/uploads
 * - Automatic screenshot generation
 * - Direct submission to stores
 * - Manual or automatic version control
 *
 * Usage:
 *   node deploy-client.js
 *   node deploy-client.js --client=demo
 *   node deploy-client.js --client=demo --version=1.2.3+45
 *   node deploy-client.js --client=demo --add-logo
 *   node deploy-client.js --client=demo --no-logo
 *
 * Options:
 *   --client=<code>    Client code to deploy (interactive if not provided)
 *   --version=X.Y.Z+B  Set specific version (interactive prompt if not provided)
 *   --add-logo         Add logo to screenshot mockups (default for production)
 *   --no-logo          Skip adding logo to screenshot mockups
 */

const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');

// Load environment variables with credential path expansion
const { loadEnvWithExpansion } = require('../../01-client-setup/shared/env-loader');
loadEnvWithExpansion(__dirname);

const logger = require('../../shared/utils/logger');
const clientSelector = require('../../shared/utils/client-selector');
const telegram = require('../../shared/utils/telegram');
const ClientBuilder = require('../build-client');
const { ScreenshotGenerator, checkExistingScreenshots } = require('./generate-screenshots');
const { updateVersionarteAfterDeploy } = require('../update-versionarte');

// Constants
const REPO_PATH = path.resolve(__dirname, '../../..');

/**
 * Client Deployer - Orchestrates the full deployment pipeline
 */
class ClientDeployer extends ClientBuilder {
  constructor(clientCode, options = {}) {
    super(REPO_PATH);
    this.clientCode = clientCode;
    this.options = options;
    this.config = null;
    this.version = null;
    this.buildNumber = null;
    this.manualVersion = options.version || null; // Version specified via CLI
    this.addLogo = options.addLogo !== undefined ? options.addLogo : true; // Default: add logo
    this.submitExistingBuild = options.submitExistingBuild || null; // Build number to submit without new build (iOS)
    this.submitExistingVersion = options.submitExistingVersion || null; // Full version string (e.g., "0.0.3+5")
    this.promoteAndroidBuild = options.promoteAndroidBuild || null; // Version code to promote (Android)
    this.promoteAndroidVersion = options.promoteAndroidVersion || null; // Full version string for Android
    this.deployTargets = {
      android: null, // 'internal', 'production', 'promote_existing', ou null (pular)
      ios: null, // 'testflight', 'appstore', 'submit_existing', ou null (pular)
    };
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
   * Fetch available builds from Google Play Internal Testing track
   * Returns array of { version, versionCode, status }
   */
  async fetchInternalTestingBuilds() {
    const { execSync } = require('child_process');
    const fastlanePath = path.resolve(REPO_PATH, 'automation', '02-build-deploy', 'fastlane');

    try {
      // Load client config to get package name (only if not already loaded)
      if (!this.config) {
        this.runWhiteLabelSetup(this.clientCode, true);
        this.config = this.loadClientConfig();
      }

      logger.info(`Buscando builds disponiveis no Internal Testing...`);

      // Use Fastlane to get version codes from internal track
      // This command lists all versions in the internal track
      const command = `fastlane run google_play_track_version_codes track:internal json_key:${process.env.GOOGLE_PLAY_JSON_KEY} package_name:${this.config.bundleId} 2>&1 || true`;

      const result = execSync(command, {
        cwd: fastlanePath,
        encoding: 'utf8',
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Parse the output to extract version codes
      const builds = [];

      // Look for version codes in the output (format varies)
      // Try to find array-like output: [5, 4, 3] or individual numbers
      const versionCodeRegex = /\[([0-9,\s]+)\]/;
      const match = result.match(versionCodeRegex);

      if (match) {
        const versionCodes = match[1].split(',').map((v) => parseInt(v.trim(), 10)).filter((v) => !isNaN(v));
        for (const versionCode of versionCodes) {
          builds.push({
            version: 'N/A',
            versionCode: versionCode,
            status: versionCode === Math.max(...versionCodes) ? 'Latest' : 'Previous',
          });
        }
      }

      // If no builds found from regex, try to get at least the current version
      if (builds.length === 0) {
        const versionInfo = this.getVersionInfo();
        // Add recent builds based on pubspec version
        for (let i = parseInt(versionInfo.buildNumber, 10); i >= 1 && i > parseInt(versionInfo.buildNumber, 10) - 5; i--) {
          builds.push({
            version: versionInfo.version,
            versionCode: i,
            status: i === parseInt(versionInfo.buildNumber, 10) ? 'Latest' : 'Previous',
          });
        }
      }

      return builds;
    } catch (error) {
      logger.warn(`Erro ao buscar builds: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch available builds from TestFlight using Fastlane
   * Returns array of { version, buildNumber, status, uploadedDate }
   */
  async fetchTestFlightBuilds() {
    const { execSync } = require('child_process');
    const fastlanePath = path.resolve(REPO_PATH, 'automation', '02-build-deploy', 'fastlane');

    try {
      // Load client config to get bundle ID (only if not already loaded)
      if (!this.config) {
        this.runWhiteLabelSetup(this.clientCode, true);
        this.config = this.loadClientConfig();
      }
      const bundleId = this.config.bundleId;

      logger.info(`Buscando builds disponiveis no TestFlight para ${bundleId}...`);

      // Use Fastlane to get builds - captures JSON output
      const command = `fastlane run latest_testflight_build_number app_identifier:${bundleId} --json 2>/dev/null || echo '{}'`;

      // For now, use a simpler approach - just get the latest build info
      // The full list would require App Store Connect API directly
      const latestBuildCmd = `fastlane ios get_testflight_builds app_identifier:${bundleId} 2>&1 || true`;

      // Try to execute and parse output
      const result = execSync(latestBuildCmd, {
        cwd: fastlanePath,
        encoding: 'utf8',
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Parse the output to extract build info
      // This is a simplified parser - adjust based on actual Fastlane output
      const builds = [];
      const buildRegex = /(\d+\.\d+\.\d+)\s*\((\d+)\)\s*-?\s*([\w\s]+)?/g;
      let match;

      while ((match = buildRegex.exec(result)) !== null) {
        builds.push({
          version: match[1],
          buildNumber: match[2],
          status: match[3]?.trim() || 'Ready',
          uploadedDate: 'N/A',
        });
      }

      // If no builds found from regex, try to get at least the current version
      if (builds.length === 0) {
        const versionInfo = this.getVersionInfo();
        // Add recent builds based on pubspec version
        for (let i = parseInt(versionInfo.buildNumber, 10); i >= 1 && i > parseInt(versionInfo.buildNumber, 10) - 5; i--) {
          builds.push({
            version: versionInfo.version,
            buildNumber: String(i),
            status: i === parseInt(versionInfo.buildNumber, 10) ? 'Latest' : 'Previous',
            uploadedDate: 'N/A',
          });
        }
      }

      return builds;
    } catch (error) {
      logger.warn(`Erro ao buscar builds: ${error.message}`);
      return null;
    }
  }

  /**
   * Prompt user to select deploy targets for each platform
   */
  async promptDeployTargets() {
    // Check platform availability
    const googlePlayStatus = this.checkGooglePlayCredentials();
    const appStoreStatus = this.checkAppStoreCredentials();
    const isMac = process.platform === 'darwin';

    // Build platform choices based on availability
    const platformChoices = [
      { name: 'Android e iOS', value: 'both' },
      { name: 'Apenas Android', value: 'android' },
      {
        name: 'Android - Promover build do Internal Testing para Production (sem nova build)',
        value: 'android_promote_existing',
      },
    ];

    if (isMac) {
      platformChoices.push({ name: 'Apenas iOS', value: 'ios' });
      platformChoices.push({
        name: 'iOS - Submeter build existente do TestFlight para App Store (sem nova build)',
        value: 'ios_submit_existing',
      });
    }

    // Show credential warnings if needed
    if (!googlePlayStatus.configured) {
      logger.warn(`Google Play: ${googlePlayStatus.reason}`);
    }
    if (!isMac) {
      logger.warn('iOS requer macOS - opção não disponível');
    } else if (!appStoreStatus.configured) {
      logger.warn(`App Store: ${appStoreStatus.reason}`);
    }
    logger.blank();

    // Step 1: Choose platform(s)
    const { platform } = await inquirer.prompt([
      {
        type: 'list',
        name: 'platform',
        message: 'Qual plataforma deseja fazer deploy?',
        choices: platformChoices,
      },
    ]);

    // Handle Android promote existing build flow separately
    if (platform === 'android_promote_existing') {
      // Try to fetch available builds from Internal Testing
      const availableBuilds = await this.fetchInternalTestingBuilds();

      let versionCode;
      let versionString;

      if (availableBuilds && availableBuilds.length > 0) {
        // Show list of available builds
        const { selectedBuild } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedBuild',
            message: 'Selecione a build do Internal Testing:',
            choices: availableBuilds.map((b) => ({
              name: `Version Code: ${b.versionCode} (${b.status})${b.version !== 'N/A' ? ` - v${b.version}` : ''}`,
              value: b.versionCode,
            })),
          },
        ]);
        versionCode = selectedBuild;
        const selectedInfo = availableBuilds.find((b) => b.versionCode === versionCode);
        versionString = selectedInfo?.version !== 'N/A' ? `${selectedInfo.version}+${versionCode}` : `+${versionCode}`;
      } else {
        // Fallback to manual input if fetch fails
        logger.warn('Nao foi possivel obter lista de builds do Internal Testing');
        const { manualVersionCode } = await inquirer.prompt([
          {
            type: 'input',
            name: 'manualVersionCode',
            message: 'Digite o version code da build (ex: 5):',
            validate: (input) => {
              const versionCodeInt = parseInt(input, 10);
              if (isNaN(versionCodeInt) || versionCodeInt <= 0) {
                return 'Version code deve ser um numero inteiro positivo';
              }
              return true;
            },
          },
        ]);
        versionCode = parseInt(manualVersionCode, 10);
        versionString = `+${versionCode}`;
      }

      this.promoteAndroidBuild = versionCode;
      this.promoteAndroidVersion = versionString;
      this.deployTargets.android = 'promote_existing';
      return this.deployTargets;
    }

    // Handle iOS submit existing build flow separately
    if (platform === 'ios_submit_existing') {
      // Try to fetch available builds from TestFlight
      const availableBuilds = await this.fetchTestFlightBuilds();

      let versionString;

      if (availableBuilds && availableBuilds.length > 0) {
        // Show list of available builds
        const { selectedBuild } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedBuild',
            message: 'Selecione a build do TestFlight:',
            choices: availableBuilds.map((b) => ({
              name: `${b.version}+${b.buildNumber} (${b.status}) - ${b.uploadedDate}`,
              value: `${b.version}+${b.buildNumber}`,
            })),
          },
        ]);
        versionString = selectedBuild;
      } else {
        // Fallback to manual input if fetch fails
        logger.warn('Nao foi possivel obter lista de builds do TestFlight');
        const { manualVersion } = await inquirer.prompt([
          {
            type: 'input',
            name: 'manualVersion',
            message: 'Digite a versao do TestFlight (ex: 0.0.3+5):',
            validate: (input) => {
              const versionRegex = /^[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+$/;
              if (!versionRegex.test(input)) {
                return 'Formato invalido. Use X.Y.Z+B (ex: 0.0.3+5)';
              }
              return true;
            },
          },
        ]);
        versionString = manualVersion;
      }

      // Extract build number from version string (e.g., "0.0.3+5" -> 5)
      const buildNumber = parseInt(versionString.split('+')[1], 10);
      this.submitExistingBuild = buildNumber;
      this.submitExistingVersion = versionString;
      this.deployTargets.ios = 'submit_existing';
      return this.deployTargets;
    }

    // Step 2: Choose environment (test or production)
    const { environment } = await inquirer.prompt([
      {
        type: 'list',
        name: 'environment',
        message: 'Qual ambiente?',
        choices: [
          { name: 'Teste (TestFlight / Teste Interno)', value: 'test' },
          { name: 'Produção (App Store / Play Store)', value: 'prod' },
        ],
      },
    ]);

    // Map selections to deploy targets
    const includeAndroid = platform === 'both' || platform === 'android';
    const includeIos = (platform === 'both' || platform === 'ios') && isMac;

    if (includeAndroid) {
      this.deployTargets.android = environment === 'test' ? 'internal' : 'production';
    }

    if (includeIos) {
      this.deployTargets.ios = environment === 'test' ? 'testflight' : 'appstore';
    }

    return this.deployTargets;
  }

  /**
   * Validate deployment prerequisites
   */
  async validatePrerequisites() {
    logger.section('Fase 1: Validacao');

    // Validate that white-label setup was already done for this client
    // Deploy mode only validates existing setup, skipping redundant operations like
    // icon generation, splash screen, package_rename, flutter clean, pod install, etc.
    this.runWhiteLabelSetup(this.clientCode, true);
    this.config = this.loadClientConfig();
    logger.info(`Cliente: ${this.config.clientName} (${this.config.clientCode})`);
    logger.info(`Bundle ID: ${this.config.bundleId}`);

    // Check Google Play credentials
    const hasGooglePlay = process.env.GOOGLE_PLAY_JSON_KEY &&
      fs.existsSync(path.resolve(process.env.GOOGLE_PLAY_JSON_KEY));

    // Check App Store credentials
    const hasAppStore = process.env.APP_STORE_CONNECT_API_KEY_ID &&
      process.env.APP_STORE_CONNECT_API_ISSUER_ID;

    if (!hasGooglePlay && !hasAppStore) {
      throw new Error('Nenhuma credencial de store configurada. Configure GOOGLE_PLAY_JSON_KEY ou APP_STORE_CONNECT_API_*');
    }

    logger.keyValue('Google Play', hasGooglePlay ? 'Configurado' : 'Nao configurado');
    logger.keyValue('App Store', hasAppStore ? 'Configurado' : 'Nao configurado');

    logger.success('Validacao concluida');
    return true;
  }

  /**
   * Prompt user to choose version strategy
   * Returns the version string if manual, or null to use auto-increment
   */
  async promptVersionStrategy() {
    // Get current version info
    const currentVersionInfo = this.getVersionInfo();
    const currentVersion = `${currentVersionInfo.version}+${currentVersionInfo.buildNumber}`;

    // Calculate what auto-increment would produce
    const nextBuild = parseInt(currentVersionInfo.buildNumber, 10) + 1;
    const autoIncrementVersion = `${currentVersionInfo.version}+${nextBuild}`;

    logger.info(`Versao atual: ${currentVersion}`);
    logger.blank();

    const { versionChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'versionChoice',
        message: 'Como deseja definir a versao?',
        choices: [
          {
            name: `Incrementar automaticamente (${currentVersion} → ${autoIncrementVersion})`,
            value: 'auto',
          },
          {
            name: 'Definir versao manualmente',
            value: 'manual',
          },
        ],
      },
    ]);

    if (versionChoice === 'auto') {
      return null; // Use auto-increment
    }

    // Prompt for manual version
    const { manualVersion } = await inquirer.prompt([
      {
        type: 'input',
        name: 'manualVersion',
        message: 'Digite a versao (formato X.Y.Z+B, ex: 1.2.3+45):',
        validate: (input) => {
          const versionRegex = /^[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+$/;
          if (!versionRegex.test(input)) {
            return 'Formato invalido. Use X.Y.Z+B (ex: 1.2.3+45)';
          }
          return true;
        },
      },
    ]);

    return manualVersion;
  }

  /**
   * Setup white label and handle version
   */
  async setupEnvironment() {
    logger.section('Fase 2: Setup');

    // Load config if not loaded (config is in white_label_app/ after validation phase ran setup)
    if (!this.config) {
      this.config = this.loadClientConfig();
    }

    // Create deploy branch
    await this.createDeployBranch(this.config.clientCode);

    // Handle version: CLI flag > interactive prompt > auto-increment
    if (this.manualVersion) {
      // Version specified via CLI flag
      this.setVersion(this.manualVersion);
    } else {
      // Ask user how to handle version
      const chosenVersion = await this.promptVersionStrategy();
      if (chosenVersion) {
        this.setVersion(chosenVersion);
      } else {
        this.incrementBuildNumber();
      }
    }

    // Get version info
    const versionInfo = this.getVersionInfo();
    this.version = versionInfo.version;
    this.buildNumber = versionInfo.buildNumber;

    logger.success(`Setup concluido - v${this.version}+${this.buildNumber}`);
    return true;
  }

  /**
   * Generate screenshots for all devices
   * Screenshots are only required for public stores (App Store, Play Store Production)
   * TestFlight and Internal Testing do not require screenshots
   */
  async generateScreenshots() {
    logger.section('Fase 3: Screenshots');

    // Check if screenshots are needed based on deploy targets
    const needsScreenshots =
      this.deployTargets.ios === 'appstore' || this.deployTargets.android === 'production';

    if (!needsScreenshots) {
      logger.info('Screenshots pulados (destino e apenas TestFlight/Internal)');
      return true;
    }

    // Check if screenshots already exist
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
        logger.success('Screenshots existentes mantidos');
        return true;
      }

      logger.blank();
    }

    // Ask about logo if not specified via CLI (after user confirmed they want screenshots)
    let addLogo = this.addLogo;
    if (this.options.addLogo === undefined) {
      const { logoChoice } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'logoChoice',
          message: 'Adicionar logo no rodape dos mockups?',
          default: true,
        },
      ]);
      addLogo = logoChoice;
    }

    const generator = new ScreenshotGenerator(this.clientCode, REPO_PATH);

    // Run screenshot pipeline (gradientChoice 0 = use client primary color)
    const result = await generator.generate({
      deviceChoice: 1,
      gradientChoice: 0,
      angleChoice: 2,
      addLogo,
    });

    if (!result.success) {
      throw new Error(`Falha na geracao de screenshots: ${result.error}`);
    }

    logger.success('Screenshots gerados');
    return true;
  }

  /**
   * Build Android and iOS apps
   * Only builds platforms that have a deploy target selected
   */
  async buildApps() {
    logger.section('Fase 4: Build');

    const shouldBuildAndroid = this.deployTargets.android !== null;
    const shouldBuildIos = this.deployTargets.ios !== null && process.platform === 'darwin';

    // Build Android (only if deploy target is selected)
    if (shouldBuildAndroid) {
      logger.info('Compilando Android...');
      this.buildAndroid(this.clientCode);
    } else {
      logger.info('Build Android pulado (nenhum destino Android selecionado)');
    }

    // Build iOS (only if deploy target is selected and on macOS)
    if (shouldBuildIos) {
      logger.info('Compilando iOS...');
      this.buildIos(this.clientCode);
    } else if (this.deployTargets.ios !== null && process.platform !== 'darwin') {
      logger.warn('Build iOS ignorado (requer macOS)');
    } else {
      logger.info('Build iOS pulado (nenhum destino iOS selecionado)');
    }

    logger.success('Builds concluidos');
    return true;
  }

  /**
   * Submit existing build from TestFlight to App Store
   */
  submitExistingBuildToAppStore(clientCode, buildNumber) {
    const { execSync } = require('child_process');
    // Fastlane directory contains the Gemfile
    const fastlanePath = path.resolve(REPO_PATH, 'automation', '02-build-deploy', 'fastlane');

    logger.info(`Submetendo build ${buildNumber} do TestFlight para App Store...`);
    logger.info(`Diretorio: ${fastlanePath}`);

    const command = `bundle exec fastlane ios submit_existing_build client:${clientCode} build_number:${buildNumber}`;

    try {
      execSync(command, {
        cwd: fastlanePath,
        stdio: 'inherit',
        env: { ...process.env },
      });
    } catch (error) {
      // If bundle fails, try without bundle (fastlane installed globally)
      logger.warn('bundle exec falhou, tentando fastlane diretamente...');
      execSync(`fastlane ios submit_existing_build client:${clientCode} build_number:${buildNumber}`, {
        cwd: fastlanePath,
        stdio: 'inherit',
        env: { ...process.env },
      });
    }
  }

  /**
   * Promote existing build from Internal Testing to Production on Google Play
   */
  promoteAndroidBuildToProduction(clientCode, versionCode) {
    const { execSync } = require('child_process');
    // Fastlane directory contains the Gemfile
    const fastlanePath = path.resolve(REPO_PATH, 'automation', '02-build-deploy', 'fastlane');

    logger.info(`Promovendo build ${versionCode} do Internal Testing para Production...`);
    logger.info(`Diretorio: ${fastlanePath}`);

    const command = `bundle exec fastlane android promote_to_production client:${clientCode} version_code:${versionCode}`;

    try {
      execSync(command, {
        cwd: fastlanePath,
        stdio: 'inherit',
        env: { ...process.env },
      });
    } catch (error) {
      // If bundle fails, try without bundle (fastlane installed globally)
      logger.warn('bundle exec falhou, tentando fastlane diretamente...');
      execSync(`fastlane android promote_to_production client:${clientCode} version_code:${versionCode}`, {
        cwd: fastlanePath,
        stdio: 'inherit',
        env: { ...process.env },
      });
    }
  }

  /**
   * Upload to stores and submit for review
   */
  async uploadAndSubmit() {
    logger.section('Fase 5: Upload & Submit');

    const platforms = [];

    // Upload Android
    if (this.deployTargets.android) {
      if (this.deployTargets.android === 'promote_existing') {
        // Promote existing build from Internal Testing to Production
        this.promoteAndroidBuildToProduction(this.clientCode, this.promoteAndroidBuild);
        platforms.push('android');
      } else {
        const androidLabel =
          this.deployTargets.android === 'internal' ? 'Teste Interno' : 'Producao';
        logger.info(`Enviando para Google Play (${androidLabel})...`);
        this.deployAndroid(this.clientCode, this.deployTargets.android);
        platforms.push('android');
      }
    }

    // Upload iOS
    if (this.deployTargets.ios) {
      if (this.deployTargets.ios === 'submit_existing') {
        // Submit existing build from TestFlight
        this.submitExistingBuildToAppStore(this.clientCode, this.submitExistingBuild);
        platforms.push('ios');
      } else {
        const iosLabel = this.deployTargets.ios === 'testflight' ? 'TestFlight' : 'App Store';
        logger.info(`Enviando para ${iosLabel}...`);
        this.deployIos(this.clientCode, this.deployTargets.ios);
        platforms.push('ios');
      }
    }

    logger.success('Upload e submit concluidos');
    return platforms;
  }

  /**
   * Finalize deployment - create tag, update config, notify, update versionarte
   */
  async finalize(platforms) {
    logger.section('Fase 6: Finalizacao');

    // Load config if needed
    if (!this.config) {
      this.config = this.loadClientConfig();
    }

    // Create git tag
    const tagName = await this.createDeploymentTag(
      this.clientCode,
      this.version,
      this.buildNumber
    );

    // Update versionarte in Remote Config (only for production deploys)
    const isProductionDeploy =
      this.deployTargets.android === 'production' || this.deployTargets.ios === 'appstore';

    let versionarteUpdated = false;
    if (isProductionDeploy) {
      logger.info('Atualizando versionarte no Remote Config...');
      versionarteUpdated = await updateVersionarteAfterDeploy({
        clientCode: this.clientCode,
        config: this.config,
        version: this.version,
        platforms,
        disableMaintenance: true,
      });
    } else {
      logger.info('Versionarte nao atualizado (deploy apenas para teste)');
    }

    const duration = this.formatDuration(Date.now() - this.startTime);

    // Send notification
    await telegram.deploymentCompleted(
      this.config.clientName,
      this.version,
      this.buildNumber,
      platforms,
      tagName,
      duration
    );

    // Summary
    logger.blank();
    logger.summaryBox({
      Cliente: `${this.config.clientName} (${this.config.clientCode})`,
      Versao: `${this.version}+${this.buildNumber}`,
      'Git Tag': tagName,
      Plataformas: platforms.join(', '),
      Duracao: duration,
      Status: 'Submetido para revisao',
      Versionarte: versionarteUpdated ? 'Atualizado' : 'Nao atualizado',
    });

    return {
      success: true,
      clientCode: this.clientCode,
      version: this.version,
      buildNumber: this.buildNumber,
      gitTag: tagName,
      platforms,
      duration,
      versionarteUpdated,
    };
  }

  /**
   * Run simplified deployment for submitting existing iOS build
   * Skips version increment, screenshots generation, and build phases
   */
  async deployExistingBuild() {
    this.startTime = Date.now();

    try {
      logger.section('Submit Build Existente para App Store');
      logger.info(`Build number: ${this.submitExistingBuild}`);
      logger.blank();

      // Phase 1: Validation (simplified - just load config)
      logger.section('Fase 1: Validacao');
      this.runWhiteLabelSetup(this.clientCode, true);
      this.config = this.loadClientConfig();
      logger.info(`Cliente: ${this.config.clientName} (${this.config.clientCode})`);
      logger.info(`Bundle ID: ${this.config.bundleId}`);
      logger.success('Validacao concluida');

      // Get version info from pubspec (don't increment)
      const versionInfo = this.getVersionInfo();
      this.version = versionInfo.version;
      this.buildNumber = this.submitExistingBuild; // Use the existing build number

      // Phase 5: Upload & Submit (skip phases 2-4)
      const platforms = await this.uploadAndSubmit();

      // Simplified finalization (no git tag, no versionarte update)
      logger.section('Fase 6: Finalizacao');
      const duration = this.formatDuration(Date.now() - this.startTime);

      await telegram.deploymentCompleted(
        this.config.clientName,
        this.version,
        this.buildNumber,
        platforms,
        `(build existente #${this.submitExistingBuild})`,
        duration
      );

      logger.blank();
      logger.summaryBox({
        Cliente: `${this.config.clientName} (${this.config.clientCode})`,
        Versao: this.submitExistingVersion || `${this.version}+${this.buildNumber}`,
        Tipo: 'Submit build existente do TestFlight',
        Plataformas: platforms.join(', '),
        Duracao: duration,
        Status: 'Submetido para revisao',
      });

      return {
        success: true,
        clientCode: this.clientCode,
        version: this.version,
        buildNumber: this.buildNumber,
        platforms,
        duration,
        submitExistingBuild: true,
      };

    } catch (error) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      logger.error(`Submit falhou apos ${duration}`);
      logger.error(error.message);

      await telegram.error(this.clientCode, error.message, 'Submit Existing Build');

      throw error;
    }
  }

  /**
   * Run simplified deployment for promoting existing Android build
   * Skips version increment, screenshots generation, and build phases
   */
  async promoteExistingAndroidBuild() {
    this.startTime = Date.now();

    try {
      logger.section('Promover Build Existente para Production');
      logger.info(`Version code: ${this.promoteAndroidBuild}`);
      logger.blank();

      // Phase 1: Validation (simplified - just load config)
      logger.section('Fase 1: Validacao');
      this.runWhiteLabelSetup(this.clientCode, true);
      this.config = this.loadClientConfig();
      logger.info(`Cliente: ${this.config.clientName} (${this.config.clientCode})`);
      logger.info(`Bundle ID: ${this.config.bundleId}`);
      logger.success('Validacao concluida');

      // Get version info from pubspec (don't increment)
      const versionInfo = this.getVersionInfo();
      this.version = versionInfo.version;
      this.buildNumber = this.promoteAndroidBuild; // Use the existing version code

      // Phase 5: Upload & Submit (skip phases 2-4)
      const platforms = await this.uploadAndSubmit();

      // Simplified finalization (no git tag, no versionarte update)
      logger.section('Fase 6: Finalizacao');
      const duration = this.formatDuration(Date.now() - this.startTime);

      await telegram.deploymentCompleted(
        this.config.clientName,
        this.version,
        this.buildNumber,
        platforms,
        `(build existente #${this.promoteAndroidBuild})`,
        duration
      );

      logger.blank();
      logger.summaryBox({
        Cliente: `${this.config.clientName} (${this.config.clientCode})`,
        Versao: this.promoteAndroidVersion || `${this.version}+${this.buildNumber}`,
        Tipo: 'Promover build do Internal Testing para Production',
        Plataformas: platforms.join(', '),
        Duracao: duration,
        Status: 'Promovido para Production',
      });

      return {
        success: true,
        clientCode: this.clientCode,
        version: this.version,
        buildNumber: this.buildNumber,
        platforms,
        duration,
        promoteExistingBuild: true,
      };

    } catch (error) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      logger.error(`Promocao falhou apos ${duration}`);
      logger.error(error.message);

      await telegram.error(this.clientCode, error.message, 'Promote Existing Build');

      throw error;
    }
  }

  /**
   * Run complete deployment pipeline
   */
  async deploy() {
    // Use simplified flow for submitting existing iOS build
    if (this.deployTargets.ios === 'submit_existing') {
      return this.deployExistingBuild();
    }

    // Use simplified flow for promoting existing Android build
    if (this.deployTargets.android === 'promote_existing') {
      return this.promoteExistingAndroidBuild();
    }

    this.startTime = Date.now();

    try {
      // Notify start with selected platforms
      const platformsToNotify = [];
      if (this.deployTargets.android) platformsToNotify.push('android');
      if (this.deployTargets.ios) platformsToNotify.push('ios');
      await telegram.buildStarted(this.clientCode, platformsToNotify);

      // Phase 1: Validation
      await this.validatePrerequisites();

      // Phase 2: Setup
      await this.setupEnvironment();

      // Phase 3: Screenshots
      await this.generateScreenshots();

      // Phase 4: Build
      await this.buildApps();

      // Phase 5: Upload & Submit
      const platforms = await this.uploadAndSubmit();

      // Phase 6: Finalize
      return await this.finalize(platforms);

    } catch (error) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      logger.error(`Deploy falhou apos ${duration}`);
      logger.error(error.message);

      await telegram.error(this.clientCode, error.message, 'Deploy');

      throw error;
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    logger.section('Deploy para Stores');
    logger.blank();

    // Parse arguments
    const args = process.argv.slice(2);
    let clientCode = args.find((arg) => arg.startsWith('--client='))?.split('=')[1];
    const versionArg = args.find((arg) => arg.startsWith('--version='))?.split('=')[1];
    const hasAddLogo = args.includes('--add-logo');
    const hasNoLogo = args.includes('--no-logo');

    // Determine logo option (undefined = ask interactively)
    let addLogoOption;
    if (hasAddLogo) {
      addLogoOption = true;
    } else if (hasNoLogo) {
      addLogoOption = false;
    }

    // Validate version format if provided
    if (versionArg) {
      const versionRegex = /^[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+$/;
      if (!versionRegex.test(versionArg)) {
        logger.error(`Formato de versao invalido: "${versionArg}"`);
        logger.error('Use o formato X.Y.Z+B (ex: 1.2.3+45)');
        process.exit(1);
      }
      logger.info(`Versao especificada via CLI: ${versionArg}`);
      logger.blank();
    }

    // If no client specified, prompt for selection
    if (!clientCode) {
      const clientFolders = clientSelector.listClients();

      if (clientFolders.length === 0) {
        logger.error('Nenhum cliente encontrado em clients/');
        process.exit(1);
      }

      // Load configs for each client folder
      const clients = clientFolders.map((folder) => {
        try {
          const config = clientSelector.loadClientConfig(folder);
          return {
            folder,
            clientName: config.clientName || folder,
            clientCode: config.clientCode || folder,
          };
        } catch {
          return { folder, clientName: folder, clientCode: folder };
        }
      });

      const { selectedClient } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedClient',
          message: 'Selecione o cliente para deploy:',
          choices: clients.map((c) => ({
            name: `${c.clientName} (${c.clientCode})`,
            value: c.clientCode,
          })),
        },
      ]);

      clientCode = selectedClient;
    }

    // Create deployer instance and prompt for deploy targets
    const deployer = new ClientDeployer(clientCode, { version: versionArg, addLogo: addLogoOption });
    await deployer.promptDeployTargets();

    // Check if any platform was selected
    if (!deployer.deployTargets.android && !deployer.deployTargets.ios) {
      logger.error('Nenhuma plataforma selecionada para deploy');
      process.exit(1);
    }

    // Build confirmation message with selected targets only
    const targetLines = [];
    if (deployer.deployTargets.android) {
      let androidLabel;
      if (deployer.deployTargets.android === 'promote_existing') {
        androidLabel = `Promover version code ${deployer.promoteAndroidBuild} do Internal Testing para Production`;
      } else {
        androidLabel = deployer.deployTargets.android === 'internal' ? 'Teste Interno' : 'Producao';
      }
      targetLines.push(`Android: ${androidLabel}`);
    }
    if (deployer.deployTargets.ios) {
      let iosLabel;
      if (deployer.deployTargets.ios === 'submit_existing') {
        iosLabel = `Submeter versao ${deployer.submitExistingVersion} do TestFlight para App Store`;
      } else {
        iosLabel = deployer.deployTargets.ios === 'testflight' ? 'TestFlight' : 'App Store';
      }
      targetLines.push(`iOS: ${iosLabel}`);
    }

    // Confirm deployment
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Iniciar deploy de "${clientCode}"?\n  ${targetLines.join('\n  ')}`,
        default: true,
      },
    ]);

    if (!confirm) {
      logger.info('Deploy cancelado');
      process.exit(0);
    }

    // Run deployment
    const result = await deployer.deploy();

    if (result.success) {
      logger.success('Deploy concluido com sucesso!');
      process.exit(0);
    } else {
      logger.error('Deploy falhou');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  }
}

module.exports = ClientDeployer;

if (require.main === module) {
  main();
}
