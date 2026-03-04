#!/usr/bin/env node
/**
 * Restaura arquivos do backup local para o Firebase Storage
 *
 * Uso: node restore-storage.js <projectId> <storageBucket> <backupDate>
 * Exemplo: node restore-storage.js na-rede-loyalty-hub-club-4948 na-rede-loyalty-hub-club-4948.firebasestorage.app 2026-02-27
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { WHITE_LABEL_APP_ROOT, LOYALTYHUB_ROOT } = require('../shared/utils/paths');

const FILES_TO_RESTORE = [
  'gallery/img_20260117_100403_426_espetinhos.jpg',
  'gallery/img_20260117_100845_334_salsicho.jpg',
  'gallery/img_20260117_101053_297_po_de_alho.jpg',
  'gallery/img_20260117_101325_302_salgado_de_forno.jpg',
  'gallery/img_20260117_101538_87_salgado_frito_coxinha.jpg',
  'gallery/img_20260117_101911_761_poro_de_nuggets.jpg',
  'gallery/img_20260117_102132_584_poro_de_batata_frita.jpg',
  'gallery/img_20260117_102337_425_poro_de_calabresa.jpg',
  'gallery/img_20260122_180343_32_la_playa.jpg',
];

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Uso: node restore-storage.js <projectId> <storageBucket> <backupDate>');
    process.exit(1);
  }

  const [projectId, storageBucket, backupDate] = args;

  const clientName = projectId.includes('na-rede') ? 'na-rede' : 'demo';
  const backupDir = path.join(LOYALTYHUB_ROOT, 'loyalty-backups', 'backups', backupDate, clientName, 'storage', 'files');

  if (!fs.existsSync(backupDir)) {
    console.error(`Diretório de backup não encontrado: ${backupDir}`);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('RESTAURAÇÃO DE STORAGE');
  console.log('='.repeat(60));
  console.log(`\n  Project:  ${projectId}`);
  console.log(`  Bucket:   ${storageBucket}`);
  console.log(`  Backup:   ${backupDate}`);
  console.log(`  Arquivos: ${FILES_TO_RESTORE.length}\n`);

  const serviceAccountPath = path.join(WHITE_LABEL_APP_ROOT, 'service-account.json');
  const serviceAccount = require(serviceAccountPath);

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
    storageBucket,
  });

  const bucket = admin.storage(app).bucket();

  let restored = 0;
  let failed = 0;

  for (const filePath of FILES_TO_RESTORE) {
    const localPath = path.join(backupDir, filePath);

    if (!fs.existsSync(localPath)) {
      console.log(`  SKIP  ${filePath} (não encontrado no backup)`);
      failed++;
      continue;
    }

    try {
      const fileBuffer = fs.readFileSync(localPath);
      const file = bucket.file(filePath);

      await file.save(fileBuffer, {
        metadata: {
          contentType: 'image/jpeg',
        },
      });

      console.log(`  OK    ${filePath} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
      restored++;
    } catch (error) {
      console.log(`  ERRO  ${filePath}: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`Restaurados: ${restored} | Falhas: ${failed}`);
  console.log('-'.repeat(60));

  await app.delete();

  if (restored > 0) {
    console.log('\nPróximo passo: rodar fix-storage-urls.js para atualizar tokens no Firestore');
    console.log(`  node fix-storage-urls.js ${projectId} "(default)" ${storageBucket}`);
  }
}

main();
