import type { ClientStatusRecord, PendingClient } from './types';
export declare function getFirstClient(allClients: Record<string, string>): PendingClient | null;
export declare function findPendingClientFromStatus(allClients: Record<string, string>, clientStatus: Map<string, ClientStatusRecord>): PendingClient | null;
export declare function formatErrorMessage(error: unknown): string;
export declare function logRepositoryMessage(_action: string, message: string, isError?: boolean): void;
export declare function prepareMetadataForQuery(metadata?: Record<string, unknown>): string | null;
