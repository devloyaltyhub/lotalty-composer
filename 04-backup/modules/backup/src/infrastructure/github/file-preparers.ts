import type { FileToUpload } from './types';
import type { StorageBackupData, StorageFileBackup } from '../StorageExporter';
import type {
  FirestoreBackupData,
  FirestoreCollectionBackup,
} from '../FirestoreExporter';

export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function prepareFirestoreFiles(
  basePath: string,
  firestoreData: FirestoreBackupData
): FileToUpload[] {
  const files: FileToUpload[] = [];

  const manifest = {
    exportedAt: firestoreData.exportedAt,
    projectId: firestoreData.projectId,
    stats: firestoreData.stats,
    collections: firestoreData.collections.map(
      (c: FirestoreCollectionBackup) => ({
        name: c.name,
        documentCount: c.documentCount,
      })
    ),
  };

  files.push({
    path: `${basePath}/firestore/manifest.json`,
    content: Buffer.from(JSON.stringify(manifest, null, 2)),
  });

  for (const collection of firestoreData.collections) {
    const collectionData = {
      name: collection.name,
      exportedAt: firestoreData.exportedAt,
      documentCount: collection.documentCount,
      documents: collection.documents,
    };

    const jsonString = JSON.stringify(collectionData);
    const size = Buffer.byteLength(jsonString);

    console.log(
      `[FilePreparer] ${collection.name}: ${formatSize(size)}`
    );

    files.push({
      path: `${basePath}/firestore/collections/${collection.name}.json`,
      content: Buffer.from(jsonString),
    });
  }

  return files;
}

export function prepareStorageFiles(
  basePath: string,
  storageData: StorageBackupData
): FileToUpload[] {
  const files: FileToUpload[] = [];

  const manifest = {
    exportedAt: storageData.exportedAt,
    projectId: storageData.projectId,
    stats: storageData.stats,
    files: storageData.files.map((f: StorageFileBackup) => ({
      path: f.path,
      contentType: f.contentType,
      size: f.size,
      updatedAt: f.updatedAt,
      skipped: f.skipped,
      skipReason: f.skipReason,
    })),
  };

  files.push({
    path: `${basePath}/storage/manifest.json`,
    content: Buffer.from(JSON.stringify(manifest, null, 2)),
  });

  for (const file of storageData.files) {
    if (file.skipped || !file.content) {
      continue;
    }

    files.push({
      path: `${basePath}/storage/files/${file.path}`,
      content: file.content,
    });
  }

  return files;
}
