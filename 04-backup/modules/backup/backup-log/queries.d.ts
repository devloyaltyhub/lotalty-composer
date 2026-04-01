import type { Pool } from 'pg';
import type { BackupLog, BackupLogPhase, ClientStatusRecord } from './types';
export declare const QUERIES: {
    readonly GET_CLIENT_STATUS_BY_DATE: "\n    SELECT client_name, status, phase FROM backup_logs\n    WHERE date = $1::date";
    readonly CHECK_BACKUP_EXISTS: "\n    SELECT id FROM backup_logs\n    WHERE date = $1::date AND client_name = $2 AND status = 'success'\n    LIMIT 1";
    readonly START_BACKUP: "\n    INSERT INTO backup_logs (date, client_name, project_id, status, phase, started_at)\n    VALUES ($1::date, $2, $3, 'in_progress', $4, NOW())\n    ON CONFLICT (date, client_name)\n    DO UPDATE SET status = 'in_progress', phase = $4, error_message = NULL\n    RETURNING id";
    readonly FAIL_BACKUP: "\n    UPDATE backup_logs\n    SET status = 'error',\n        error_message = $3,\n        completed_at = NOW()\n    WHERE date = $1::date AND client_name = $2";
    readonly GET_DAILY_STATUS: "\n    SELECT\n      id,\n      date::text as date,\n      client_name as \"clientName\",\n      project_id as \"projectId\",\n      status,\n      COALESCE(phase, 'firestore') as phase,\n      firestore_collections as \"firestoreCollections\",\n      storage_files as \"storageFiles\",\n      error_message as \"errorMessage\",\n      started_at as \"startedAt\",\n      completed_at as \"completedAt\",\n      metadata\n    FROM backup_logs\n    WHERE date = $1::date\n    ORDER BY started_at ASC";
    readonly COUNT_COMPLETED_BACKUPS: "\n    SELECT COUNT(*) as count FROM backup_logs\n    WHERE date = $1::date\n    AND status = 'success'\n    AND (phase = 'completed' OR phase = 'storage')";
};
export declare function buildCompletePhaseQuery(phase: BackupLogPhase): string;
export declare function getNextPhase(phase: BackupLogPhase): BackupLogPhase;
export declare function queryClientStatusByDate(pool: Pool, date: string): Promise<Map<string, ClientStatusRecord>>;
export declare function queryDailyStatus(pool: Pool, date: string): Promise<BackupLog[]>;
export declare function queryCompletedCount(pool: Pool, date: string): Promise<number>;
