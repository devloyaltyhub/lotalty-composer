#!/usr/bin/env node

/**
 * Deploy Vercel Projects CLI
 *
 * Centralized Vercel deployment for web projects:
 *   - loyalty-admin (Angular)
 *   - loyalty-website (Next.js)
 *   - loyalty-cloud-service (Next.js)
 *
 * Usage:
 *   node deploy-vercel.js                    # Interactive mode
 *   node deploy-vercel.js --project=admin    # Deploy specific project
 *   node deploy-vercel.js --project=website
 *   node deploy-vercel.js --project=cloud
 *   node deploy-vercel.js --project=all      # Deploy all web projects
 *   node deploy-vercel.js --preview          # Preview deploy (not production)
 *   node deploy-vercel.js --check-only       # Run check-all without deploying
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
    checkCommand: 'npm run check-all',
    deployCommand: 'source .env.local && vercel --prod --yes --token $VERCEL_TOKEN',
    previewCommand: 'source .env.local && vercel --yes --token $VERCEL_TOKEN',
    envFile: '.env.local',
    requiredEnvVars: ['VERCEL_TOKEN'],
  },
  website: {
    name: 'loyalty-website',
    label: 'Website Next.js',
    dir: path.join(LOYALTYHUB_ROOT, 'loyalty-website'),
    checkCommand: 'npm run check-all',
    deployCommand: 'source .env.local && vercel --prod --yes --token $VERCEL_TOKEN',
    previewCommand: 'source .env.local && vercel --yes --token $VERCEL_TOKEN',
    envFile: '.env.local',
    requiredEnvVars: ['VERCEL_TOKEN'],
  },
  cloud: {
    name: 'loyalty-cloud-service',
    label: 'Cloud Service Next.js',
    dir: path.join(LOYALTYHUB_ROOT, 'loyalty-cloud-service'),
    checkCommand: 'npm run type-check && npm run lint && npm run format:check',
    deployCommand: 'source .env.local && vercel --prod --yes --token $VERCEL_TOKEN',
    previewCommand: 'source .env.local && vercel --yes --token $VERCEL_TOKEN',
    envFile: '.env.local',
    requiredEnvVars: ['VERCEL_TOKEN'],
  },
};

// =============================================================================
// HELPERS
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    project: args.find(a => a.startsWith('--project='))?.split('=')[1],
    preview: args.includes('--preview'),
    checkOnly: args.includes('--check-only'),
    skipCheck: args.includes('--skip-check'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function showHelp() {
  console.log(`
  Deploy Vercel - Deploy centralizado dos projetos web

  Usage:
    npm run deploy-vercel                         Modo interativo
    npm run deploy-vercel -- --project=admin      Deploy loyalty-admin
    npm run deploy-vercel -- --project=website    Deploy loyalty-website
    npm run deploy-vercel -- --project=cloud      Deploy loyalty-cloud-service
    npm run deploy-vercel -- --project=all        Deploy todos os projetos web
    npm run deploy-vercel -- --preview            Preview (nao producao)
    npm run deploy-vercel -- --check-only         Apenas validacao (sem deploy)
    npm run deploy-vercel -- --skip-check         Pular validacao pre-deploy

  Options:
    --project=<name>    Projeto alvo (admin, website, cloud, all)
    --preview           Deploy de preview (nao producao)
    --check-only        Apenas rodar check-all sem deployar
    --skip-check        Pular validacao pre-deploy
    --help, -h          Mostrar ajuda
  `);
}

/**
 * Check if project has required env vars in .env.local
 */
function validateEnv(project) {
  const envPath = path.join(project.dir, project.envFile);
  if (!fs.existsSync(envPath)) {
    throw new Error(
      `${project.envFile} nao encontrado em ${project.dir}.\n` +
      `  Crie o arquivo com VERCEL_TOKEN=<token> ou copie de .env.example`
    );
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const missing = project.requiredEnvVars.filter(v => !envContent.includes(v));
  if (missing.length > 0) {
    throw new Error(`Variaveis ausentes em ${project.envFile}: ${missing.join(', ')}`);
  }

  // Check if Vercel project is linked
  const vercelDir = path.join(project.dir, '.vercel');
  if (!fs.existsSync(vercelDir)) {
    logger.warn(`${project.label}: .vercel/ nao encontrado. O primeiro deploy pode pedir para linkar o projeto.`);
    logger.warn(`  Para linkar manualmente: cd ${project.dir} && vercel link`);
  }
}

/**
 * Run check-all for a project
 */
function runCheck(project) {
  logger.info(`Validando ${project.label}...`);
  try {
    execSync(project.checkCommand, {
      cwd: project.dir,
      stdio: 'inherit',
      shell: '/bin/zsh',
    });
    logger.success(`${project.label}: validacao OK`);
    return true;
  } catch {
    logger.error(`${project.label}: validacao falhou`);
    return false;
  }
}

/**
 * Deploy a project to Vercel
 */
function runDeploy(project, preview = false) {
  const command = preview ? project.previewCommand : project.deployCommand;
  const mode = preview ? 'preview' : 'producao';

  logger.info(`Deploying ${project.label} (${mode})...`);

  try {
    execSync(command, {
      cwd: project.dir,
      stdio: 'inherit',
      shell: '/bin/zsh',
    });
    logger.success(`${project.label}: deploy ${mode} concluido`);
    return true;
  } catch {
    logger.error(`${project.label}: deploy falhou`);
    return false;
  }
}

/**
 * Deploy a single project (validate + deploy)
 */
async function deploySingleProject(projectKey, options = {}) {
  const project = PROJECTS[projectKey];
  if (!project) {
    throw new Error(`Projeto desconhecido: ${projectKey}`);
  }

  logger.section(`Deploy ${project.label}`);

  // Validate env
  validateEnv(project);
  logger.success(`${project.envFile} encontrado`);

  // Run checks unless skipped
  if (!options.skipCheck) {
    const checkOk = runCheck(project);
    if (!checkOk) {
      throw new Error(`Validacao falhou para ${project.label}. Corrija os erros antes de deployar.`);
    }
  }

  if (options.checkOnly) {
    logger.success(`${project.label}: validacao completa (--check-only)`);
    return true;
  }

  // Deploy
  return runDeploy(project, options.preview);
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  logger.section('Deploy Vercel Projects');

  try {
    let projectKeys;

    if (args.project) {
      if (args.project === 'all') {
        projectKeys = Object.keys(PROJECTS);
      } else if (PROJECTS[args.project]) {
        projectKeys = [args.project];
      } else {
        logger.error(`Projeto desconhecido: ${args.project}. Opcoes: admin, website, cloud, all`);
        process.exit(1);
      }
    } else {
      // Interactive mode
      const choices = [
        ...Object.entries(PROJECTS).map(([key, p]) => ({
          name: `${p.label} (${p.name})`,
          value: key,
        })),
        { name: 'Todos os projetos web', value: 'all' },
      ];

      const { selected } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: 'Qual projeto deployar?',
          choices,
        },
      ]);

      projectKeys = selected === 'all' ? Object.keys(PROJECTS) : [selected];
    }

    // Confirm
    const projectNames = projectKeys.map(k => PROJECTS[k].label).join(', ');
    const mode = args.preview ? 'preview' : 'producao';
    const action = args.checkOnly ? 'validar' : `deployar (${mode})`;

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `${action}: ${projectNames}?`,
        default: true,
      },
    ]);

    if (!confirm) {
      logger.info('Cancelado');
      process.exit(0);
    }

    // Execute
    const results = [];
    for (const key of projectKeys) {
      try {
        const success = await deploySingleProject(key, {
          preview: args.preview,
          checkOnly: args.checkOnly,
          skipCheck: args.skipCheck,
        });
        results.push({ project: PROJECTS[key].label, success });
      } catch (error) {
        logger.error(error.message);
        results.push({ project: PROJECTS[key].label, success: false });
      }
    }

    // Summary
    logger.blank();
    logger.section('Resumo');
    for (const r of results) {
      if (r.success) {
        logger.success(`${r.project}: OK`);
      } else {
        logger.error(`${r.project}: FALHOU`);
      }
    }

    const allOk = results.every(r => r.success);
    process.exit(allOk ? 0 : 1);

  } catch (error) {
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  }
}

main();
