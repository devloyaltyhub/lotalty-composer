import type { Pool } from 'pg';
import { type BackupLog, type BackupLogPhase, type PendingClient } from './types';
export type { BackupLog, BackupLogPhase, PendingClient } from './types';
export declare class BackupLogRepository {
    private tableCreated;
    private readonly getPool;
    constructor(getPool: () => Promise<Pool | null>);
    private ensureTable;
    getNextPendingClient(date: string, allClients: Record<string, string>): Promise<PendingClient | null>;
    hasBackupToday(date: string, clientName: string): Promise<boolean>;
    startBackup(date: string, clientName: string, projectId: string, phase?: BackupLogPhase): Promise<number | null>;
    completePhase(date: string, clientName: string, phase: BackupLogPhase, firestoreCollections: number, storageFiles: number, metadata?: Record<string, unknown>): Promise<void>;
    failBackup(date: string, clientName: string, errorMessage: string): Promise<void>;
    getDailyStatus(date: string): Promise<BackupLog[]>;
    allClientsCompleted(date: string, allClients: Record<string, string>): Promise<boolean>;
}
