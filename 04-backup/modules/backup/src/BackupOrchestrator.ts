import type {
  BackupOrchestratorDeps,
  BackupOrchestratorParams,
  BackupOrchestratorResult,
} from './types';
import { BackupLogRepository, type BackupLogPhase } from './backup-log/BackupLogRepository';
import { BackupService } from './BackupService';
import { GitHubUploader } from './GitHubUploader';

const DEFAULT_BACKUP_HOUR_START = 2;

export class BackupOrchestrator {
  private readonly deps: BackupOrchestratorDeps;

  constructor(deps: BackupOrchestratorDeps) {
    this.deps = deps;
  }

  async processBackup(
    params: BackupOrchestratorParams = {}
  ): Promise<BackupOrchestratorResult> {
    const startTime = Date.now();
    const backupRepo = new BackupLogRepository(this.deps.getPool);
    const date = this.getTodayDate();
    const backupHourStart =
      this.deps.backupHourStart ?? DEFAULT_BACKUP_HOUR_START;

    if (!params.forceBackup) {
      const now = this.deps.getCurrentTime?.() ?? new Date();
      const hour = now.getHours();

      if (hour < backupHourStart) {
        console.log(
          `[Backup] Skipping: before backup hour (${hour}h, starts at ${backupHourStart}h)`
        );
        return {
          success: true,
          status: 'skipped',
          message: `Before backup hour (starts at ${backupHourStart}h)`,
          duration: Date.now() - startTime,
        };
      }
    }

    let clientName: string | null = null;
    let projectId: string | null = null;
    let phase: BackupLogPhase = 'firestore';

    if (params.backupClient) {
      const pid = this.deps.backupClients[params.backupClient];
      if (!pid) {
        return {
          success: false,
          status: 'failed',
          message: `Invalid client: ${params.backupClient}`,
          duration: Date.now() - startTime,
        };
      }
      clientName = params.backupClient;
      projectId = pid;
      const pending = await backupRepo.getNextPendingClient(date, {
        [clientName]: pid,
      });
      phase = pending?.phase || 'firestore';
    } else {
      const pending = await backupRepo.getNextPendingClient(
        date,
        this.deps.backupClients
      );
      if (!pending) {
        console.log('[Backup] All clients completed backup today');
        return {
          success: true,
          status: 'completed',
          message: 'All clients completed backup today',
          duration: Date.now() - startTime,
          data: { date, allCompleted: true },
        };
      }
      clientName = pending.clientName;
      projectId = pending.projectId;
      phase = pending.phase;
    }

    console.log(
      `[Backup] Starting phase "${phase}" for ${clientName} (${projectId})`
    );
    await backupRepo.startBackup(date, clientName, projectId, phase);

    try {
      const initialized = await this.deps.initializeFirebaseApp(projectId);
      if (!initialized) {
        const errorMsg = `Failed to initialize Firebase: ${projectId}`;
        await backupRepo.failBackup(date, clientName, errorMsg);
        return {
          success: false,
          status: 'failed',
          message: errorMsg,
          duration: Date.now() - startTime,
          clientName,
          phase,
        };
      }

      const backupService = this.createBackupService();

      if (phase === 'firestore') {
        const backupResult = await backupService.backupFirestore(
          projectId,
          clientName
        );
        await backupRepo.completePhase(
          date,
          clientName,
          phase,
          backupResult.documentsProcessed ?? 0,
          0
        );
      } else {
        const backupResult = await backupService.backupStorage(
          projectId,
          clientName
        );
        await backupRepo.completePhase(
          date,
          clientName,
          phase,
          0,
          backupResult.filesProcessed ?? 0
        );
      }

      const duration = Date.now() - startTime;
      console.log(
        `[Backup] Phase "${phase}" completed for ${clientName} (${duration}ms)`
      );

      return {
        success: true,
        status: 'completed',
        message: `Backup ${clientName} phase ${phase} completed`,
        duration,
        clientName,
        phase,
        data: { date, projectId },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message =
        error instanceof Error ? error.message : 'Unknown error';

      console.error(`[Backup] Fatal error in phase ${phase}: ${message}`);
      await backupRepo.failBackup(date, clientName, message);

      return {
        success: false,
        status: 'failed',
        message: `Backup ${clientName} phase ${phase} failed: ${message}`,
        duration,
        clientName,
        phase,
      };
    }
  }

  private createBackupService(): BackupService {
    const uploader = new GitHubUploader({
      token: this.deps.github.token,
      owner: this.deps.github.owner,
      repo: this.deps.github.repo,
    });

    return new BackupService({
      uploader,
      getFirestore: this.deps.getFirestore,
      ...(this.deps.getStorage ? { getStorage: this.deps.getStorage } : {}),
    });
  }

  private getTodayDate(): string {
    const now = this.deps.getCurrentTime?.() ?? new Date();
    const dateParts = now.toISOString().split('T');
    return dateParts[0] || now.toISOString().substring(0, 10);
  }
}
