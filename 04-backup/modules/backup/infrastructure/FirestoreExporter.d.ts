import type { Firestore } from 'firebase-admin/firestore';
export interface FirestoreBackupData {
    exportedAt: string;
    projectId: string;
    collections: FirestoreCollectionBackup[];
    stats: {
        totalCollections: number;
        totalDocuments: number;
    };
}
export interface FirestoreCollectionBackup {
    name: string;
    documents: FirestoreDocument[];
    documentCount: number;
}
export interface FirestoreDocument {
    id: string;
    data: Record<string, unknown>;
    subcollections?: Record<string, FirestoreDocument[]>;
}
export declare class FirestoreExporter {
    private readonly projectId;
    private readonly maxSubcollectionDepth;
    private readonly getFirestore;
    constructor(projectId: string, getFirestore: (projectId: string) => Firestore, maxSubcollectionDepth?: number);
    exportAllCollections(): Promise<FirestoreBackupData>;
    private exportCollection;
    private serializeData;
    private serializeValue;
}
