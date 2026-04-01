import type { App } from 'firebase-admin/app';
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
export declare class StorageExporter {
    private readonly projectId;
    private readonly maxFileSizeBytes;
    private readonly getFirebaseApp;
    constructor(projectId: string, getFirebaseApp: (projectId: string) => App | undefined, maxFileSizeMB?: number);
    exportAllFiles(): Promise<StorageBackupData>;
    private exportFile;
    private formatSize;
}
