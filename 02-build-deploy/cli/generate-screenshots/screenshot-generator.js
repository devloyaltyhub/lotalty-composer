/**
 * Screenshot Generator Class
 *
 * Handles the core screenshot generation logic including:
 * - Loading client configuration
 * - Running Python screenshot pipeline
 * - Copying screenshots to metadata folders
 */

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const { COMPOSE_ROOT, LOYALTY_APP_ROOT } = require('../../../shared/utils/paths');
const logger = require('../../../shared/utils/logger');
const { ScreenshotMetadataCopier, IOS_DEVICES } = require('../../utils/screenshot-metadata-copier');

const SCREENSHOTS_DIR = path.join(COMPOSE_ROOT, '02-build-deploy', 'screenshots');

class ScreenshotGenerator {
  constructor(clientCode, repoPath = LOYALTY_APP_ROOT) {
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
      deviceChoice = 1,
      gradientChoice = 0,
      angleChoice = 2,
      addLogo = true,
    } = options;

    const pipelineScript = path.join(SCREENSHOTS_DIR, 'main.py');

    if (!fs.existsSync(pipelineScript)) {
      throw new Error(`Pipeline script nao encontrado: ${pipelineScript}`);
    }

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

      if (!this.checkPythonDependencies()) {
        return { success: false, error: 'Missing Python dependencies' };
      }

      await this.runScreenshotPipeline(options);

      const copyResults = this.copyToMetadata();

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

module.exports = ScreenshotGenerator;
