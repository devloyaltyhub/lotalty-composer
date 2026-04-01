import type { FileToUpload } from './types';
import type { StorageBackupData } from '../StorageExporter';
import type { FirestoreBackupData } from '../FirestoreExporter';
export declare function formatSize(bytes: number): string;
export declare function prepareFirestoreFiles(basePath: string, firestoreData: FirestoreBackupData): FileToUpload[];
export declare function prepareStorageFiles(basePath: string, storageData: StorageBackupData): FileToUpload[];
