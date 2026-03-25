#!/usr/bin/env node

/**
 * Setup Vercel CLI
 *
 * Guia passo a passo para configurar o deploy Vercel nos projetos web.
 * Verifica pre-requisitos, cria .env.local, e linka projetos ao Vercel.
 *
 * Usage:
 *   node setup-vercel.js                    # Verificar todos os projetos
 *   node setup-vercel.js --project=admin    # Setup especifico
 *   node setup-vercel.js --project=website
 *   node setup-vercel.js --project=cloud
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');

const logger = require('../../shared/utils/logger');
const { LOYALTYHUB_ROOT } = require('../../shared/utils/paths');

// =============================================================================
// PROJECT DEFINITIONS
// =============================================================================

const PROJECTS = {
  admin: {
    name: 'loyalty-admin',
    label: 'Admin Angular',
    dir: path.join(LOYALTYHUB_ROOT, 'loyalty-admin'),
    vercelAccount: 'Definir na configuracao',
    gitEmail: 'Definir na configuracao',
    gitName: 'Definir na configuracao',
    framework: 'Angular 21',
    notes: 'Build customizado via vercel.json (inject-env.js + ng build)',
  },
  website: {
    name: 'loyalty-website',
    label: 'Website Next.js',
    dir: path.join(LOYALTYHUB_ROOT, 'loyalty-website'),
    vercelAccount: 'devloyaltyhubsite@gmail.com',
    gitEmail: 'devloyaltyhubsite@gmail.com',
    gitName: 'Dev Loyalty Hub Site',
    framework: 'Next.js 15',
    notes: 'Auto-detected framework. Env vars configuradas no Vercel Dashboard.',
  },
  cloud: {
    name: 'loyalty-cloud-service',
    label: 'Cloud Service Next.js',
    dir: path.join(LOYALTYHUB_ROOT, 'loyalty-cloud-service'),
    vercelAccount: 'devloyaltyhub@gmail.com',
    gitEmail: 'devloyaltyhub@gmail.com',
    gitName: 'Dev Loyalty Hub',
    framework: 'Next.js 14',
    notes: 'Precisa de npm run copy-packages antes do build (feito automaticamente).',
  },
};

// =============================================================================
// STATUS CHECKS
// =============================================================================

function checkVercelCli() {
  try {
    const version = execSync('vercel --version 2>/dev/null', { encoding: 'utf-8' }).trim();
    return { installed: true, version };
  } catch {
    return { installed: false, version: null };
  }
}

function getProjectStatus(project) {
  const status = {
    hasEnvLocal: false,
    hasVercelDir: false,
    hasVercelToken: false,
    vercelProjectId: null,
    vercelOrgId: null,
    gitEmail: null,
  };

  // Check .env.local
  const envPath = path.join(project.dir, '.env.local');
  if (fs.existsSync(envPath)) {
    status.hasEnvLocal = true;
    const content = fs.readFileSync(envPath, 'utf-8');
    status.hasVercelToken = content.includes('VERCEL_TOKEN');
  }

  // Check .vercel/project.json
  const vercelPath = path.join(project.dir, '.vercel', 'project.json');
  if (fs.existsSync(vercelPath)) {
    status.hasVercelDir = true;
    try {
      const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
      status.vercelProjectId = vercelConfig.projectId;
      status.vercelOrgId = vercelConfig.orgId;
    } catch {
      // ignore parse errors
    }
  }

  // Check git email
  try {
    status.gitEmail = execSync('git config user.email', {
      cwd: project.dir,
      encoding: 'utf-8',
    }).trim();
  } catch {
    // no git config
  }

  return status;
}

function printProjectStatus(projectKey) {
  const project = PROJECTS[projectKey];
  const status = getProjectStatus(project);

  logger.section(`${project.label} (${project.name})`);
  logger.keyValue('Framework', project.framework);
  logger.keyValue('Diretorio', project.dir);
  logger.keyValue('Conta Vercel', project.vercelAccount);

  console.log('');

  // Checklist
  const check = (ok, label, detail) => {
    if (ok) {
      logger.success(`${label}${detail ? ` — ${detail}` : ''}`);
    } else {
      logger.error(`${label}${detail ? ` — ${detail}` : ''}`);
    }
  };

  check(status.hasEnvLocal, '.env.local existe');
  check(status.hasVercelToken, 'VERCEL_TOKEN configurado');
  check(status.hasVercelDir, 'Projeto linkado ao Vercel',
    status.vercelProjectId ? `projectId: ${status.vercelProjectId}` : 'nao linkado');
  check(status.gitEmail, 'Git email configurado',
    status.gitEmail || 'nao configurado');

  if (project.notes) {
    console.log('');
    logger.info(`Nota: ${project.notes}`);
  }

  const allOk = status.hasEnvLocal && status.hasVercelToken && status.hasVercelDir && status.gitEmail;
  return { status, allOk };
}

// =============================================================================
// SETUP STEPS
// =============================================================================

async function setupProject(projectKey) {
  const project = PROJECTS[projectKey];
  const status = getProjectStatus(project);

  logger.section(`Setup ${project.label}`);

  // Step 1: .env.local with VERCEL_TOKEN
  if (!status.hasEnvLocal || !status.hasVercelToken) {
    logger.info('Passo 1: Configurar .env.local com VERCEL_TOKEN');
    console.log('');
    logger.info('  O VERCEL_TOKEN permite deploy via CLI sem login interativo.');
    logger.info('  Para obter o token:');
    logger.info('    1. Acesse https://vercel.com/account/tokens');
    logger.info(`    2. Logue com a conta: ${project.vercelAccount}`);
    logger.info('    3. Crie um token com nome descritivo (ex: "loyalty-deploy")');
    logger.info('    4. Copie o token gerado');
    console.log('');

    const { token } = await inquirer.prompt([
      {
        type: 'password',
        name: 'token',
        message: 'Cole o VERCEL_TOKEN (ou Enter para pular):',
        mask: '*',
      },
    ]);

    if (token) {
      const envPath = path.join(project.dir, '.env.local');
      let content = '';

      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');
        if (content.includes('VERCEL_TOKEN')) {
          content = content.replace(/VERCEL_TOKEN=.*/, `VERCEL_TOKEN=${token}`);
        } else {
          content += `\nVERCEL_TOKEN=${token}\n`;
        }
      } else {
        content = `# Vercel Deploy Token\nVERCEL_TOKEN=${token}\n`;

        // For loyalty-admin, also add Firebase env vars template
        if (projectKey === 'admin') {
          content += `\n# Master Firebase (copiar valores do Vercel Dashboard)\n`;
          content += `MASTER_AUTH_EMAIL=\n`;
          content += `MASTER_AUTH_PASSWORD=\n`;
          content += `MASTER_FIREBASE_API_KEY=\n`;
          content += `MASTER_FIREBASE_AUTH_DOMAIN=\n`;
          content += `MASTER_FIREBASE_PROJECT_ID=\n`;
          content += `MASTER_FIREBASE_STORAGE_BUCKET=\n`;
          content += `MASTER_FIREBASE_MESSAGING_SENDER_ID=\n`;
          content += `MASTER_FIREBASE_APP_ID=\n`;
        }
      }

      fs.writeFileSync(envPath, content, 'utf-8');
      logger.success('.env.local criado/atualizado');
    } else {
      logger.warn('Pulado — configure manualmente depois');
    }
  } else {
    logger.success('Passo 1: .env.local ja configurado');
  }

  // Step 2: Vercel link
  if (!status.hasVercelDir) {
    console.log('');
    logger.info('Passo 2: Linkar projeto ao Vercel');
    logger.info('  Isso associa o diretorio local ao projeto no Vercel Dashboard.');
    console.log('');

    const { doLink } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'doLink',
        message: `Executar "vercel link" em ${project.name}?`,
        default: true,
      },
    ]);

    if (doLink) {
      try {
        // Use token from .env.local if available
        const envPath = path.join(project.dir, '.env.local');
        let tokenFlag = '';
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf-8');
          const match = envContent.match(/VERCEL_TOKEN=(.+)/);
          if (match) {
            tokenFlag = `--token ${match[1].trim()}`;
          }
        }

        execSync(`vercel link --yes ${tokenFlag}`, {
          cwd: project.dir,
          stdio: 'inherit',
          shell: '/bin/zsh',
        });
        logger.success('Projeto linkado ao Vercel');
      } catch {
        logger.error('Falha ao linkar. Tente manualmente:');
        logger.info(`  cd ${project.dir} && vercel link`);
      }
    } else {
      logger.warn('Pulado — execute manualmente: vercel link');
    }
  } else {
    logger.success('Passo 2: Projeto ja linkado ao Vercel');
  }

  // Step 3: Git config (if different from expected)
  if (project.gitEmail !== 'Definir na configuracao') {
    console.log('');
    if (status.gitEmail !== project.gitEmail) {
      logger.info(`Passo 3: Configurar git email para ${project.gitEmail}`);

      const { doGit } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'doGit',
          message: `Configurar git user.email="${project.gitEmail}" e user.name="${project.gitName}"?`,
          default: true,
        },
      ]);

      if (doGit) {
        execSync(`git config user.email "${project.gitEmail}"`, { cwd: project.dir });
        execSync(`git config user.name "${project.gitName}"`, { cwd: project.dir });
        logger.success('Git config atualizado');
      }
    } else {
      logger.success(`Passo 3: Git email ja configurado (${status.gitEmail})`);
    }
  }

  // Step 4: Vercel environment variables (admin only)
  if (projectKey === 'admin') {
    console.log('');
    logger.info('Passo 4: Configurar Environment Variables no Vercel Dashboard');
    logger.info('  O loyalty-admin usa inject-env.js para gerar environment.prod.ts no build.');
    logger.info('  As seguintes variaveis DEVEM estar configuradas no Vercel Dashboard:');
    console.log('');
    const vars = [
      'MASTER_AUTH_EMAIL',
      'MASTER_AUTH_PASSWORD',
      'MASTER_FIREBASE_API_KEY',
      'MASTER_FIREBASE_AUTH_DOMAIN',
      'MASTER_FIREBASE_PROJECT_ID',
      'MASTER_FIREBASE_STORAGE_BUCKET',
      'MASTER_FIREBASE_MESSAGING_SENDER_ID',
      'MASTER_FIREBASE_APP_ID',
    ];
    for (const v of vars) {
      logger.info(`    ${v}`);
    }
    console.log('');
    logger.info('  Acesse: Vercel Dashboard > Projeto > Settings > Environment Variables');
    logger.info('  Os valores sao os mesmos do Master Firebase (loyalty-hub-1f47c)');
  }

  // Final status
  console.log('');
  const { allOk } = printProjectStatus(projectKey);
  return allOk;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const projectArg = args.find(a => a.startsWith('--project='))?.split('=')[1];
  const isHelp = args.includes('--help') || args.includes('-h');

  if (isHelp) {
    console.log(`
  Setup Vercel - Configuracao inicial dos projetos web para deploy via Vercel

  Usage:
    npm run setup-vercel                        Verificar status de todos os projetos
    npm run setup-vercel -- --project=admin     Setup interativo do loyalty-admin
    npm run setup-vercel -- --project=website   Setup interativo do loyalty-website
    npm run setup-vercel -- --project=cloud     Setup interativo do loyalty-cloud-service

  Pre-requisitos:
    - Vercel CLI instalado: npm i -g vercel
    - Conta Vercel com acesso ao projeto
    - VERCEL_TOKEN gerado em https://vercel.com/account/tokens

  Projetos e contas Vercel:
    admin   → Conta a definir
    website → devloyaltyhubsite@gmail.com
    cloud   → devloyaltyhub@gmail.com
    `);
    process.exit(0);
  }

  logger.section('Setup Vercel Projects');

  // Check Vercel CLI
  const vercelCli = checkVercelCli();
  if (!vercelCli.installed) {
    logger.error('Vercel CLI nao encontrado. Instale com: npm i -g vercel');
    process.exit(1);
  }
  logger.success(`Vercel CLI ${vercelCli.version}`);
  console.log('');

  if (projectArg) {
    // Setup specific project
    if (!PROJECTS[projectArg]) {
      logger.error(`Projeto desconhecido: ${projectArg}. Opcoes: admin, website, cloud`);
      process.exit(1);
    }
    const ok = await setupProject(projectArg);
    process.exit(ok ? 0 : 1);
  }

  // Show status of all projects
  let allConfigured = true;
  const needsSetup = [];

  for (const key of Object.keys(PROJECTS)) {
    const { allOk } = printProjectStatus(key);
    if (!allOk) {
      allConfigured = false;
      needsSetup.push(key);
    }
    console.log('');
  }

  if (allConfigured) {
    logger.success('Todos os projetos web estao configurados para deploy');
    process.exit(0);
  }

  // Offer to setup unconfigured projects
  const { doSetup } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'doSetup',
      message: `${needsSetup.length} projeto(s) precisam de setup. Configurar agora?`,
      default: true,
    },
  ]);

  if (!doSetup) {
    logger.info('Para configurar depois: npm run setup-vercel -- --project=<nome>');
    process.exit(0);
  }

  for (const key of needsSetup) {
    await setupProject(key);
    console.log('');
  }
}

main();
