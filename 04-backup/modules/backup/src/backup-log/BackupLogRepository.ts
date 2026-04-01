import type { Pool } from 'pg';
import {
  CREATE_TABLE_SQL,
  type BackupLog,
  type BackupLogPhase,
  type PendingClient,
} from './types';
import {
  QUERIES,
  buildCompletePhaseQuery,
  getNextPhase,
  queryClientStatusByDate,
  queryDailyStatus,
  queryCompletedCount,
} from './queries';
import {
  getFirstClient,
  findPendingClientFromStatus,
  formatErrorMessage,
  logRepositoryMessage,
  prepareMetadataForQuery,
} from './helpers';

export type { BackupLog, BackupLogPhase, PendingClient } from './types';

export class BackupLogRepository {
  private tableCreated = false;
  private readonly getPool: () => Promise<Pool | null>;

  constructor(getPool: () => Promise<Pool | null>) {
    this.getPool = getPool;
  }

  private async ensureTable(): Promise<void> {
    if (this.tableCreated) {
      return;
    }

    const pool = await this.getPool();
    if (!pool) {
      return;
    }

    try {
      await pool.query(CREATE_TABLE_SQL);
      this.tableCreated = true;
      logRepositoryMessage(
        'ensureTable',
        'Tabela backup_logs criada/verificada'
      );
    } catch (error) {
      logRepositoryMessage(
        'ensureTable',
        `Erro ao criar tabela: ${formatErrorMessage(error)}`,
        true
      );
    }
  }

  async getNextPendingClient(
    date: string,
    allClients: Record<string, string>
  ): Promise<PendingClient | null> {
    await this.ensureTable();
    const pool = await this.getPool();

    if (!pool) {
      logRepositoryMessage(
        'getNextPendingClient',
        'Pool nao disponivel, retornando primeiro cliente'
      );
      return getFirstClient(allClients);
    }

    try {
      const clientStatus = await queryClientStatusByDate(pool, date);
      return findPendingClientFromStatus(allClients, clientStatus);
    } catch (error) {
      logRepositoryMessage(
        'getNextPendingClient',
        `Erro ao buscar cliente pendente: ${formatErrorMessage(error)}`,
        true
      );
      return getFirstClient(allClients);
    }
  }

  async hasBackupToday(date: string, clientName: string): Promise<boolean> {
    await this.ensureTable();
    const pool = await this.getPool();
    if (!pool) {
      return false;
    }

    try {
      const result = await pool.query(QUERIES.CHECK_BACKUP_EXISTS, [
        date,
        clientName,
      ]);
      return result.rows.length > 0;
    } catch (error) {
      logRepositoryMessage(
        'hasBackupToday',
        `Erro ao verificar backup: ${formatErrorMessage(error)}`,
        true
      );
      return false;
    }
  }

  async startBackup(
    date: string,
    clientName: string,
    projectId: string,
    phase: BackupLogPhase = 'firestore'
  ): Promise<number | null> {
    await this.ensureTable();
    const pool = await this.getPool();

    if (!pool) {
      logRepositoryMessage(
        'startBackup',
        'Pool nao disponivel, backup nao registrado'
      );
      return null;
    }

    try {
      const result = await pool.query(QUERIES.START_BACKUP, [
        date,
        clientName,
        projectId,
        phase,
      ]);
      return result.rows[0]?.id || null;
    } catch (error) {
      logRepositoryMessage(
        'startBackup',
        `Erro ao iniciar backup: ${formatErrorMessage(error)}`,
        true
      );
      return null;
    }
  }

  async completePhase(
    date: string,
    clientName: string,
    phase: BackupLogPhase,
    firestoreCollections: number,
    storageFiles: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.ensureTable();
    const pool = await this.getPool();
    if (!pool) {
      return;
    }

    try {
      const query = buildCompletePhaseQuery(phase);
      const nextPhase = getNextPhase(phase);

      await pool.query(query, [
        date,
        clientName,
        nextPhase,
        firestoreCollections,
        storageFiles,
        prepareMetadataForQuery(metadata),
      ]);
    } catch (error) {
      logRepositoryMessage(
        'completePhase',
        `Erro ao completar fase: ${formatErrorMessage(error)}`,
        true
      );
    }
  }

  async failBackup(
    date: string,
    clientName: string,
    errorMessage: string
  ): Promise<void> {
    await this.ensureTable();
    const pool = await this.getPool();
    if (!pool) {
      return;
    }

    try {
      await pool.query(QUERIES.FAIL_BACKUP, [date, clientName, errorMessage]);
    } catch (error) {
      logRepositoryMessage(
        'failBackup',
        `Erro ao registrar falha: ${formatErrorMessage(error)}`,
        true
      );
    }
  }

  async getDailyStatus(date: string): Promise<BackupLog[]> {
    await this.ensureTable();
    const pool = await this.getPool();
    if (!pool) {
      return [];
    }

    try {
      return await queryDailyStatus(pool, date);
    } catch (error) {
      logRepositoryMessage(
        'getDailyStatus',
        `Erro ao buscar status: ${formatErrorMessage(error)}`,
        true
      );
      return [];
    }
  }

  async allClientsCompleted(
    date: string,
    allClients: Record<string, string>
  ): Promise<boolean> {
    await this.ensureTable();
    const pool = await this.getPool();
    if (!pool) {
      return false;
    }

    try {
      const completedCount = await queryCompletedCount(pool, date);
      return completedCount >= Object.keys(allClients).length;
    } catch {
      return false;
    }
  }
}
