#!/usr/bin/env node
/**
 * Shorebird OTA Updates CLI - Driver App
 *
 * Manage Shorebird releases and patches for the loyalty-driver app.
 * Same interface as shorebird.js but targeting loyalty-driver instead of white_label_app.
 *
 * Usage:
 *   node shorebird-driver.js              # Interactive menu
 *   node shorebird-driver.js release      # Create new release
 *   node shorebird-driver.js patch        # Create OTA patch
 */

const { spawn, execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { LOYALTY_DRIVER_ROOT } = require('../../shared/utils/paths');
const { log } = require('./shorebird/log-utils');

const PUBSPEC_PATH = path.join(LOYALTY_DRIVER_ROOT, 'pubspec.yaml');
const SHOREBIRD_YAML = path.join(LOYALTY_DRIVER_ROOT, 'shorebird.yaml');

// ─── Prerequisites ───────────────────────────────────────────────────────────

function isShorebirdInstalled() {
  try {
    execSync('which shorebird', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isShorebirdConfigured() {
  if (!fs.existsSync(SHOREBIRD_YAML)) {
    return { configured: false, reason: 'shorebird.yaml nao encontrado em loyalty-driver' };
  }

  const content = fs.readFileSync(SHOREBIRD_YAML, 'utf8');
  if (content.includes('placeholder-')) {
    return {
      configured: false,
      reason: 'app_id e placeholder (execute: cd loyalty-driver && shorebird init --force)',
    };
  }

  return { configured: true };
}

function checkPrerequisites() {
  if (!isShorebirdInstalled()) {
    log.error('Shorebird CLI nao esta instalado');
    log.info('Instale com:');
    console.log(
      '  curl --proto "=https" --tlsv1.2 https://raw.githubusercontent.com/shorebirdtech/install/main/install.sh -sSf | bash',
    );
    process.exit(1);
  }

  const configCheck = isShorebirdConfigured();
  if (!configCheck.configured) {
    log.error(`Shorebird nao esta configurado: ${configCheck.reason}`);
    process.exit(1);
  }
}

// ─── Version utils ───────────────────────────────────────────────────────────

function getCurrentVersion() {
  const content = fs.readFileSync(PUBSPEC_PATH, 'utf8');
  const match = content.match(/^version:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

function incrementVersion(bumpType = 'build') {
  let pubspec = fs.readFileSync(PUBSPEC_PATH, 'utf8');
  const versionRegex = /^version:\s*([0-9]+)\.([0-9]+)\.([0-9]+)\+([0-9]+)/m;
  const match = pubspec.match(versionRegex);

  if (!match) {
    throw new Error('Versao nao encontrada no pubspec.yaml do driver');
  }

  let [, major, minor, patch, build] = match.map((v, i) => (i > 0 ? parseInt(v, 10) : v));
  const oldVersion = `${major}.${minor}.${patch}+${build}`;

  switch (bumpType) {
    case 'major':
      major++;
      minor = 0;
      patch = 0;
      build = 1;
      break;
    case 'minor':
      minor++;
      patch = 0;
      build = 1;
      break;
    case 'patch':
      patch++;
      build = 1;
      break;
    case 'build':
    default:
      build++;
      break;
  }

  const newVersion = `${major}.${minor}.${patch}+${build}`;
  pubspec = pubspec.replace(versionRegex, `version: ${newVersion}`);
  fs.writeFileSync(PUBSPEC_PATH, pubspec, 'utf8');

  return { oldVersion, newVersion };
}

// ─── Shorebird runner ────────────────────────────────────────────────────────

function runShorebird(args) {
  return new Promise((resolve, reject) => {
    log.info(`Executando: shorebird ${args.join(' ')}`);
    console.log('');

    const proc = spawn('shorebird', args, {
      cwd: LOYALTY_DRIVER_ROOT,
      stdio: 'inherit',
      env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Shorebird exited with code ${code}`));
    });

    proc.on('error', reject);
  });
}

// ─── Prompt helpers ──────────────────────────────────────────────────────────

function createPrompt() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function getPlatform() {
  const rl = createPrompt();
  console.log('');
  console.log('  1. Android');
  console.log('  2. iOS');
  console.log('  3. Ambos');
  console.log('');
  const choice = await ask(rl, 'Plataforma: ');
  rl.close();

  switch (choice) {
    case '1':
      return 'android';
    case '2':
      return 'ios';
    case '3':
      return 'both';
    default:
      return null;
  }
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function createRelease() {
  log.title('Criar Release Shorebird (Driver)');
  log.info('Um release e necessario para submissao na store');
  log.info('Apos o release ser aprovado, voce pode criar patches OTA');
  console.log('');

  const currentVersion = getCurrentVersion();
  log.info(`Versao atual: ${currentVersion}`);

  const { oldVersion, newVersion } = incrementVersion('build');
  log.success(`Versao incrementada: ${oldVersion} -> ${newVersion}`);
  console.log('');

  const platform = await getPlatform();
  if (!platform) {
    log.error('Plataforma invalida');
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
  log.info('Proximo passo: Submeta para a store e aguarde aprovacao');
}

async function createPatch() {
  log.title('Criar Patch Shorebird (Driver)');
  log.info('Um patch e uma atualizacao OTA que nao passa pela store');
  log.info('Os motoboys recebem automaticamente na proxima abertura do app');
  console.log('');

  const currentVersion = getCurrentVersion();
  if (currentVersion) {
    log.info(`Versao atual no pubspec.yaml: ${currentVersion}`);
    log.warn('O patch deve ser para uma versao que ja foi submetida como release!');
  }

  const rl = createPrompt();
  const defaultVersion = currentVersion || '';
  const releaseVersion = await ask(
    rl,
    `Versao do release existente para aplicar o patch [${defaultVersion}]: `,
  );
  const version = releaseVersion || defaultVersion;

  if (!version) {
    log.error('Versao do release e obrigatoria');
    rl.close();
    return;
  }

  rl.close();

  const platform = await getPlatform();
  if (!platform) {
    log.error('Plataforma invalida');
    return;
  }

  if (platform === 'both') {
    log.info('Criando patch para Android...');
    await runShorebird(['patch', 'android', `--release-version=${version}`]);
    log.info('Criando patch para iOS...');
    await runShorebird(['patch', 'ios', `--release-version=${version}`]);
  } else {
    await runShorebird(['patch', platform, `--release-version=${version}`]);
  }

  log.success('Patch criado com sucesso!');
  log.info('Os motoboys receberao a atualizacao na proxima abertura do app');
}

async function runDoctor() {
  log.title('Shorebird Doctor (Driver)');
  await runShorebird(['doctor', '--verbose']);
}

function openConsole() {
  log.title('Console Shorebird');
  const url = 'https://console.shorebird.dev';
  exec(`open "${url}"`, (error) => {
    if (error) log.info(`Abra manualmente: ${url}`);
    else log.success(`Abrindo ${url} no navegador...`);
  });
}

function showHelp() {
  console.log('');
  console.log('Uso: node shorebird-driver.js [comando]');
  console.log('');
  console.log('Comandos:');
  console.log('  release       Criar novo release para submissao na store');
  console.log('  patch         Criar patch OTA (correcao sem passar pela store)');
  console.log('  console       Abrir Console Shorebird no navegador');
  console.log('  doctor        Verificar instalacao do Shorebird');
  console.log('  help          Mostrar esta ajuda');
  console.log('');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function handleCommand(command) {
  switch (command) {
    case 'release':
      await createRelease();
      return true;
    case 'patch':
      await createPatch();
      return true;
    case 'console':
      openConsole();
      return true;
    case 'doctor':
      await runDoctor();
      return true;
    case 'help':
      showHelp();
      return true;
    default:
      return false;
  }
}

async function runInteractiveMenu() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rl = createPrompt();

    console.log('');
    log.title('Shorebird OTA - Driver App');

    const currentVersion = getCurrentVersion();
    if (currentVersion) log.info(`Versao atual: ${currentVersion}`);

    console.log('');
    console.log('  1. Criar Release (para submissao na store)');
    console.log('  2. Criar Patch (correcao OTA sem passar pela store)');
    console.log('  3. Abrir Console Shorebird');
    console.log('  4. Verificar Instalacao (shorebird doctor)');
    console.log('  0. Sair');
    console.log('');

    const choice = await ask(rl, 'Escolha uma opcao: ');
    rl.close();

    try {
      switch (choice) {
        case '1':
          await createRelease();
          break;
        case '2':
          await createPatch();
          break;
        case '3':
          openConsole();
          break;
        case '4':
          await runDoctor();
          break;
        case '0':
          log.info('Ate mais!');
          process.exit(0);
          break;
        default:
          log.warn('Opcao invalida');
      }
    } catch (error) {
      log.error(`Erro: ${error.message}`);
    }

    console.log('');
    const rl2 = createPrompt();
    await ask(rl2, 'Pressione Enter para continuar...');
    rl2.close();
  }
}

async function main() {
  checkPrerequisites();

  const args = process.argv.slice(2);
  const command = args[0];

  if (command) {
    const handled = await handleCommand(command);
    if (!handled) {
      log.error(`Comando desconhecido: ${command}`);
      process.exit(1);
    }
    return;
  }

  await runInteractiveMenu();
}

if (require.main === module) {
  main().catch((error) => {
    log.error(error.message);
    process.exit(1);
  });
}

module.exports = { createRelease, createPatch, openConsole, runDoctor };
