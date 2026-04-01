export interface GitHubBatchConfig {
    token: string;
    owner: string;
    repo: string;
}
export interface UploadResult {
    success: boolean;
    filesUploaded: number;
    errors: string[];
    commits: string[];
}
export interface TreeEntry {
    path: string;
    mode: '100644';
    type: 'blob';
    sha: string;
}
export interface FileToUpload {
    path: string;
    content: Buffer;
}
export interface FileVerificationResult {
    exists: boolean;
    sha?: string;
    size?: number;
    error?: string;
}
export interface BackupValidationResult {
    valid: boolean;
    filesValidated: number;
    errors: string[];
}
export interface ExpectedBackupFiles {
    firestore: {
        manifest: boolean;
        collections: string[];
    };
    storage: {
        manifest: boolean;
        files: string[];
    };
}
export interface GitHubRefResponse {
    object: {
        sha: string;
    };
}
export interface GitHubCommitResponse {
    tree: {
        sha: string;
    };
}
export interface GitHubShaResponse {
    sha: string;
}
export interface GitHubFileInfoResponse {
    sha?: string;
    size?: number;
    content?: string;
}
