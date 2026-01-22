#!/usr/bin/env node

/**
 * Deploy Client CLI
 *
 * Complete deployment orchestrator for white-label loyalty apps.
 * Handles the full pipeline: screenshots -> build -> upload -> submit.
 *
 * Usage:
 *   node deploy-client.js
 *   node deploy-client.js --client=demo
 *   node deploy-client.js --client=demo --version=1.2.3+45
 *   node deploy-client.js --client=demo --add-logo
 *   node deploy-client.js --client=demo --no-logo
 */

const inquirer = require('inquirer');
const { loadEnvWithExpansion } = require('../../01-client-setup/shared/env-loader');

loadEnvWithExpansion(__dirname);

const logger = require('../../shared/utils/logger');
const clientSelector = require('../../shared/utils/client-selector');
const { ClientDeployer } = require('./deploy-client/index');

function parseArguments() {
  const args = process.argv.slice(2);
  const clientCode = args.find((arg) => arg.startsWith('--client='))?.split('=')[1];
  const versionArg = args.find((arg) => arg.startsWith('--version='))?.split('=')[1];
  const hasAddLogo = args.includes('--add-logo');
  const hasNoLogo = args.includes('--no-logo');

  let addLogoOption;
  if (hasAddLogo) {
    addLogoOption = true;
  } else if (hasNoLogo) {
    addLogoOption = false;
  }

  return { clientCode, versionArg, addLogoOption };
}

function validateVersionFormat(versionArg) {
  if (!versionArg) return true;

  const versionRegex = /^[0-9]+\.[0-9]+\.[0-9]+\+[0-9]+$/;
  if (!versionRegex.test(versionArg)) {
    logger.error(`Formato de versao invalido: "${versionArg}"`);
    logger.error('Use o formato X.Y.Z+B (ex: 1.2.3+45)');
    return false;
  }

  logger.info(`Versao especificada via CLI: ${versionArg}`);
  logger.blank();
  return true;
}

async function selectClient() {
  const clientFolders = clientSelector.listClients();

  if (clientFolders.length === 0) {
    logger.error('Nenhum cliente encontrado em clients/');
    return null;
  }

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

  return selectedClient;
}

function buildTargetLines(deployer) {
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

  return targetLines;
}

async function confirmDeployment(clientCode, targetLines) {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Iniciar deploy de "${clientCode}"?\n  ${targetLines.join('\n  ')}`,
      default: true,
    },
  ]);

  return confirm;
}

async function main() {
  try {
    logger.section('Deploy para Stores');
    logger.blank();

    const { clientCode: argClientCode, versionArg, addLogoOption } = parseArguments();

    if (!validateVersionFormat(versionArg)) {
      process.exit(1);
    }

    let clientCode = argClientCode;
    if (!clientCode) {
      clientCode = await selectClient();
      if (!clientCode) {
        process.exit(1);
      }
    }

    const deployer = new ClientDeployer(clientCode, {
      version: versionArg,
      addLogo: addLogoOption,
    });
    await deployer.promptDeployTargets();

    if (!deployer.deployTargets.android && !deployer.deployTargets.ios) {
      logger.error('Nenhuma plataforma selecionada para deploy');
      process.exit(1);
    }

    const targetLines = buildTargetLines(deployer);
    const confirmed = await confirmDeployment(clientCode, targetLines);

    if (!confirmed) {
      logger.info('Deploy cancelado');
      process.exit(0);
    }

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

module.exports = { ClientDeployer };

if (require.main === module) {
  main();
}
