export type {
  BackupPhase,
  BackupStatus,
  BackupConfig,
  BackupResult,
  GitHubConfig,
  BackupServiceDependencies,
  BackupUploader,
  BackupOrchestratorDeps,
  BackupOrchestratorParams,
  BackupOrchestratorResult,
} from './types';

export { BackupService } from './BackupService';
export { GitHubUploader } from './GitHubUploader';
export { BackupOrchestrator } from './BackupOrchestrator';

export {
  BackupLogRepository,
  type BackupLog,
  type BackupLogPhase,
  type PendingClient,
} from './backup-log/BackupLogRepository';

export {
  FirestoreExporter,
  type FirestoreBackupData,
  type FirestoreCollectionBackup,
  type FirestoreDocument,
} from './infrastructure/FirestoreExporter';

export {
  StorageExporter,
  type StorageBackupData,
  type StorageFileBackup,
} from './infrastructure/StorageExporter';

export {
  GitHubBatchUploader,
} from './infrastructure/github/GitHubBatchUploader';

export {
  GitHubAPI,
} from './infrastructure/github/GitHubAPI';

export {
  BackupValidator,
} from './infrastructure/github/backup-validator';

export type {
  GitHubBatchConfig,
  UploadResult,
  FileToUpload,
  FileVerificationResult,
  BackupValidationResult,
  ExpectedBackupFiles,
} from './infrastructure/github/types';

export {
  prepareFirestoreFiles,
  prepareStorageFiles,
} from './infrastructure/github/file-preparers';
