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
const {
  FirestoreExporter,
  StorageExporter,
  GitHubBatchUploader,
} = require('@loyaltyhub/backup');
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

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
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

function initializeFirebaseApp(projectId) {
  try {
    const existingApp = getApps().find(
      (app) => app.options?.projectId === projectId
    );

    if (existingApp) {
      return existingApp;
    }

    const files = readdirSync(credentialsDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const filePath = join(credentialsDir, file);
      const serviceAccount = JSON.parse(readFileSync(filePath, 'utf8'));

      if (serviceAccount.project_id === projectId) {
        // Set GOOGLE_APPLICATION_CREDENTIALS for Storage SDK
        process.env.GOOGLE_APPLICATION_CREDENTIALS = filePath;

        const app = initializeApp(
          {
            credential: cert(serviceAccount),
            projectId,
            storageBucket: `${projectId}.appspot.com`,
          },
          projectId
        );
        console.log(`Firebase initialized: ${projectId}`);
        return app;
      }
    }

    console.error(`Credentials not found for: ${projectId}`);
    return null;
  } catch (error) {
    console.error(`Firebase init error for ${projectId}:`, error.message);
    return null;
  }
}

function createTelegramSender() {
  return new TelegramSender({
    botToken: CONFIG.TELEGRAM_BOT_TOKEN,
    chatId: CONFIG.TELEGRAM_CHAT_ID,
  });
}

async function sendNotification(telegram, success, message, duration) {
  if (!telegram.isConfigured()) {
    return;
  }

  const emoji = success ? '✅' : '❌';
  const status = success ? 'SUCCESS' : 'FAILED';
  const durationSec = (duration / 1000).toFixed(1);

  const text = [
    `${emoji} *Backup ${status}*`,
    '',
    `Message: ${message}`,
    `Duration: ${durationSec}s`,
    '',
    `_${new Date().toISOString()}_`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await telegram.sendMessage(text);
  } catch (error) {
    console.error('Failed to send Telegram notification:', error.message);
  }
}

function getFirestore(pid) {
  const app = getApps().find((a) => a.options?.projectId === pid);
  if (!app) {
    throw new Error(`Firebase app not found: ${pid}`);
  }
  return getFirestoreFromSDK(app);
}

function getFirebaseApp(pid) {
  return getApps().find((a) => a.options?.projectId === pid);
}

async function backupClient(clientName, projectId, uploader, date) {
  const startTime = Date.now();

  const app = initializeFirebaseApp(projectId);
  if (!app) {
    return { success: false, error: `Failed to initialize Firebase for ${projectId}` };
  }

  let firestoreData = null;
  let storageData = null;

  // Export Firestore
  console.log(`  [${clientName}] Exporting Firestore...`);
  try {
    const firestoreExporter = new FirestoreExporter(projectId, getFirestore);
    firestoreData = await firestoreExporter.exportAllCollections();
    console.log(`  [${clientName}] Firestore: ${firestoreData.stats.totalDocuments} docs in ${firestoreData.stats.totalCollections} collections`);
  } catch (error) {
    console.error(`  [${clientName}] Firestore export error:`, error.message);
  }

  // Export Storage
  console.log(`  [${clientName}] Exporting Storage...`);
  try {
    const storageExporter = new StorageExporter(projectId, getFirebaseApp);
    storageData = await storageExporter.exportAllFiles();
    console.log(`  [${clientName}] Storage: ${storageData.stats.totalFiles} files`);
  } catch (error) {
    console.error(`  [${clientName}] Storage export error:`, error.message);
    // Create empty storage data if export fails
    storageData = {
      exportedAt: new Date().toISOString(),
      projectId,
      files: [],
      stats: { totalFiles: 0, totalSize: 0, skippedFiles: 0 },
    };
  }

  // Upload to GitHub
  if (!firestoreData && !storageData) {
    return { success: false, error: 'No data to backup', duration: Date.now() - startTime };
  }

  // If no firestore data, create empty structure
  if (!firestoreData) {
    firestoreData = {
      exportedAt: new Date().toISOString(),
      projectId,
      collections: [],
      stats: { totalCollections: 0, totalDocuments: 0 },
    };
  }

  console.log(`  [${clientName}] Uploading to GitHub...`);
  const uploadResult = await uploader.uploadBackup(date, clientName, firestoreData, storageData);

  const duration = Date.now() - startTime;

  return {
    success: uploadResult.success,
    duration,
    results: {
      firestore: {
        collections: firestoreData.stats.totalCollections,
        documents: firestoreData.stats.totalDocuments,
      },
      storage: {
        files: storageData.stats.totalFiles,
      },
      filesUploaded: uploadResult.filesUploaded,
    },
    errors: uploadResult.errors,
  };
}

async function runBackup(clients, telegram) {
  const startTime = Date.now();
  const date = getTodayDate();
  const clientNames = Object.keys(clients);
  const backupResults = [];
  let hasError = false;

  console.log(`\nStarting backup for ${clientNames.length} clients (${date})\n`);

  const uploader = new GitHubBatchUploader({
    token: CONFIG.GITHUB_BACKUP_TOKEN,
    owner: CONFIG.GITHUB_BACKUP_OWNER,
    repo: CONFIG.GITHUB_BACKUP_REPO,
  });

  for (const clientName of clientNames) {
    const projectId = clients[clientName];
    console.log(`\n[${clientName}] Starting backup (${projectId})`);

    try {
      const result = await backupClient(clientName, projectId, uploader, date);
      backupResults.push({ clientName, ...result });

      if (!result.success) {
        hasError = true;
        if (result.errors?.length > 0) {
          console.error(`[${clientName}] Errors:`, result.errors.join(', '));
        }
      }

      console.log(`[${clientName}] Completed in ${(result.duration / 1000).toFixed(1)}s`);
    } catch (error) {
      hasError = true;
      backupResults.push({
        clientName,
        success: false,
        error: error.message,
      });
      console.error(`[${clientName}] Failed:`, error.message);
    }
  }

  const totalDuration = Date.now() - startTime;
  const successCount = backupResults.filter((r) => r.success).length;
  const failCount = backupResults.filter((r) => !r.success).length;

  const summary = [
    `Clients: ${successCount}/${clientNames.length} successful`,
    failCount > 0 ? `Failed: ${failCount}` : null,
    `Duration: ${(totalDuration / 1000).toFixed(1)}s`,
  ]
    .filter(Boolean)
    .join(', ');

  console.log(`\n=== Backup Summary ===`);
  console.log(summary);

  await sendNotification(
    telegram,
    !hasError,
    hasError ? `Backup finished with errors. ${summary}` : `All backups completed. ${summary}`,
    totalDuration
  );

  return !hasError;
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

  if (runOnce) {
    console.log('\nRunning backup once...');
    const success = await runBackup(clients, telegram);
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

    console.log(`\n[${formatTime(new Date())}] Starting scheduled backup...`);
    await runBackup(clients, telegram);
    console.log('');
  }
}

main();
