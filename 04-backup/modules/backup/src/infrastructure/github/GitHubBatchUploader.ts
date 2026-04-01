import type {
  GitHubBatchConfig,
  BackupValidationResult,
  ExpectedBackupFiles,
  FileToUpload,
  FileVerificationResult,
  UploadResult,
} from './types';
import {
  prepareFirestoreFiles,
  prepareStorageFiles,
} from './file-preparers';
import { BackupValidator } from './backup-validator';
import type { FirestoreBackupData } from '../FirestoreExporter';
import { GitHubAPI } from './GitHubAPI';
import type { StorageBackupData } from '../StorageExporter';

export class GitHubBatchUploader {
  private readonly config: GitHubBatchConfig;
  private readonly api: GitHubAPI;
  private readonly validator: BackupValidator;

  constructor(config: GitHubBatchConfig) {
    this.config = config;
    this.api = new GitHubAPI(this.config);
    this.validator = new BackupValidator(this.api);
  }

  isConfigured(): boolean {
    return !!(this.config.token && this.config.owner && this.config.repo);
  }

  async uploadBackup(
    date: string,
    clientName: string,
    firestoreData: FirestoreBackupData,
    storageData: StorageBackupData
  ): Promise<UploadResult> {
    console.log(`[GitHubBatchUploader] Iniciando upload para ${clientName}...`);

    if (!this.isConfigured()) {
      return {
        success: false,
        filesUploaded: 0,
        errors: ['GitHub nao configurado - verifique as variaveis de ambiente'],
        commits: [],
      };
    }

    const errors: string[] = [];
    const basePath = `backups/${date}/${clientName}`;
    const filesToUpload: FileToUpload[] = [];

    try {
      const firestoreFiles = prepareFirestoreFiles(basePath, firestoreData);
      filesToUpload.push(...firestoreFiles);
      console.log(
        `[GitHubBatchUploader] Firestore: ${firestoreFiles.length} arquivos preparados`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Firestore preparation failed: ${message}`);
      console.error(`[GitHubBatchUploader] Firestore preparation error: ${message}`);
    }

    try {
      const storageFiles = prepareStorageFiles(basePath, storageData);
      filesToUpload.push(...storageFiles);
      console.log(
        `[GitHubBatchUploader] Storage: ${storageFiles.length} arquivos preparados`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Storage preparation failed: ${message}`);
      console.error(`[GitHubBatchUploader] Storage preparation error: ${message}`);
    }

    if (filesToUpload.length === 0) {
      return {
        success: false,
        filesUploaded: 0,
        errors: [...errors, 'Nenhum arquivo para upload'],
        commits: [],
      };
    }

    try {
      const commitMessage = `Backup ${clientName} - ${date} (${filesToUpload.length} arquivos)`;
      const commitSha = await this.api.createSingleCommit(
        filesToUpload,
        commitMessage
      );

      console.log(
        `[GitHubBatchUploader] Upload completo: ${filesToUpload.length} arquivos em 1 commit`
      );

      return {
        success: errors.length === 0,
        filesUploaded: filesToUpload.length,
        errors,
        commits: [commitSha],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Commit failed: ${message}`);
      console.error(`[GitHubBatchUploader] Commit error: ${message}`);

      return {
        success: false,
        filesUploaded: 0,
        errors,
        commits: [],
      };
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }
    return this.api.testConnection();
  }

  async verifyFileExists(
    path: string,
    expectedSha?: string
  ): Promise<FileVerificationResult> {
    return this.validator.verifyFileExists(path, expectedSha);
  }

  async validateBackup(
    date: string,
    clientName: string,
    expectedFiles: ExpectedBackupFiles
  ): Promise<BackupValidationResult> {
    return this.validator.validateBackup(date, clientName, expectedFiles);
  }
}
