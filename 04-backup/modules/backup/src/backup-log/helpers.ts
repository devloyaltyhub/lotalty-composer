import type { ClientStatusRecord, PendingClient } from './types';

export function getFirstClient(
  allClients: Record<string, string>
): PendingClient | null {
  const clientNames = Object.keys(allClients);
  if (clientNames.length === 0) {
    return null;
  }
  const firstClientName = clientNames[0] as string;
  const firstClientProjectId = allClients[firstClientName] || '';
  return {
    clientName: firstClientName,
    projectId: firstClientProjectId,
    phase: 'firestore',
  };
}

export function findPendingClientFromStatus(
  allClients: Record<string, string>,
  clientStatus: Map<string, ClientStatusRecord>
): PendingClient | null {
  for (const [clientName, projectId] of Object.entries(allClients)) {
    const status = clientStatus.get(clientName);

    if (!status) {
      return { clientName, projectId, phase: 'firestore' };
    }

    if (status.status === 'error') {
      continue;
    }

    if (status.status === 'in_progress' && status.phase === 'firestore') {
      return { clientName, projectId, phase: 'firestore' };
    }

    if (status.status === 'in_progress' && status.phase === 'storage') {
      return { clientName, projectId, phase: 'storage' };
    }

    if (status.phase === 'firestore' && status.status === 'success') {
      return { clientName, projectId, phase: 'storage' };
    }
  }

  return null;
}

export function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function logRepositoryMessage(
  _action: string,
  message: string,
  isError = false
): void {
  const prefix = '[BackupLogRepository]';
  const fullMessage = `${prefix} ${message}`;
  if (isError) {
    console.error(fullMessage);
  } else {
    console.log(fullMessage);
  }
}

export function prepareMetadataForQuery(
  metadata?: Record<string, unknown>
): string | null {
  return metadata ? JSON.stringify(metadata) : null;
}
