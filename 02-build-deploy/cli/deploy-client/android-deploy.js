/**
 * Android deployment module for deploy-client
 */

const { execSync } = require('child_process');
const logger = require('../../../shared/utils/logger');
const { FASTLANE_DIR } = require('../../../shared/utils/paths');

function fetchInternalTestingBuilds(config, getVersionInfo, runWhiteLabelSetup, clientCode) {
  const fastlanePath = FASTLANE_DIR;

  try {
    if (!config) {
      runWhiteLabelSetup(clientCode, true);
    }

    logger.info(`Buscando builds disponiveis no Internal Testing...`);

    const command = `fastlane run google_play_track_version_codes track:internal json_key:${process.env.GOOGLE_PLAY_JSON_KEY} package_name:${config.bundleId} 2>&1 || true`;

    const result = execSync(command, {
      cwd: fastlanePath,
      encoding: 'utf8',
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const builds = [];
    const versionCodeRegex = /\[([0-9,\s]+)\]/;
    const match = result.match(versionCodeRegex);

    if (match) {
      const versionCodes = match[1]
        .split(',')
        .map((v) => parseInt(v.trim(), 10))
        .filter((v) => !isNaN(v));
      for (const versionCode of versionCodes) {
        builds.push({
          version: 'N/A',
          versionCode: versionCode,
          status: versionCode === Math.max(...versionCodes) ? 'Latest' : 'Previous',
        });
      }
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

function promoteAndroidBuildToProduction(clientCode, versionCode) {
  const fastlanePath = FASTLANE_DIR;

  logger.info(`Promovendo build ${versionCode} do Internal Testing para Production...`);
  logger.info(`Diretorio: ${fastlanePath}`);

  const command = `bundle exec fastlane android promote_to_production client:${clientCode} version_code:${versionCode}`;

  try {
    execSync(command, {
      cwd: fastlanePath,
      stdio: 'inherit',
      env: { ...process.env },
    });
  } catch {
    logger.warn('bundle exec falhou, tentando fastlane diretamente...');
    execSync(
      `fastlane android promote_to_production client:${clientCode} version_code:${versionCode}`,
      {
        cwd: fastlanePath,
        stdio: 'inherit',
        env: { ...process.env },
      }
    );
  }
}

module.exports = {
  fetchInternalTestingBuilds,
  promoteAndroidBuildToProduction,
};
