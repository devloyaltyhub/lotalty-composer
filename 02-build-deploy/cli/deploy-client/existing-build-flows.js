/**
 * Flows for deploying existing builds (iOS submit, Android promote)
 */

const logger = require('../../../shared/utils/logger');
const telegram = require('../../../shared/utils/telegram');
const { uploadAndSubmit } = require('./pipeline-phases');

async function deployExistingBuild(deployer) {
  deployer.startTime = Date.now();

  try {
    logger.section('Submit Build Existente para App Store');
    logger.info(`Build number: ${deployer.submitExistingBuild}`);
    logger.blank();

    logger.section('Fase 1: Validacao');
    deployer.runWhiteLabelSetup(deployer.clientCode, true);
    deployer.config = deployer.loadClientConfig();
    logger.info(`Cliente: ${deployer.config.clientName} (${deployer.config.clientCode})`);
    logger.info(`Bundle ID: ${deployer.config.bundleId}`);
    logger.success('Validacao concluida');

    const versionInfo = deployer.getVersionInfo();
    deployer.version = versionInfo.version;
    deployer.buildNumber = deployer.submitExistingBuild;

    const platforms = await uploadAndSubmit(deployer);

    logger.section('Fase 6: Finalizacao');
    const duration = deployer.formatDuration(Date.now() - deployer.startTime);

    await telegram.deploymentCompleted(
      deployer.config.clientName,
      deployer.version,
      deployer.buildNumber,
      platforms,
      `(build existente #${deployer.submitExistingBuild})`,
      duration
    );

    logger.blank();
    logger.summaryBox({
      Cliente: `${deployer.config.clientName} (${deployer.config.clientCode})`,
      Versao: deployer.submitExistingVersion || `${deployer.version}+${deployer.buildNumber}`,
      Tipo: 'Submit build existente do TestFlight',
      Plataformas: platforms.join(', '),
      Duracao: duration,
      Status: 'Submetido para revisao',
    });

    return {
      success: true,
      clientCode: deployer.clientCode,
      version: deployer.version,
      buildNumber: deployer.buildNumber,
      platforms,
      duration,
      submitExistingBuild: true,
    };
  } catch (error) {
    const duration = deployer.formatDuration(Date.now() - deployer.startTime);
    logger.error(`Submit falhou apos ${duration}`);
    logger.error(error.message);

    await telegram.error(deployer.clientCode, error.message, 'Submit Existing Build');

    throw error;
  }
}

async function promoteExistingAndroidBuild(deployer) {
  deployer.startTime = Date.now();

  try {
    logger.section('Promover Build Existente para Production');
    logger.info(`Version code: ${deployer.promoteAndroidBuild}`);
    logger.blank();

    logger.section('Fase 1: Validacao');
    deployer.runWhiteLabelSetup(deployer.clientCode, true);
    deployer.config = deployer.loadClientConfig();
    logger.info(`Cliente: ${deployer.config.clientName} (${deployer.config.clientCode})`);
    logger.info(`Bundle ID: ${deployer.config.bundleId}`);
    logger.success('Validacao concluida');

    const versionInfo = deployer.getVersionInfo();
    deployer.version = versionInfo.version;
    deployer.buildNumber = deployer.promoteAndroidBuild;

    const platforms = await uploadAndSubmit(deployer);

    logger.section('Fase 6: Finalizacao');
    const duration = deployer.formatDuration(Date.now() - deployer.startTime);

    await telegram.deploymentCompleted(
      deployer.config.clientName,
      deployer.version,
      deployer.buildNumber,
      platforms,
      `(build existente #${deployer.promoteAndroidBuild})`,
      duration
    );

    logger.blank();
    logger.summaryBox({
      Cliente: `${deployer.config.clientName} (${deployer.config.clientCode})`,
      Versao: deployer.promoteAndroidVersion || `${deployer.version}+${deployer.buildNumber}`,
      Tipo: 'Promover build do Internal Testing para Production',
      Plataformas: platforms.join(', '),
      Duracao: duration,
      Status: 'Promovido para Production',
    });

    return {
      success: true,
      clientCode: deployer.clientCode,
      version: deployer.version,
      buildNumber: deployer.buildNumber,
      platforms,
      duration,
      promoteExistingBuild: true,
    };
  } catch (error) {
    const duration = deployer.formatDuration(Date.now() - deployer.startTime);
    logger.error(`Promocao falhou apos ${duration}`);
    logger.error(error.message);

    await telegram.error(deployer.clientCode, error.message, 'Promote Existing Build');

    throw error;
  }
}

module.exports = {
  deployExistingBuild,
  promoteExistingAndroidBuild,
};
