export type BackupLogPhase = 'firestore' | 'storage' | 'completed';

export interface BackupLog {
  id?: number;
  date: string;
  clientName: string;
  projectId: string;
  status: 'pending' | 'in_progress' | 'success' | 'error';
  phase: BackupLogPhase;
  firestoreCollections: number;
  storageFiles: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface PendingClient {
  clientName: string;
  projectId: string;
  phase: BackupLogPhase;
}

export interface ClientStatusRecord {
  status: string;
  phase: string;
}

export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS backup_logs (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    client_name VARCHAR(100) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    phase VARCHAR(50) DEFAULT 'firestore',
    firestore_collections INTEGER DEFAULT 0,
    storage_files INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB,
    UNIQUE(date, client_name)
);
CREATE INDEX IF NOT EXISTS idx_backup_logs_date ON backup_logs(date);
CREATE INDEX IF NOT EXISTS idx_backup_logs_client ON backup_logs(client_name);
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(status);
`;
