/**
 * iOS deployment module for deploy-client
 */

const { execSync } = require('child_process');
const logger = require('../../../shared/utils/logger');
const { FASTLANE_DIR } = require('../../../shared/utils/paths');

function fetchTestFlightBuilds(config, getVersionInfo, runWhiteLabelSetup, clientCode) {
  const fastlanePath = FASTLANE_DIR;

  try {
    if (!config) {
      runWhiteLabelSetup(clientCode, true);
    }
    const bundleId = config.bundleId;

    logger.info(`Buscando builds disponiveis no TestFlight para ${bundleId}...`);

    const latestBuildCmd = `fastlane ios get_testflight_builds app_identifier:${bundleId} 2>&1 || true`;

    const result = execSync(latestBuildCmd, {
      cwd: fastlanePath,
      encoding: 'utf8',
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

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

    if (builds.length === 0) {
      const versionInfo = getVersionInfo();
      for (
        let i = parseInt(versionInfo.buildNumber, 10);
        i >= 1 && i > parseInt(versionInfo.buildNumber, 10) - 5;
        i--
      ) {
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

function submitExistingBuildToAppStore(clientCode, buildNumber) {
  const fastlanePath = FASTLANE_DIR;

  logger.info(`Submetendo build ${buildNumber} do TestFlight para App Store...`);
  logger.info(`Diretorio: ${fastlanePath}`);

  const command = `bundle exec fastlane ios submit_existing_build client:${clientCode} build_number:${buildNumber}`;

  try {
    execSync(command, {
      cwd: fastlanePath,
      stdio: 'inherit',
      env: { ...process.env },
    });
  } catch {
    logger.warn('bundle exec falhou, tentando fastlane diretamente...');
    execSync(
      `fastlane ios submit_existing_build client:${clientCode} build_number:${buildNumber}`,
      {
        cwd: fastlanePath,
        stdio: 'inherit',
        env: { ...process.env },
      }
    );
  }
}

module.exports = {
  fetchTestFlightBuilds,
  submitExistingBuildToAppStore,
};
