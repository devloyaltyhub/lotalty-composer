/**
 * Shorebird command handlers
 * Implements release, patch, console, and doctor commands
 */

const { exec } = require('child_process');
const { log } = require('./log-utils');
const { runShorebird } = require('./shorebird-runner');
const { getCurrentVersion, incrementVersion } = require('./version-utils');
const { createPrompt, ask, getPlatform } = require('./prompt-utils');

/**
 * Create a new Shorebird release
 */
async function createRelease() {
  log.title('Criar Release Shorebird');

  log.info(
    'Um release é necessário para submissão na store (Play Store / App Store)'
  );
  log.info('Após o release ser aprovado, você pode criar patches OTA');
  console.log('');

  const currentVersion = getCurrentVersion();
  log.info(`Versão atual: ${currentVersion}`);

  const { oldVersion, newVersion } = incrementVersion('build');
  log.success(`Versão incrementada: ${oldVersion} -> ${newVersion}`);
  console.log('');

  const platform = await getPlatform();
  if (!platform) {
    log.error('Plataforma inválida');
    return;
  }

  if (platform === 'both') {
    log.info('Criando release para Android...');
    await runShorebird(['release', 'android']);

    log.info('Criando release para iOS...');
    await runShorebird(['release', 'ios']);
  } else {
    await runShorebird(['release', platform]);
  }

  log.success(`Release ${newVersion} criado com sucesso!`);
  log.info('Próximo passo: Submeta para a store e aguarde aprovação');
}

/**
 * Create a new Shorebird patch
 */
async function createPatch() {
  log.title('Criar Patch Shorebird');

  log.info('Um patch é uma atualização OTA que não passa pela store');
  log.info('Os usuários recebem automaticamente na próxima abertura do app');
  log.info('Nota: O patch é aplicado sobre um RELEASE existente');
  console.log('');

  const currentVersion = getCurrentVersion();
  if (currentVersion) {
    log.info(`Versão atual no pubspec.yaml: ${currentVersion}`);
    log.warn(
      'O patch deve ser para uma versão que já foi submetida como release!'
    );
  }

  log.info('Dica: Veja seus releases em https://console.shorebird.dev');
  console.log('');
  const rl = createPrompt();

  const defaultVersion = currentVersion || '';
  const releaseVersion = await ask(
    rl,
    `Versão do release existente para aplicar o patch [${defaultVersion}]: `
  );

  const version = releaseVersion || defaultVersion;

  if (!version) {
    log.error('Versão do release é obrigatória');
    rl.close();
    return;
  }

  rl.close();

  const platform = await getPlatform();

  if (!platform) {
    log.error('Plataforma inválida');
    return;
  }

  if (platform === 'both') {
    log.info('Criando patch para Android...');
    await runShorebird([
      'patch',
      'android',
      `--release-version=${version}`,
    ]);

    log.info('Criando patch para iOS...');
    await runShorebird([
      'patch',
      'ios',
      `--release-version=${version}`,
    ]);
  } else {
    await runShorebird([
      'patch',
      platform,
      `--release-version=${version}`,
    ]);
  }

  log.success('Patch criado com sucesso!');
  log.info('Os usuários receberão a atualização na próxima abertura do app');
  log.info(
    'O número do patch é incrementado automaticamente pelo Shorebird (patch 1, 2, 3...)'
  );
}

/**
 * Open Shorebird Console in browser
 */
async function openConsole() {
  log.title('Console Shorebird');
  log.info(
    'O Console Shorebird permite visualizar releases, patches e métricas'
  );
  console.log('');

  const url = 'https://console.shorebird.dev';

  exec(`open "${url}"`, (error) => {
    if (error) {
      log.info(`Abra manualmente: ${url}`);
    } else {
      log.success(`Abrindo ${url} no navegador...`);
    }
  });
}

/**
 * Run shorebird doctor
 */
async function runDoctor() {
  log.title('Shorebird Doctor');
  await runShorebird(['doctor', '--verbose']);
}

/**
 * Show help message
 */
function showHelp() {
  console.log('');
  console.log('Uso: node shorebird.js [comando]');
  console.log('');
  console.log('Comandos:');
  console.log('  release       Criar novo release para submissão na store');
  console.log(
    '  patch         Criar patch OTA (correção sem passar pela store)'
  );
  console.log('  console       Abrir Console Shorebird no navegador');
  console.log('  doctor        Verificar instalação do Shorebird');
  console.log('  help          Mostrar esta ajuda');
  console.log('');
}

module.exports = {
  createRelease,
  createPatch,
  openConsole,
  runDoctor,
  showHelp,
};
