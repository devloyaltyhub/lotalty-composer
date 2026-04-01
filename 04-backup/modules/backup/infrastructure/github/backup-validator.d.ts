import type { GitHubAPI } from './GitHubAPI';
import type { FileVerificationResult, BackupValidationResult, ExpectedBackupFiles } from './types';
export declare class BackupValidator {
    private readonly api;
    constructor(api: GitHubAPI);
    verifyFileExists(path: string, expectedSha?: string): Promise<FileVerificationResult>;
    validateBackup(date: string, clientName: string, expectedFiles: ExpectedBackupFiles): Promise<BackupValidationResult>;
}
