/**
 * Firestore restore functions
 */

const { downloadFile, listFiles } = require('./github');
const { decompressGzip, convertTimestamps } = require('./utils');

async function restoreFirestoreCollection(firestore, collectionData, dryRun) {
  const { name, documents } = collectionData;

  console.log(
    `  Restaurando colecao: ${name} (${documents.length} documentos)`
  );

  if (dryRun) {
    console.log(
      `    [DRY-RUN] Pulando escrita de ${documents.length} documentos`
    );
    return documents.length;
  }

  const batch = firestore.batch();
  let batchCount = 0;
  let totalRestored = 0;

  for (const doc of documents) {
    const docRef = firestore.collection(name).doc(doc.id);
    const data = convertTimestamps(doc.data);

    batch.set(docRef, data, { merge: false });
    batchCount++;

    if (batchCount >= 500) {
      await batch.commit();
      totalRestored += batchCount;
      console.log(`    Commitados ${totalRestored} documentos...`);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    totalRestored += batchCount;
  }

  console.log(`    Restaurados ${totalRestored} documentos`);
  return totalRestored;
}

async function restoreFirestore(firestore, basePath, dryRun) {
  console.log('\n=== Restaurando Firestore ===');

  const manifestPath = `${basePath}/firestore/manifest.json`;
  console.log(`Baixando manifest: ${manifestPath}`);

  const manifestBuffer = await downloadFile(manifestPath);
  if (!manifestBuffer) {
    console.error('Manifest nao encontrado!');
    return { collections: 0, documents: 0 };
  }

  const manifest = JSON.parse(manifestBuffer.toString('utf8'));
  console.log(`Backup de: ${manifest.exportedAt}`);
  console.log(`Collections: ${manifest.collections.length}`);

  let totalCollections = 0;
  let totalDocuments = 0;

  const collectionsPath = `${basePath}/firestore/collections`;
  const collectionFiles = await listFiles(collectionsPath);

  for (const fileInfo of collectionFiles) {
    if (
      !fileInfo.name.endsWith('.json.gz') &&
      !fileInfo.name.endsWith('.json')
    ) {
      continue;
    }

    console.log(`\nBaixando: ${fileInfo.name}`);
    const fileBuffer = await downloadFile(fileInfo.path);

    if (!fileBuffer) {
      console.error(`  Erro: arquivo nao encontrado`);
      continue;
    }

    let jsonContent;
    if (fileInfo.name.endsWith('.gz')) {
      const decompressed = decompressGzip(fileBuffer);
      jsonContent = JSON.parse(decompressed.toString('utf8'));
    } else {
      jsonContent = JSON.parse(fileBuffer.toString('utf8'));
    }

    const docsRestored = await restoreFirestoreCollection(
      firestore,
      jsonContent,
      dryRun
    );
    totalCollections++;
    totalDocuments += docsRestored;
  }

  console.log(
    `\nFirestore restaurado: ${totalCollections} collections, ${totalDocuments} documentos`
  );
  return { collections: totalCollections, documents: totalDocuments };
}

module.exports = {
  restoreFirestoreCollection,
  restoreFirestore,
};
