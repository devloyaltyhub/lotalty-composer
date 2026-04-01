import type { GitHubConfig, BackupUploader } from './types';
export declare class GitHubUploader implements BackupUploader {
    private readonly config;
    private readonly apiBase;
    constructor(config: GitHubConfig);
    uploadFile(path: string, content: string | Buffer, message: string): Promise<{
        success: boolean;
        sha?: string;
        error?: string;
    }>;
    createOrUpdateFile(path: string, content: string, message: string): Promise<{
        success: boolean;
        sha?: string;
        error?: string;
    }>;
    private getFileSha;
}
