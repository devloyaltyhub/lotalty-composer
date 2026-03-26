#!/usr/bin/env node

/**
 * Deploy Firestore Rules to Client Projects
 *
 * Deploys the centralized firestore-client.rules template to one or all client
 * Firebase projects. Ensures all clients have up-to-date security rules.
 *
 * Usage:
 *   node deploy-client-rules.js                  # Interactive mode
 *   node deploy-client-rules.js --all            # Deploy to all active clients
 *   node deploy-client-rules.js --client <id>    # Deploy to specific client
 *   node deploy-client-rules.js --dry-run        # Validate without deploying
 *   node deploy-client-rules.js --all --force    # Skip confirmations
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const firebaseClient = require('../shared/firebase-manager');
const {
  checkFirebaseCLIInstalled,
  checkFirebaseAuthentication,
} = require('../shared/firebase-cli-utils');
const {
  validateRulesFile,
  deployRules,
  createAuditLog,
} = require('../shared/rules-deployment-utils');

const RULES_FILE_PATH = path.join(__dirname, '../../shared/templates/firestore-client.rules');
const INDEXES_FILE_PATH = path.join(__dirname, '../../shared/templates/firestore.indexes.json');
const AUDIT_LOG_DIR = path.join(__dirname, '../../logs');
const AUDIT_LOG_FILE = path.join(AUDIT_LOG_DIR, 'rules-deployment.log');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    all: args.includes('--all'),
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
    clientId: args.includes('--client')
      ? args[args.indexOf('--client') + 1]
      : null,
  };
}

function validatePrerequisites() {
  log('\n[CHECK] Verificando pre-requisitos...', colors.cyan);

  const { installed } = checkFirebaseCLIInstalled();
  if (!installed) {
    log('[FAIL] Firebase CLI nao instalado!', colors.red);
    log('   npm install -g firebase-tools', colors.green);
    return false;
  }
  log('[OK] Firebase CLI instalado', colors.green);

  const { authenticated } = checkFirebaseAuthentication();
  if (!authenticated) {
    log('[FAIL] Firebase nao autenticado!', colors.red);
    log('   firebase login', colors.green);
    return false;
  }
  log('[OK] Firebase autenticado', colors.green);

  const { valid, stats } = validateRulesFile(RULES_FILE_PATH);
  if (!valid) {
    log(`[FAIL] Arquivo de regras nao encontrado: ${RULES_FILE_PATH}`, colors.red);
    return false;
  }
  log(`[OK] Regras validadas (${stats.lines} linhas, ${stats.size} bytes)`, colors.green);

  return true;
}

async function getClients(clientId) {
  await firebaseClient.initializeMasterFirebase();
  const allClients = await firebaseClient.getAllClients(true);

  if (clientId) {
    const client = allClients.find((c) => c.id === clientId || c.code === clientId);
    if (!client) {
      log(`[FAIL] Cliente nao encontrado: ${clientId}`, colors.red);
      return [];
    }
    return [client];
  }

  return allClients;
}

async function confirmDeployment(clients) {
  log(`\n[WARNING] Deploy de regras para ${clients.length} cliente(s):`, colors.yellow);
  for (const client of clients) {
    const projectId = client.firebaseOptions?.projectId || client.firebase_options?.projectId || client.id;
    log(`   - ${client.id || client.code} (${projectId})`, colors.cyan);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\n[?] Continuar com o deploy? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function deployToClient(client, dryRun) {
  const projectId = client.firebaseOptions?.projectId || client.firebase_options?.projectId || client.id;
  const clientLabel = client.id || client.code;

  log(`\n[DEPLOY] ${clientLabel} (${projectId})...`, colors.cyan);

  const tempDir = path.join(AUDIT_LOG_DIR, '..', '.tmp-deploy', projectId);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempRulesPath = path.join(tempDir, 'firestore.rules');
  fs.copyFileSync(RULES_FILE_PATH, tempRulesPath);

  const firebaseJsonPath = path.join(tempDir, 'firebase.json');
  const firestoreConfig = { rules: 'firestore.rules' };
  if (fs.existsSync(INDEXES_FILE_PATH)) {
    firestoreConfig.indexes = 'firestore.indexes.json';
  }
  fs.writeFileSync(firebaseJsonPath, JSON.stringify({ firestore: firestoreConfig }, null, 2));

  if (fs.existsSync(INDEXES_FILE_PATH)) {
    fs.copyFileSync(INDEXES_FILE_PATH, path.join(tempDir, 'firestore.indexes.json'));
  }

  const { success, error } = deployRules(projectId, tempRulesPath, dryRun);

  fs.rmSync(tempDir, { recursive: true, force: true });

  createAuditLog(AUDIT_LOG_DIR, AUDIT_LOG_FILE, {
    project: projectId,
    rulesFile: RULES_FILE_PATH,
    dryRun,
    success,
  });

  if (success) {
    log(`   [OK] ${clientLabel}: ${dryRun ? 'validado' : 'deploy concluido'}`, colors.green);
  } else {
    log(`   [FAIL] ${clientLabel}: ${error}`, colors.red);
  }

  return { clientLabel, projectId, success, error };
}

async function main() {
  log('\n========================================', colors.bright);
  log('[FIRE] DEPLOY REGRAS PARA CLIENTES', colors.bright);
  log('========================================\n', colors.bright);

  const { all, force, dryRun, clientId } = parseArgs();

  if (dryRun) {
    log('[DRY-RUN] Modo de validacao - nenhum deploy sera executado\n', colors.yellow);
  }

  if (!validatePrerequisites()) {
    process.exit(1);
  }

  try {
    const clients = await getClients(clientId);

    if (clients.length === 0) {
      log('\n[INFO] Nenhum cliente encontrado.', colors.yellow);
      process.exit(0);
    }

    if (!all && !clientId) {
      log('\n[INFO] Use --all para todos os clientes ou --client <id> para um especifico.', colors.yellow);
      log('[INFO] Clientes disponiveis:', colors.cyan);
      for (const client of clients) {
        const projectId = client.firebaseOptions?.projectId || client.firebase_options?.projectId || client.id;
        log(`   - ${client.id || client.code} (${projectId})`, colors.cyan);
      }
      process.exit(0);
    }

    if (!force && !dryRun) {
      const confirmed = await confirmDeployment(clients);
      if (!confirmed) {
        log('\n[CANCEL] Deploy cancelado.', colors.yellow);
        process.exit(0);
      }
    }

    const results = [];
    for (const client of clients) {
      const result = await deployToClient(client, dryRun);
      results.push(result);
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    log('\n========================================', colors.bright);
    log('[RESULT] RESULTADO DO DEPLOY', colors.bright);
    log('========================================', colors.bright);
    log(`   Total: ${results.length}`, colors.cyan);
    log(`   Sucesso: ${succeeded}`, colors.green);
    if (failed > 0) {
      log(`   Falha: ${failed}`, colors.red);
    }

    firebaseClient.cleanup();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    log(`\n[FAIL] Erro: ${error.message}`, colors.red);
    firebaseClient.cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { deployToClient };
