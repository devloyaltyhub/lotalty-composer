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
export declare const CREATE_TABLE_SQL = "\nCREATE TABLE IF NOT EXISTS backup_logs (\n    id SERIAL PRIMARY KEY,\n    date DATE NOT NULL,\n    client_name VARCHAR(100) NOT NULL,\n    project_id VARCHAR(255) NOT NULL,\n    status VARCHAR(50) NOT NULL,\n    phase VARCHAR(50) DEFAULT 'firestore',\n    firestore_collections INTEGER DEFAULT 0,\n    storage_files INTEGER DEFAULT 0,\n    error_message TEXT,\n    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n    completed_at TIMESTAMP,\n    metadata JSONB,\n    UNIQUE(date, client_name)\n);\nCREATE INDEX IF NOT EXISTS idx_backup_logs_date ON backup_logs(date);\nCREATE INDEX IF NOT EXISTS idx_backup_logs_client ON backup_logs(client_name);\nCREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(status);\n";
