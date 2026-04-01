import type { GitHubBatchConfig, BackupValidationResult, ExpectedBackupFiles, FileVerificationResult, UploadResult } from './types';
import type { FirestoreBackupData } from '../FirestoreExporter';
import type { StorageBackupData } from '../StorageExporter';
export declare class GitHubBatchUploader {
    private readonly config;
    private readonly api;
    private readonly validator;
    constructor(config: GitHubBatchConfig);
    isConfigured(): boolean;
    uploadBackup(date: string, clientName: string, firestoreData: FirestoreBackupData, storageData: StorageBackupData): Promise<UploadResult>;
    testConnection(): Promise<boolean>;
    verifyFileExists(path: string, expectedSha?: string): Promise<FileVerificationResult>;
    validateBackup(date: string, clientName: string, expectedFiles: ExpectedBackupFiles): Promise<BackupValidationResult>;
}
