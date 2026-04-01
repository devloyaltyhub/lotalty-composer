import type { GitHubBatchConfig, FileToUpload } from './types';
export declare class GitHubAPI {
    private readonly baseUrl;
    private readonly config;
    constructor(config: GitHubBatchConfig);
    fetch<T = Record<string, unknown>>(endpoint: string, options?: {
        method?: string;
        body?: string;
    }): Promise<T>;
    fetchRaw(url: string): Promise<Response>;
    testConnection(): Promise<boolean>;
    createBlob(content: Buffer): Promise<string>;
    private createBlobsInParallel;
    private fetchWithRetry;
    createSingleCommit(files: FileToUpload[], commitMessage: string): Promise<string>;
    getContentsUrl(path: string): string;
}
