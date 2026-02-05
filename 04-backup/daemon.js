#!/usr/bin/env node
/**
 * Backup Daemon
 * Runs 24/7 and executes backups at the configured hour daily
 *
 * Usage:
 *   npm run backup           # Daemon mode (runs continuously)
 *   npm run backup:once      # Run once and exit
 */

const { existsSync, readdirSync, readFileSync } = require('fs');
const { join } = require('path');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore: getFirestoreFromSDK } = require('firebase-admin/firestore');
const { BackupOrchestrator } = require('@loyaltyhub/backup');
const { TelegramSender } = require('@loyaltyhub/reports');
const { CONFIG, validateConfig } = require('./config');

const credentialsDir = join(process.cwd(), 'credentials');

function parseArgs() {
  const args = process.argv.slice(2);
  const runOnce = args.includes('--once') || args.includes('-1');
  return { runOnce };
}

function getNextBackupTime(hour) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);

  if (now >= next) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function msUntil(date) {
  return date.getTime() - Date.now();
}

function formatTime(date) {
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function discoverClients() {
  const clients = {};

  if (!existsSync(credentialsDir)) {
    console.error('Credentials folder not found:', credentialsDir);
    return clients;
  }

  const files = readdirSync(credentialsDir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    try {
      const filePath = join(credentialsDir, file);
      const content = JSON.parse(readFileSync(filePath, 'utf8'));
      const projectId = content.project_id;

      if (projectId) {
        const clientName = file.replace('.json', '');
        clients[clientName] = projectId;
      }
    } catch {
      console.warn(`Failed to parse ${file}`);
    }
  }

  return clients;
}

async function initializeFirebaseApp(projectId) {
  try {
    const existingApp = getApps().find(
      (app) => app.options?.projectId === projectId
    );

    if (existingApp) {
      return true;
    }

    const files = readdirSync(credentialsDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const filePath = join(credentialsDir, file);
      const serviceAccount = JSON.parse(readFileSync(filePath, 'utf8'));

      if (serviceAccount.project_id === projectId) {
        const appName = `${projectId}-${Math.random().toString(36).slice(2, 9)}`;
        initializeApp(
          {
            credential: cert(serviceAccount),
            projectId,
            storageBucket: `${projectId}.firebasestorage.app`,
          },
          appName
        );
        console.log(`Firebase initialized: ${projectId}`);
        return true;
      }
    }

    console.error(`Credentials not found for: ${projectId}`);
    return false;
  } catch (error) {
    console.error(`Firebase init error for ${projectId}:`, error);
    return false;
  }
}

function getFirestore(projectId) {
  const app = getApps().find((a) => a.options?.projectId === projectId);
  if (!app) {
    throw new Error(`Firebase app not found: ${projectId}`);
  }
  return getFirestoreFromSDK(app);
}

function createTelegramSender() {
  return new TelegramSender({
    botToken: CONFIG.TELEGRAM_BOT_TOKEN,
    chatId: CONFIG.TELEGRAM_CHAT_ID,
  });
}

async function sendNotification(telegram, success, message, duration, clientName) {
  if (!telegram.isConfigured()) {
    return;
  }

  const emoji = success ? '✅' : '❌';
  const status = success ? 'SUCCESS' : 'FAILED';
  const durationSec = (duration / 1000).toFixed(1);

  const text = [
    `${emoji} *Backup ${status}*`,
    '',
    clientName ? `Client: \`${clientName}\`` : '',
    `Message: ${message}`,
    `Duration: ${durationSec}s`,
    '',
    `_${new Date().toISOString()}_`,
  ]
    .filter(Boolean)
    .join('\n');

  await telegram.sendMessage(text);
}

async function runBackup(orchestrator, telegram) {
  const startTime = Date.now();
  const results = [];
  let hasError = false;

  try {
    while (true) {
      const result = await orchestrator.processBackup({ forceBackup: true });

      console.log(`[${result.clientName || 'all'}] ${result.message}`);

      if (result.status === 'completed' && result.data?.allCompleted) {
        console.log('\nAll clients completed!');
        break;
      }

      if (result.status === 'failed') {
        hasError = true;
        results.push({
          client: result.clientName,
          success: false,
          message: result.message,
        });
      } else {
        results.push({
          client: result.clientName,
          success: true,
          message: result.message,
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    const summary = [
      `Completed: ${successCount} phases`,
      failCount > 0 ? `Failed: ${failCount}` : null,
      `Duration: ${(totalDuration / 1000).toFixed(1)}s`,
    ]
      .filter(Boolean)
      .join(', ');

    console.log(`\nSummary: ${summary}`);

    await sendNotification(
      telegram,
      !hasError,
      hasError ? `Backup finished with errors. ${summary}` : `All backups completed. ${summary}`,
      totalDuration
    );

    return !hasError;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('\nBackup failed:', message);

    await sendNotification(telegram, false, message, Date.now() - startTime);

    return false;
  }
}

async function main() {
  console.log('=== Loyalty Backup Daemon ===\n');

  if (!validateConfig()) {
    process.exit(1);
  }

  const { runOnce } = parseArgs();
  const clients = discoverClients();

  if (Object.keys(clients).length === 0) {
    console.error('No clients found in credentials folder');
    process.exit(1);
  }

  console.log('Clients found:', Object.keys(clients).join(', '));

  const telegram = createTelegramSender();

  const orchestrator = new BackupOrchestrator({
    getPool: async () => null,
    initializeFirebaseApp,
    getFirestore,
    backupClients: clients,
    github: {
      token: CONFIG.GITHUB_BACKUP_TOKEN,
      owner: CONFIG.GITHUB_BACKUP_OWNER,
      repo: CONFIG.GITHUB_BACKUP_REPO,
    },
  });

  if (runOnce) {
    console.log('\nRunning backup once...\n');
    const success = await runBackup(orchestrator, telegram);
    process.exit(success ? 0 : 1);
  }

  console.log(`\nScheduler mode: backup at ${CONFIG.BACKUP_HOUR_START}:00 daily`);
  console.log('Use --once to run immediately and exit\n');

  while (true) {
    const nextRun = getNextBackupTime(CONFIG.BACKUP_HOUR_START);
    const waitMs = msUntil(nextRun);
    const waitHours = (waitMs / 1000 / 60 / 60).toFixed(1);

    console.log(`Next backup: ${formatTime(nextRun)} (in ${waitHours}h)`);

    await new Promise((resolve) => setTimeout(resolve, waitMs));

    console.log(`\n[${formatTime(new Date())}] Starting scheduled backup...\n`);
    await runBackup(orchestrator, telegram);
    console.log('');
  }
}

main();
