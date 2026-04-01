import type { Pool } from 'pg';
import type {
  BackupLog,
  BackupLogPhase,
  ClientStatusRecord,
} from './types';

export const QUERIES = {
  GET_CLIENT_STATUS_BY_DATE: `
    SELECT client_name, status, phase FROM backup_logs
    WHERE date = $1::date`,

  CHECK_BACKUP_EXISTS: `
    SELECT id FROM backup_logs
    WHERE date = $1::date AND client_name = $2 AND status = 'success'
    LIMIT 1`,

  START_BACKUP: `
    INSERT INTO backup_logs (date, client_name, project_id, status, phase, started_at)
    VALUES ($1::date, $2, $3, 'in_progress', $4, NOW())
    ON CONFLICT (date, client_name)
    DO UPDATE SET status = 'in_progress', phase = $4, error_message = NULL
    RETURNING id`,

  FAIL_BACKUP: `
    UPDATE backup_logs
    SET status = 'error',
        error_message = $3,
        completed_at = NOW()
    WHERE date = $1::date AND client_name = $2`,

  GET_DAILY_STATUS: `
    SELECT
      id,
      date::text as date,
      client_name as "clientName",
      project_id as "projectId",
      status,
      COALESCE(phase, 'firestore') as phase,
      firestore_collections as "firestoreCollections",
      storage_files as "storageFiles",
      error_message as "errorMessage",
      started_at as "startedAt",
      completed_at as "completedAt",
      metadata
    FROM backup_logs
    WHERE date = $1::date
    ORDER BY started_at ASC`,

  COUNT_COMPLETED_BACKUPS: `
    SELECT COUNT(*) as count FROM backup_logs
    WHERE date = $1::date
    AND status = 'success'
    AND (phase = 'completed' OR phase = 'storage')`,
} as const;

export function buildCompletePhaseQuery(phase: BackupLogPhase): string {
  const completedAt = phase === 'storage' ? 'NOW()' : 'NULL';

  return `
    UPDATE backup_logs
    SET status = 'success',
        phase = $3,
        firestore_collections = GREATEST(firestore_collections, $4),
        storage_files = GREATEST(storage_files, $5),
        completed_at = ${completedAt},
        metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($6::jsonb, '{}'::jsonb)
    WHERE date = $1::date AND client_name = $2`;
}

export function getNextPhase(phase: BackupLogPhase): BackupLogPhase {
  return phase === 'storage' ? 'completed' : phase;
}

export async function queryClientStatusByDate(
  pool: Pool,
  date: string
): Promise<Map<string, ClientStatusRecord>> {
  const result = await pool.query(QUERIES.GET_CLIENT_STATUS_BY_DATE, [date]);

  const clientStatus = new Map<string, ClientStatusRecord>();
  for (const row of result.rows) {
    clientStatus.set(row.client_name, {
      status: row.status,
      phase: row.phase,
    });
  }

  return clientStatus;
}

export async function queryDailyStatus(
  pool: Pool,
  date: string
): Promise<BackupLog[]> {
  const result = await pool.query(QUERIES.GET_DAILY_STATUS, [date]);
  return result.rows;
}

export async function queryCompletedCount(
  pool: Pool,
  date: string
): Promise<number> {
  const result = await pool.query(QUERIES.COUNT_COMPLETED_BACKUPS, [date]);
  return parseInt(result.rows[0]?.count || '0', 10);
}
