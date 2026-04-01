import type { BackupResult, BackupServiceDependencies } from './types';
export declare class BackupService {
    private readonly uploader;
    private readonly getFirestore;
    private readonly getStorage?;
    private readonly config;
    constructor(dependencies: BackupServiceDependencies);
    backupFirestore(projectId: string, clientName: string, collections?: string[]): Promise<BackupResult>;
    backupStorage(projectId: string, clientName: string, bucketPath?: string): Promise<BackupResult>;
    private listCollections;
    private backupCollection;
}
