import type { App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { Storage } from '@google-cloud/storage';

export interface StorageBackupData {
  exportedAt: string;
  projectId: string;
  files: StorageFileBackup[];
  stats: {
    totalFiles: number;
    totalSize: number;
    skippedFiles: number;
  };
}

export interface StorageFileBackup {
  path: string;
  contentType: string;
  size: number;
  updatedAt: string;
  content?: Buffer;
  skipped?: boolean;
  skipReason?: string;
}

export class StorageExporter {
  private readonly projectId: string;
  private readonly maxFileSizeBytes: number;
  private readonly getFirebaseApp: (projectId: string) => App | undefined;

  constructor(
    projectId: string,
    getFirebaseApp: (projectId: string) => App | undefined,
    maxFileSizeMB: number = 50
  ) {
    this.projectId = projectId;
    this.getFirebaseApp = getFirebaseApp;
    this.maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
  }

  async exportAllFiles(): Promise<StorageBackupData> {
    console.log(`[StorageExporter] Iniciando export para ${this.projectId}...`);

    const app = this.getFirebaseApp(this.projectId);
    if (!app) {
      throw new Error(
        `Firebase app not found for projectId: ${this.projectId}`
      );
    }

    // Fix: Use Google Cloud Storage client directly with credentials
    let bucket;
    try {
      // Check if GOOGLE_APPLICATION_CREDENTIALS is set
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (credPath) {
        console.log(`[StorageExporter] Using credentials from: ${credPath}`);
        // Initialize GCS client directly with credentials
        const gcsStorage = new Storage({
          projectId: this.projectId,
          keyFilename: credPath
        });
        const bucketName = app.options.storageBucket || `${this.projectId}.firebasestorage.app`;
        console.log(`[StorageExporter] Using bucket: ${bucketName}`);
        bucket = gcsStorage.bucket(bucketName);
      } else {
        // Fallback to Firebase Admin SDK storage (might not work without proper setup)
        console.log(`[StorageExporter] Warning: GOOGLE_APPLICATION_CREDENTIALS not set, trying Firebase Admin SDK`);
        const storage = getStorage(app);
        const bucketName = app.options.storageBucket || `${this.projectId}.firebasestorage.app`;
        bucket = storage.bucket(bucketName);
      }
    } catch (storageError) {
      console.error(`[StorageExporter] Failed to initialize storage:`, storageError);
      throw storageError;
    }

    try {
      const [files] = await bucket.getFiles();
      console.log(`[StorageExporter] Encontrados ${files.length} arquivos`);

      const exportedFiles: StorageFileBackup[] = [];
      let totalSize = 0;
      let skippedFiles = 0;

      for (const file of files) {
        const fileBackup = await this.exportFile(file);
        exportedFiles.push(fileBackup);
        totalSize += fileBackup.size;

        if (fileBackup.skipped) {
          skippedFiles++;
        }
      }

      const result: StorageBackupData = {
        exportedAt: new Date().toISOString(),
        projectId: this.projectId,
        files: exportedFiles,
        stats: {
          totalFiles: files.length,
          totalSize,
          skippedFiles,
        },
      };

      console.log(
        `[StorageExporter] Export completo: ${files.length} arquivos (${skippedFiles} pulados por tamanho)`
      );

      return result;
    } catch (error: any) {
      const message = error?.message || 'Unknown error';
      console.error(`[StorageExporter] Erro no export: ${message}`);
      throw error;
    }
  }

  private async exportFile(file: any): Promise<StorageFileBackup> {
    const [metadata] = await file.getMetadata();
    const size = parseInt(metadata.size, 10);
    const isLarge = size > this.maxFileSizeBytes;

    if (isLarge) {
      console.log(
        `[StorageExporter] Pulando arquivo grande: ${file.name} (${this.formatSize(size)})`
      );
      return {
        path: file.name,
        contentType: metadata.contentType || 'application/octet-stream',
        size,
        updatedAt: metadata.updated,
        skipped: true,
        skipReason: `File too large: ${this.formatSize(
          size
        )} > ${this.formatSize(this.maxFileSizeBytes)}`,
      };
    }

    try {
      const [content] = await file.download();

      return {
        path: file.name,
        contentType: metadata.contentType || 'application/octet-stream',
        size,
        updatedAt: metadata.updated,
        content,
      };
    } catch (error: any) {
      const message = error?.message || 'Unknown error';
      console.error(
        `[StorageExporter] Erro ao baixar ${file.name}: ${message}`
      );
      return {
        path: file.name,
        contentType: metadata.contentType || 'application/octet-stream',
        size,
        updatedAt: metadata.updated,
        skipped: true,
        skipReason: `Download failed: ${message}`,
      };
    }
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}
