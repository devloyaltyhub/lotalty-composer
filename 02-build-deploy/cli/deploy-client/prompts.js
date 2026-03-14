/**
 * Interactive prompts for deploy-client
 */

const inquirer = require('inquirer');
const logger = require('../../../shared/utils/logger');
const { checkGooglePlayCredentials, checkAppStoreCredentials } = require('./credentials');
const { fetchInternalTestingBuilds } = require('./android-deploy');
const { fetchTestFlightBuilds } = require('./ios-deploy');

async function promptDeployTargets(deployer) {
  const googlePlayStatus = checkGooglePlayCredentials();
  const appStoreStatus = checkAppStoreCredentials();
  const isMac = process.platform === 'darwin';

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

  if (!googlePlayStatus.configured) {
    logger.warn(`Google Play: ${googlePlayStatus.reason}`);
  }
  if (!isMac) {
    logger.warn('iOS requer macOS - opção não disponível');
  } else if (!appStoreStatus.configured) {
    logger.warn(`App Store: ${appStoreStatus.reason}`);
  }
  logger.blank();

  const { platform } = await inquirer.prompt([
    {
      type: 'list',
      name: 'platform',
      message: 'Qual plataforma deseja fazer deploy?',
      choices: platformChoices,
    },
  ]);

  if (platform === 'android_promote_existing') {
    return await handleAndroidPromoteExisting(deployer);
  }

  if (platform === 'ios_submit_existing') {
    return await handleIosSubmitExisting(deployer);
  }

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

  const includeAndroid = platform === 'both' || platform === 'android';
  const includeIos = (platform === 'both' || platform === 'ios') && isMac;

  if (includeAndroid) {
    deployer.deployTargets.android = environment === 'test' ? 'internal' : 'production';
  }

  if (includeIos) {
    deployer.deployTargets.ios = environment === 'test' ? 'testflight' : 'appstore';
  }

  return deployer.deployTargets;
}

async function handleAndroidPromoteExisting(deployer) {
  const availableBuilds = fetchInternalTestingBuilds(
    deployer.config,
    deployer.getVersionInfo.bind(deployer),
    deployer.runWhiteLabelSetup.bind(deployer),
    deployer.clientCode
  );

  let versionCode;
  let versionString;

  if (availableBuilds && availableBuilds.length > 0) {
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
    versionString =
      selectedInfo?.version !== 'N/A' ? `${selectedInfo.version}+${versionCode}` : `+${versionCode}`;
  } else {
    logger.warn('Não foi possível obter lista de builds do Internal Testing');
    const { manualVersionCode } = await inquirer.prompt([
      {
        type: 'input',
        name: 'manualVersionCode',
        message: 'Digite o version code da build (ex: 5):',
        validate: (input) => {
          const versionCodeInt = parseInt(input, 10);
          if (isNaN(versionCodeInt) || versionCodeInt <= 0) {
            return 'Version code deve ser um número inteiro positivo';
          }
          return true;
        },
      },
    ]);
    versionCode = parseInt(manualVersionCode, 10);
    versionString = `+${versionCode}`;
  }

  deployer.promoteAndroidBuild = versionCode;
  deployer.promoteAndroidVersion = versionString;
  deployer.deployTargets.android = 'promote_existing';
  return deployer.deployTargets;
}

async function handleIosSubmitExisting(deployer) {
  const availableBuilds = fetchTestFlightBuilds(
    deployer.config,
    deployer.getVersionInfo.bind(deployer),
    deployer.runWhiteLabelSetup.bind(deployer),
    deployer.clientCode
  );

  let versionString;

  if (availableBuilds && availableBuilds.length > 0) {
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
    logger.warn('Não foi possível obter lista de builds do TestFlight');
    const { manualVersion } = await inquirer.prompt([
      {
        type: 'input',
        name: 'manualVersion',
        message: 'Digite a versão do TestFlight (ex: 0.0.3+5):',
        validate: (input) => {
          const versionRegex = /^[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+$/;
          if (!versionRegex.test(input)) {
            return 'Formato inválido. Use X.Y.Z+B (ex: 0.0.3+5)';
          }
          return true;
        },
      },
    ]);
    versionString = manualVersion;
  }

  const buildNumber = parseInt(versionString.split('+')[1], 10);
  deployer.submitExistingBuild = buildNumber;
  deployer.submitExistingVersion = versionString;
  deployer.deployTargets.ios = 'submit_existing';
  return deployer.deployTargets;
}

async function promptVersionStrategy(getVersionInfo) {
  const currentVersionInfo = getVersionInfo();
  const currentVersion = `${currentVersionInfo.version}+${currentVersionInfo.buildNumber}`;

  const nextBuild = parseInt(currentVersionInfo.buildNumber, 10) + 1;
  const autoIncrementVersion = `${currentVersionInfo.version}+${nextBuild}`;

  logger.info(`Versão atual: ${currentVersion}`);
  logger.blank();

  const { versionChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'versionChoice',
      message: 'Como deseja definir a versão?',
      choices: [
        {
          name: `Incrementar automaticamente (${currentVersion} → ${autoIncrementVersion})`,
          value: 'auto',
        },
        {
          name: 'Definir versão manualmente',
          value: 'manual',
        },
      ],
    },
  ]);

  if (versionChoice === 'auto') {
    return null;
  }

  const { manualVersion } = await inquirer.prompt([
    {
      type: 'input',
      name: 'manualVersion',
      message: 'Digite a versão (formato X.Y.Z+B, ex: 1.2.3+45):',
      validate: (input) => {
        const versionRegex = /^[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+$/;
        if (!versionRegex.test(input)) {
          return 'Formato inválido. Use X.Y.Z+B (ex: 1.2.3+45)';
        }
        return true;
      },
    },
  ]);

  return manualVersion;
}

module.exports = {
  promptDeployTargets,
  promptVersionStrategy,
};
