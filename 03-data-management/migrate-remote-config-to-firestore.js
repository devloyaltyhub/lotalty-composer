#!/usr/bin/env node

/**
 * Migrate Remote Config → Firestore (App_Config)
 *
 * Reads existing Firebase Remote Config templates and writes
 * the data to Firestore App_Config/config documents.
 *
 * Usage:
 *   node migrate-remote-config-to-firestore.js [--dry-run]
 *
 * Requires:
 *   - MASTER_FIREBASE_PROJECT_ID env var
 *   - MASTER_FIREBASE_SERVICE_ACCOUNT env var
 *   - Client service accounts in credentials/
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const logger = require('../shared/utils/logger');
const { CLIENTS_DIR } = require('../shared/utils/paths');
const {
  resolveServiceAccountPath,
  getMasterServiceAccountPath,
  getMasterProjectId,
} = require('../01-client-setup/shared/firebase-path-utils');

const DRY_RUN = process.argv.includes('--dry-run');

function discoverClients() {
  const clients = [];
  const entries = fs.readdirSync(CLIENTS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const configPath = path.join(CLIENTS_DIR, entry.name, 'config.json');
    if (!fs.existsSync(configPath)) continue;

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.firebaseProjectId) {
      clients.push({
        code: config.clientCode || entry.name,
        projectId: config.firebaseProjectId,
      });
    }
  }

  return clients;
}

function initializeApp(projectId, serviceAccountPath, appName) {
  const resolvedPath = resolveServiceAccountPath(serviceAccountPath);
  const serviceAccount = require(resolvedPath);

  return admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
      projectId,
    },
    appName
  );
}

function parseJsonSafe(value, fallback = null) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback ?? value;
  }
}

function extractFeatureFlags(params) {
  const featureFlagsStr =
    params?.featureFlags?.defaultValue?.value ?? '{}';
  return parseJsonSafe(featureFlagsStr, {});
}

function extractPlanType(params) {
  return params?.planType?.defaultValue?.value ?? 'profissional';
}

function extractPlanLimits(params) {
  const str = params?.planLimits?.defaultValue?.value ?? '{}';
  return parseJsonSafe(str, {});
}

function extractVersionarte(params) {
  const str = params?.versionarte?.defaultValue?.value ?? '{}';
  return parseJsonSafe(str, {});
}

function extractClarityProjectId(params) {
  return params?.clarityProjectId?.defaultValue?.value ?? '';
}

function extractLaunchScreenConfig(params) {
  const str = params?.launchScreenConfig?.defaultValue?.value ?? '{}';
  return parseJsonSafe(str, {});
}

async function migrateClientRemoteConfig(app, clientCode, projectId) {
  logger.info(`\n--- Migrando ${clientCode} (${projectId}) ---`);

  let template;
  try {
    template = await admin.remoteConfig(app).getTemplate();
  } catch (error) {
    logger.warn(
      `Não foi possível ler Remote Config de ${clientCode}: ${error.message}`
    );
    return false;
  }

  const params = template.parameters || {};

  const appConfig = {
    featureFlags: extractFeatureFlags(params),
    planType: extractPlanType(params),
    planLimits: extractPlanLimits(params),
    versionarte: extractVersionarte(params),
    clarityProjectId: extractClarityProjectId(params),
    launchScreenConfig: extractLaunchScreenConfig(params),
  };

  logger.info(`Dados extraídos do Remote Config:`);
  logger.info(`  featureFlags: ${JSON.stringify(appConfig.featureFlags)}`);
  logger.info(`  planType: ${appConfig.planType}`);
  logger.info(`  planLimits: ${JSON.stringify(appConfig.planLimits)}`);
  logger.info(`  versionarte: ${JSON.stringify(appConfig.versionarte).substring(0, 100)}...`);
  logger.info(`  clarityProjectId: ${appConfig.clarityProjectId}`);
  logger.info(`  launchScreenConfig: ${JSON.stringify(appConfig.launchScreenConfig)}`);

  if (DRY_RUN) {
    logger.info(`[DRY RUN] Escreveria App_Config/config em ${projectId}`);
    return true;
  }

  const firestore = admin.firestore(app);
  await firestore.collection('App_Config').doc('config').set(appConfig);

  const verification = await firestore
    .collection('App_Config')
    .doc('config')
    .get();

  if (!verification.exists) {
    logger.error(`Falha na verificação: App_Config/config não existe em ${projectId}`);
    return false;
  }

  logger.info(`App_Config/config escrito e verificado em ${projectId}`);
  return true;
}

async function migrateMasterRemoteConfig(masterApp) {
  logger.info(`\n--- Migrando Master Firebase ---`);

  let template;
  try {
    template = await admin.remoteConfig(masterApp).getTemplate();
  } catch (error) {
    logger.warn(
      `Não foi possível ler Remote Config do Master: ${error.message}`
    );
    return false;
  }

  const params = template.parameters || {};
  const cloudServiceApiKey =
    params?.cloudServiceApiKey?.defaultValue?.value ?? '';

  if (!cloudServiceApiKey) {
    logger.warn('cloudServiceApiKey não encontrada no Remote Config do Master');
    return false;
  }

  logger.info(
    `cloudServiceApiKey encontrada: ${cloudServiceApiKey.substring(0, 8)}...`
  );

  if (DRY_RUN) {
    logger.info('[DRY RUN] Escreveria Master_Config/config no Master Firebase');
    return true;
  }

  const firestore = admin.firestore(masterApp);
  await firestore.collection('Master_Config').doc('config').set({
    cloudServiceApiKey,
  });

  const verification = await firestore
    .collection('Master_Config')
    .doc('config')
    .get();

  if (!verification.exists) {
    logger.error('Falha na verificação: Master_Config/config não existe');
    return false;
  }

  logger.info('Master_Config/config escrito e verificado');
  return true;
}

async function main() {
  logger.info('=== Migração: Remote Config → Firestore ===');

  if (DRY_RUN) {
    logger.info('[DRY RUN] Nenhuma escrita será feita\n');
  }

  const masterProjectId = getMasterProjectId();
  const masterSaPath = getMasterServiceAccountPath();

  if (!masterProjectId || !masterSaPath) {
    logger.error(
      'MASTER_FIREBASE_PROJECT_ID e MASTER_FIREBASE_SERVICE_ACCOUNT são obrigatórios'
    );
    process.exit(1);
  }

  const masterApp = initializeApp(masterProjectId, masterSaPath, 'master-migration');

  const results = { success: [], failed: [] };

  const masterResult = await migrateMasterRemoteConfig(masterApp);
  if (masterResult) {
    results.success.push('master');
  } else {
    results.failed.push('master');
  }

  const clients = discoverClients();
  logger.info(`Clientes encontrados: ${clients.map(c => c.code).join(', ')}\n`);

  for (const client of clients) {
    try {
      const clientSaPath =
        process.env[`${client.code.toUpperCase().replace(/-/g, '_')}_SERVICE_ACCOUNT`] ||
        masterSaPath;

      const app = initializeApp(
        client.projectId,
        clientSaPath,
        `client-${client.code}`
      );

      const result = await migrateClientRemoteConfig(
        app,
        client.code,
        client.projectId
      );

      if (result) {
        results.success.push(client.code);
      } else {
        results.failed.push(client.code);
      }
    } catch (error) {
      logger.error(`Erro ao migrar ${client.code}: ${error.message}`);
      results.failed.push(client.code);
    }
  }

  logger.info('\n=== Resultado da Migração ===');
  logger.info(`Sucesso: ${results.success.join(', ') || 'nenhum'}`);

  if (results.failed.length > 0) {
    logger.warn(`Falhas: ${results.failed.join(', ')}`);
  }

  if (DRY_RUN) {
    logger.info('\n[DRY RUN] Execute sem --dry-run para aplicar as mudanças');
  }

  process.exit(results.failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  logger.error(`Erro fatal: ${error.message}`);
  process.exit(1);
});
