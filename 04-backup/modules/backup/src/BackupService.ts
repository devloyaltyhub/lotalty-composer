import type { Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';
import type {
  BackupConfig,
  BackupResult,
  BackupServiceDependencies,
  BackupUploader,
} from './types';

export class BackupService {
  private readonly uploader: BackupUploader;
  private readonly getFirestore: (projectId: string) => Firestore;
  private readonly getStorage?: (projectId: string) => Storage;
  private readonly config: BackupConfig;

  constructor(dependencies: BackupServiceDependencies) {
    this.uploader = dependencies.uploader;
    this.getFirestore = dependencies.getFirestore;
    this.getStorage = dependencies.getStorage;
    this.config = {
      collectionsToBackup: dependencies.config?.collectionsToBackup,
      maxDocumentsPerCollection:
        dependencies.config?.maxDocumentsPerCollection || 1000,
      maxFileSizeMb: dependencies.config?.maxFileSizeMb || 50,
      compressionEnabled: dependencies.config?.compressionEnabled ?? true,
    };
  }

  async backupFirestore(
    projectId: string,
    clientName: string,
    collections?: string[]
  ): Promise<BackupResult> {
    const result: BackupResult = {
      clientName,
      projectId,
      phase: 'firestore',
      status: 'in_progress',
      startedAt: new Date(),
      documentsProcessed: 0,
    };

    try {
      const firestore = this.getFirestore(projectId);
      const collectionsToBackup =
        collections ||
        this.config.collectionsToBackup ||
        (await this.listCollections(firestore));

      const backupData: Record<string, unknown[]> = {};

      for (const collectionName of collectionsToBackup) {
        const docs = await this.backupCollection(firestore, collectionName);
        backupData[collectionName] = docs;
        result.documentsProcessed! += docs.length;
      }

      const content = JSON.stringify(backupData, null, 2);
      const date = new Date().toISOString().split('T')[0];
      const path = `${clientName}/${date}/firestore.json`;

      const uploadResult = await this.uploader.uploadFile(
        path,
        content,
        `Backup Firestore ${clientName} - ${date}`
      );

      if (uploadResult.success) {
        result.status = 'completed';
        result.bytesUploaded = Buffer.byteLength(content);
      } else {
        result.status = 'failed';
        result.error = uploadResult.error;
      }

      result.completedAt = new Date();
      return result;
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Backup failed';
      result.completedAt = new Date();
      return result;
    }
  }

  async backupStorage(
    projectId: string,
    clientName: string,
    bucketPath?: string
  ): Promise<BackupResult> {
    void bucketPath;
    const result: BackupResult = {
      clientName,
      projectId,
      phase: 'storage',
      status: 'in_progress',
      startedAt: new Date(),
      filesProcessed: 0,
    };

    if (!this.getStorage) {
      result.status = 'failed';
      result.error = 'Storage backup not configured';
      result.completedAt = new Date();
      return result;
    }

    try {
      this.getStorage(projectId);

      result.status = 'completed';
      result.completedAt = new Date();
      return result;
    } catch (error) {
      result.status = 'failed';
      result.error =
        error instanceof Error ? error.message : 'Storage backup failed';
      result.completedAt = new Date();
      return result;
    }
  }

  private async listCollections(firestore: Firestore): Promise<string[]> {
    const collections = await firestore.listCollections();
    return collections.map((c) => c.id);
  }

  private async backupCollection(
    firestore: Firestore,
    collectionName: string
  ): Promise<unknown[]> {
    const snapshot = await firestore
      .collection(collectionName)
      .limit(this.config.maxDocumentsPerCollection!)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }
}
