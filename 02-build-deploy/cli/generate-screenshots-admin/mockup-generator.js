const fs = require('fs');
const { execSync } = require('child_process');
const logger = require('../../../shared/utils/logger');

class MockupGenerator {
  constructor(adminRoot, screenshotsDir, composeRoot, pythonPipeline) {
    this.adminRoot = adminRoot;
    this.screenshotsDir = screenshotsDir;
    this.composeRoot = composeRoot;
    this.pythonPipeline = pythonPipeline;
  }

  exec(command, options = {}) {
    try {
      return execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: options.cwd || this.adminRoot,
        ...options,
      }).trim();
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

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

  generateMockups() {
    logger.section('Gerando Mockups');

    if (!fs.existsSync(this.pythonPipeline)) {
      throw new Error(`Python pipeline nao encontrado: ${this.pythonPipeline}`);
    }

    const screenshots = fs.readdirSync(this.screenshotsDir).filter((f) => f.endsWith('.png'));

    if (screenshots.length === 0) {
      throw new Error('Nenhum screenshot encontrado para gerar mockups');
    }

    logger.info(`Screenshots encontrados: ${screenshots.length}`);
    logger.blank();

    logger.startSpinner('Gerando mockups com Python pipeline...');

    try {
      this.exec(
        `python3 ${this.pythonPipeline} -p admin mockups \
          --device-choice 1 \
          --gradient-choice 0 \
          --no-logo \
          --gplay-only`,
        { cwd: this.composeRoot }
      );

      logger.succeedSpinner('Mockups gerados com sucesso');
      return true;
    } catch (error) {
      logger.failSpinner('Geracao de mockups falhou');
      throw error;
    }
  }
}

module.exports = MockupGenerator;
