/**
 * Deployment pipeline phases - separated from ClientDeployer for modularity
 */

const inquirer = require('inquirer');
const logger = require('../../../shared/utils/logger');
const telegram = require('../../../shared/utils/telegram');
const { ScreenshotGenerator, checkExistingScreenshots } = require('../generate-screenshots');
const { updateVersionarteAfterDeploy } = require('../../update-versionarte');
const { LOYALTY_APP_ROOT } = require('../../../shared/utils/paths');
const { hasGooglePlayConfigured, hasAppStoreConfigured } = require('./credentials');
const { promoteAndroidBuildToProduction } = require('./android-deploy');
const { submitExistingBuildToAppStore } = require('./ios-deploy');
const { promptVersionStrategy } = require('./prompts');

const REPO_PATH = LOYALTY_APP_ROOT;

async function validatePrerequisites(deployer) {
  logger.section('Fase 1: Validacao');

  deployer.runWhiteLabelSetup(deployer.clientCode, true);
  deployer.config = deployer.loadClientConfig();
  logger.info(`Cliente: ${deployer.config.clientName} (${deployer.config.clientCode})`);
  logger.info(`Bundle ID: ${deployer.config.bundleId}`);

  const hasGooglePlay = hasGooglePlayConfigured();
  const hasAppStore = hasAppStoreConfigured();

  if (!hasGooglePlay && !hasAppStore) {
    throw new Error(
      'Nenhuma credencial de store configurada. Configure GOOGLE_PLAY_JSON_KEY ou APP_STORE_CONNECT_API_*'
    );
  }

  logger.keyValue('Google Play', hasGooglePlay ? 'Configurado' : 'Nao configurado');
  logger.keyValue('App Store', hasAppStore ? 'Configurado' : 'Nao configurado');

  logger.success('Validacao concluida');
  return true;
}

async function setupEnvironment(deployer) {
  logger.section('Fase 2: Setup');

  if (!deployer.config) {
    deployer.config = deployer.loadClientConfig();
  }

  await deployer.ensureOnMainBranch();

  if (deployer.manualVersion) {
    deployer.setVersion(deployer.manualVersion);
  } else {
    const chosenVersion = await promptVersionStrategy(deployer.getVersionInfo.bind(deployer));
    if (chosenVersion) {
      deployer.setVersion(chosenVersion);
    } else {
      deployer.incrementBuildNumber();
    }
  }

  const versionInfo = deployer.getVersionInfo();
  deployer.version = versionInfo.version;
  deployer.buildNumber = versionInfo.buildNumber;

  logger.success(`Setup concluido - v${deployer.version}+${deployer.buildNumber}`);
  return true;
}

async function generateScreenshots(deployer) {
  logger.section('Fase 3: Screenshots');

  const needsScreenshots =
    deployer.deployTargets.ios === 'appstore' || deployer.deployTargets.android === 'production';

  if (!needsScreenshots) {
    logger.info('Screenshots pulados (destino e apenas TestFlight/Internal)');
    return true;
  }

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

  let addLogo = deployer.addLogo;
  if (deployer.options.addLogo === undefined) {
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

  const generator = new ScreenshotGenerator(deployer.clientCode, REPO_PATH);

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

async function buildApps(deployer) {
  logger.section('Fase 4: Build');

  const shouldBuildAndroid = deployer.deployTargets.android !== null;
  const shouldBuildIos = deployer.deployTargets.ios !== null && process.platform === 'darwin';

  if (shouldBuildAndroid) {
    logger.info('Compilando Android...');
    deployer.buildAndroid(deployer.clientCode);
  } else {
    logger.info('Build Android pulado (nenhum destino Android selecionado)');
  }

  if (shouldBuildIos) {
    logger.info('Compilando iOS...');
    deployer.buildIos(deployer.clientCode);
  } else if (deployer.deployTargets.ios !== null && process.platform !== 'darwin') {
    logger.warn('Build iOS ignorado (requer macOS)');
  } else {
    logger.info('Build iOS pulado (nenhum destino iOS selecionado)');
  }

  logger.success('Builds concluidos');
  return true;
}

async function uploadAndSubmit(deployer) {
  logger.section('Fase 5: Upload & Submit');

  const platforms = [];

  if (deployer.deployTargets.android) {
    if (deployer.deployTargets.android === 'promote_existing') {
      promoteAndroidBuildToProduction(deployer.clientCode, deployer.promoteAndroidBuild);
      platforms.push('android');
    } else {
      const androidLabel =
        deployer.deployTargets.android === 'internal' ? 'Teste Interno' : 'Producao';
      logger.info(`Enviando para Google Play (${androidLabel})...`);
      deployer.deployAndroid(deployer.clientCode, deployer.deployTargets.android);
      platforms.push('android');
    }
  }

  if (deployer.deployTargets.ios) {
    if (deployer.deployTargets.ios === 'submit_existing') {
      submitExistingBuildToAppStore(deployer.clientCode, deployer.submitExistingBuild);
      platforms.push('ios');
    } else {
      const iosLabel = deployer.deployTargets.ios === 'testflight' ? 'TestFlight' : 'App Store';
      logger.info(`Enviando para ${iosLabel}...`);
      deployer.deployIos(deployer.clientCode, deployer.deployTargets.ios);
      platforms.push('ios');
    }
  }

  logger.success('Upload e submit concluidos');
  return platforms;
}

async function finalize(deployer, platforms) {
  logger.section('Fase 6: Finalizacao');

  if (!deployer.config) {
    deployer.config = deployer.loadClientConfig();
  }

  const tagName = await deployer.createDeploymentTag(
    deployer.clientCode,
    deployer.version,
    deployer.buildNumber
  );

  const isProductionDeploy =
    deployer.deployTargets.android === 'production' || deployer.deployTargets.ios === 'appstore';

  let versionarteUpdated = false;
  if (isProductionDeploy) {
    logger.info('Atualizando versionarte no App Config...');
    versionarteUpdated = await updateVersionarteAfterDeploy({
      clientCode: deployer.clientCode,
      config: deployer.config,
      version: deployer.version,
      platforms,
      disableMaintenance: true,
    });
  } else {
    logger.info('Versionarte nao atualizado (deploy apenas para teste)');
  }

  const duration = deployer.formatDuration(Date.now() - deployer.startTime);

  await telegram.deploymentCompleted(
    deployer.config.clientName,
    deployer.version,
    deployer.buildNumber,
    platforms,
    tagName,
    duration
  );

  logger.blank();
  logger.summaryBox({
    Cliente: `${deployer.config.clientName} (${deployer.config.clientCode})`,
    Versao: `${deployer.version}+${deployer.buildNumber}`,
    'Git Tag': tagName,
    Plataformas: platforms.join(', '),
    Duracao: duration,
    Status: 'Submetido para revisao',
    Versionarte: versionarteUpdated ? 'Atualizado' : 'Nao atualizado',
  });

  return {
    success: true,
    clientCode: deployer.clientCode,
    version: deployer.version,
    buildNumber: deployer.buildNumber,
    gitTag: tagName,
    platforms,
    duration,
    versionarteUpdated,
  };
}

module.exports = {
  validatePrerequisites,
  setupEnvironment,
  generateScreenshots,
  buildApps,
  uploadAndSubmit,
  finalize,
};
