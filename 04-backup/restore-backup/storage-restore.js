/**
 * Storage restore functions
 */

const { downloadFile } = require('./github');
const { formatSize } = require('./utils');

async function restoreStorageFile(
  bucket,
  filePath,
  content,
  contentType,
  dryRun
) {
  console.log(`  Restaurando arquivo: ${filePath}`);

  if (dryRun) {
    console.log(
      `    [DRY-RUN] Pulando upload de ${formatSize(content.length)}`
    );
    return true;
  }

  const file = bucket.file(filePath);

  await file.save(content, {
    metadata: {
      contentType: contentType || 'application/octet-stream',
    },
  });

  console.log(`    Uploaded ${formatSize(content.length)}`);
  return true;
}

async function restoreStorage(bucket, basePath, dryRun) {
  console.log('\n=== Restaurando Storage ===');

  const manifestPath = `${basePath}/storage/manifest.json`;
  console.log(`Baixando manifest: ${manifestPath}`);

  const manifestBuffer = await downloadFile(manifestPath);
  if (!manifestBuffer) {
    console.error('Manifest nao encontrado!');
    return { files: 0 };
  }

  const manifest = JSON.parse(manifestBuffer.toString('utf8'));
  console.log(`Backup de: ${manifest.exportedAt}`);
  console.log(`Files: ${manifest.files.length}`);

  let totalFiles = 0;

  for (const fileInfo of manifest.files) {
    if (fileInfo.skipped) {
      console.log(`  Pulando (skipped no backup): ${fileInfo.path}`);
      continue;
    }

    const backupPath = `${basePath}/storage/files/${fileInfo.path}`;
    console.log(`\nBaixando: ${fileInfo.path}`);

    const fileBuffer = await downloadFile(backupPath);

    if (!fileBuffer) {
      console.error(`  Erro: arquivo nao encontrado no backup`);
      continue;
    }

    await restoreStorageFile(
      bucket,
      fileInfo.path,
      fileBuffer,
      fileInfo.contentType,
      dryRun
    );
    totalFiles++;
  }

  console.log(`\nStorage restaurado: ${totalFiles} arquivos`);
  return { files: totalFiles };
}

module.exports = {
  restoreStorageFile,
  restoreStorage,
};
