import type { Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';
import type { Pool } from 'pg';

export type BackupPhase = 'firestore' | 'storage';
export type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface BackupConfig {
  collectionsToBackup?: string[];
  maxDocumentsPerCollection?: number;
  maxFileSizeMb?: number;
  compressionEnabled?: boolean;
}

export interface BackupResult {
  clientName: string;
  projectId: string;
  phase: BackupPhase;
  status: BackupStatus;
  startedAt: Date;
  completedAt?: Date;
  documentsProcessed?: number;
  filesProcessed?: number;
  bytesUploaded?: number;
  error?: string;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  basePath?: string;
}

export interface BackupServiceDependencies {
  uploader: BackupUploader;
  getFirestore: (projectId: string) => Firestore;
  getStorage?: (projectId: string) => Storage;
  config?: BackupConfig;
}

export interface BackupUploader {
  uploadFile(
    path: string,
    content: string | Buffer,
    message: string
  ): Promise<{ success: boolean; sha?: string; error?: string }>;

  createOrUpdateFile(
    path: string,
    content: string,
    message: string
  ): Promise<{ success: boolean; sha?: string; error?: string }>;
}

export interface BackupOrchestratorDeps {
  getPool: () => Promise<Pool | null>;
  initializeFirebaseApp: (projectId: string) => Promise<boolean>;
  getFirestore: (projectId: string) => Firestore;
  getStorage?: (projectId: string) => Storage;
  backupClients: Record<string, string>;
  backupHourStart?: number;
  getCurrentTime?: () => Date;
  github: {
    token: string;
    owner: string;
    repo: string;
  };
}

export interface BackupOrchestratorParams {
  forceBackup?: boolean;
  backupClient?: string;
}

export interface BackupOrchestratorResult {
  success: boolean;
  status: 'completed' | 'failed' | 'skipped';
  message: string;
  duration: number;
  clientName?: string;
  phase?: string;
  data?: Record<string, unknown>;
}
