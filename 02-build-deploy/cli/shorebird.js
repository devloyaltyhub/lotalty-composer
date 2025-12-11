#!/usr/bin/env node
/**
 * Shorebird OTA Updates CLI
 * Manage Shorebird releases and patches for OTA updates
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) =>
    console.log(`\n${colors.bright}${colors.cyan}🐦 ${msg}${colors.reset}\n`),
};

// Paths
const AUTOMATION_ROOT = path.resolve(__dirname, '..', '..');
const WHITE_LABEL_APP = path.resolve(AUTOMATION_ROOT, '..', 'white_label_app');

/**
 * Check if Shorebird is installed
 */
function isShorebirdInstalled() {
  try {
    execSync('which shorebird', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Shorebird is configured for the project
 */
function isShorebirdConfigured() {
  const shorebirdYaml = path.join(WHITE_LABEL_APP, 'shorebird.yaml');

  if (!fs.existsSync(shorebirdYaml)) {
    return { configured: false, reason: 'shorebird.yaml não encontrado' };
  }

  const content = fs.readFileSync(shorebirdYaml, 'utf8');
  if (content.includes('placeholder-')) {
    return {
      configured: false,
      reason: 'app_id é placeholder (execute shorebird init)',
    };
  }

  return { configured: true };
}

/**
 * Get current version from pubspec.yaml
 */
function getCurrentVersion() {
  const pubspecPath = path.join(WHITE_LABEL_APP, 'pubspec.yaml');
  const content = fs.readFileSync(pubspecPath, 'utf8');
  const match = content.match(/^version:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Increment version in pubspec.yaml
 * @param {string} bumpType - 'build', 'patch', 'minor', or 'major'
 * @returns {object} - { oldVersion, newVersion }
 */
function incrementVersion(bumpType = 'build') {
  const pubspecPath = path.join(WHITE_LABEL_APP, 'pubspec.yaml');
  let pubspec = fs.readFileSync(pubspecPath, 'utf8');

  const versionRegex = /^version:\s*([0-9]+)\.([0-9]+)\.([0-9]+)\+([0-9]+)/m;
  const match = pubspec.match(versionRegex);

  if (!match) {
    throw new Error('Versão não encontrada no pubspec.yaml');
  }

  let [, major, minor, patch, build] = match.map((v, i) =>
    i > 0 ? parseInt(v, 10) : v
  );

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
  const newVersionLine = `version: ${newVersion}`;

  const updated = pubspec.replace(versionRegex, newVersionLine);
  fs.writeFileSync(pubspecPath, updated, 'utf8');

  return { oldVersion, newVersion };
}

/**
 * Create readline interface for user input
 */
function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask user a question
 */
function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Run shorebird command directly
 */
function runShorebird(args) {
  return new Promise((resolve, reject) => {
    log.info(`Executando: shorebird ${args.join(' ')}`);
    console.log('');

    const proc = spawn('shorebird', args, {
      cwd: WHITE_LABEL_APP,
      stdio: 'inherit',
      env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Shorebird exited with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Show menu and get user choice
 */
async function showMenu() {
  const rl = createPrompt();

  console.log('');
  log.title('Shorebird OTA Updates');

  const currentVersion = getCurrentVersion();
  if (currentVersion) {
    log.info(`Versão atual: ${currentVersion}`);
  }

  console.log('');
  console.log('  1. 📦 Criar Release (para submissão na store)');
  console.log('  2. 🩹 Criar Patch (correção OTA sem passar pela store)');
  console.log('  3. 🌐 Abrir Console Shorebird (ver releases/patches)');
  console.log('  4. 🔍 Verificar Instalação (shorebird doctor)');
  console.log('  0. ❌ Sair');
  console.log('');

  const choice = await ask(rl, 'Escolha uma opção: ');
  rl.close();

  return choice;
}

/**
 * Get platform choice
 */
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

  // Increment build number automatically
  const { oldVersion, newVersion } = incrementVersion('build');
  log.success(`Versão incrementada: ${oldVersion} → ${newVersion}`);
  console.log('');

  const platform = await getPlatform();
  if (!platform) {
    log.error('Plataforma inválida');
    return;
  }

  if (platform === 'both') {
    log.info('Criando release para Android...');
    await runShorebird(['release', 'android', '--no-confirm']);

    log.info('Criando release para iOS...');
    await runShorebird(['release', 'ios', '--no-confirm']);
  } else {
    await runShorebird(['release', platform, '--no-confirm']);
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
      '--no-confirm',
    ]);

    log.info('Criando patch para iOS...');
    await runShorebird([
      'patch',
      'ios',
      `--release-version=${version}`,
      '--no-confirm',
    ]);
  } else {
    await runShorebird([
      'patch',
      platform,
      `--release-version=${version}`,
      '--no-confirm',
    ]);
  }

  log.success('Patch criado com sucesso!');
  log.info('Os usuários receberão a atualização na próxima abertura do app');
  log.info(
    'O número do patch é incrementado automaticamente pelo Shorebird (patch 1, 2, 3...)'
  );
}

/**
 * Open Shorebird Console
 */
async function openConsole() {
  log.title('Console Shorebird');
  log.info('O Console Shorebird permite visualizar releases, patches e métricas');
  console.log('');

  const url = 'https://console.shorebird.dev';

  try {
    // Try to open in browser
    const { exec } = require('child_process');
    exec(`open "${url}"`, (error) => {
      if (error) {
        log.info(`Abra manualmente: ${url}`);
      } else {
        log.success(`Abrindo ${url} no navegador...`);
      }
    });
  } catch {
    log.info(`Abra manualmente: ${url}`);
  }
}

/**
 * Run shorebird doctor
 */
async function runDoctor() {
  log.title('Shorebird Doctor');
  await runShorebird(['doctor', '--verbose']);
}

/**
 * Main function
 */
async function main() {
  // Check prerequisites
  if (!isShorebirdInstalled()) {
    log.error('Shorebird CLI não está instalado');
    log.info('Instale com:');
    console.log(
      '  curl --proto "=https" --tlsv1.2 https://raw.githubusercontent.com/shorebirdtech/install/main/install.sh -sSf | bash'
    );
    process.exit(1);
  }

  const configCheck = isShorebirdConfigured();
  if (!configCheck.configured) {
    log.error(`Shorebird não está configurado: ${configCheck.reason}`);
    log.info('Para configurar, execute:');
    console.log('  cd white_label_app && shorebird init');
    process.exit(1);
  }

  // Handle command line arguments
  const args = process.argv.slice(2);
  const command = args[0];

  if (command) {
    switch (command) {
      case 'release':
        await createRelease();
        break;
      case 'patch':
        await createPatch();
        break;
      case 'console':
        await openConsole();
        break;
      case 'doctor':
        await runDoctor();
        break;
      case 'help':
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
        break;
      default:
        log.error(`Comando desconhecido: ${command}`);
        process.exit(1);
    }
    return;
  }

  // Interactive menu
  while (true) {
    const choice = await showMenu();

    try {
      switch (choice) {
        case '1':
          await createRelease();
          break;
        case '2':
          await createPatch();
          break;
        case '3':
          await openConsole();
          break;
        case '4':
          await runDoctor();
          break;
        case '0':
          log.info('Até mais!');
          process.exit(0);
          break;
        default:
          log.warn('Opção inválida');
      }
    } catch (error) {
      log.error(`Erro: ${error.message}`);
    }

    console.log('');
    const rl = createPrompt();
    await ask(rl, 'Pressione Enter para continuar...');
    rl.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    log.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  createRelease,
  createPatch,
  openConsole,
  runDoctor,
};
