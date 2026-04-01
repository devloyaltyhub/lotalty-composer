import type { BackupOrchestratorDeps, BackupOrchestratorParams, BackupOrchestratorResult } from './types';
export declare class BackupOrchestrator {
    private readonly deps;
    constructor(deps: BackupOrchestratorDeps);
    processBackup(params?: BackupOrchestratorParams): Promise<BackupOrchestratorResult>;
    private createBackupService;
    private getTodayDate;
}
