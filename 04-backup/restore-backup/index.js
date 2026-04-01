#!/usr/bin/env node

/**
 * Script para restaurar backup do Firebase (Firestore + Storage)
 *
 * Baixa backups do GitHub e restaura no Firebase do cliente
 *
 * Uso:
 *   npm run backup:restore -- --client=demo --date=2025-12-12
 *   npm run backup:restore -- --client=demo --date=2025-12-12 --firestore-only
 *   npm run backup:restore -- --client=demo --date=2025-12-12 --storage-only
 *   npm run backup:restore -- --client=demo --date=2025-12-12 --dry-run
 */

const { parseArgs, showHelp, validateOptions } = require("./cli");
const { validateGitHubConfig } = require("./github");
const { initializeFirebase } = require("./firebase-init");
const { restoreFirestore } = require("./firestore-restore");
const { restoreStorage } = require("./storage-restore");

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const projectId = validateOptions(options);
  validateGitHubConfig();

  console.log("========================================");
  console.log("   RESTAURAÇÃO DE BACKUP FIREBASE");
  console.log("========================================");
  console.log(`Cliente: ${options.client} (${projectId})`);
  console.log(`Data: ${options.date}`);
  console.log(`Modo: ${options.dryRun ? "DRY-RUN (simulação)" : "PRODUÇÃO"}`);
  if (options.firestoreOnly) {
    console.log("Escopo: Apenas Firestore");
  }
  if (options.storageOnly) {
    console.log("Escopo: Apenas Storage");
  }
  console.log("========================================\n");

  if (!options.dryRun) {
    console.log("ATENÇÃO: Isso vai SOBRESCREVER dados existentes!");
    console.log("Pressione Ctrl+C para cancelar ou aguarde 5 segundos...\n");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const basePath = `backups/${options.date}/${options.client}`;

  console.log("Inicializando Firebase...");
  const { app, firestore, storage } = await initializeFirebase(
    options.client,
    projectId,
  );

  const results = {
    firestore: { collections: 0, documents: 0 },
    storage: { files: 0 },
  };

  try {
    if (!options.storageOnly) {
      results.firestore = await restoreFirestore(
        firestore,
        basePath,
        options.dryRun,
      );
    }

    if (!options.firestoreOnly) {
      results.storage = await restoreStorage(storage, basePath, options.dryRun);
    }

    console.log("\n========================================");
    console.log("   RESTAURAÇÃO CONCLUÍDA");
    console.log("========================================");
    console.log(
      `Firestore: ${results.firestore.collections} collections, ${results.firestore.documents} documentos`,
    );
    console.log(`Storage: ${results.storage.files} arquivos`);
    if (options.dryRun) {
      console.log("\n[DRY-RUN] Nenhuma alteração foi feita");
    }
    console.log("========================================");
  } catch (error) {
    console.error("\nErro durante restauração:", error.message);
    process.exit(1);
  } finally {
    await app.delete();
  }
}

main().catch((error) => {
  console.error("Erro fatal:", error);
  process.exit(1);
});
