import type { CollectionReference, Firestore } from 'firebase-admin/firestore';

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

export class FirestoreExporter {
  private readonly projectId: string;
  private readonly maxSubcollectionDepth: number;
  private readonly getFirestore: (projectId: string) => Firestore;

  constructor(
    projectId: string,
    getFirestore: (projectId: string) => Firestore,
    maxSubcollectionDepth: number = 2
  ) {
    this.projectId = projectId;
    this.getFirestore = getFirestore;
    this.maxSubcollectionDepth = maxSubcollectionDepth;
  }

  async exportAllCollections(): Promise<FirestoreBackupData> {
    console.log(
      `[FirestoreExporter] Iniciando export para ${this.projectId}...`
    );

    const db = this.getFirestore(this.projectId);
    const collections: FirestoreCollectionBackup[] = [];
    let totalDocuments = 0;

    try {
      const collectionRefs = await db.listCollections();
      console.log(
        `[FirestoreExporter] Encontradas ${collectionRefs.length} colecoes`
      );

      for (const collRef of collectionRefs) {
        const collectionName = collRef.id;
        console.log(
          `[FirestoreExporter] Exportando colecao: ${collectionName}`
        );

        const documents = await this.exportCollection(collRef, 0);
        collections.push({
          name: collectionName,
          documents,
          documentCount: documents.length,
        });
        totalDocuments += documents.length;

        console.log(
          `[FirestoreExporter] ${collectionName}: ${documents.length} documentos`
        );
      }

      const result: FirestoreBackupData = {
        exportedAt: new Date().toISOString(),
        projectId: this.projectId,
        collections,
        stats: {
          totalCollections: collectionRefs.length,
          totalDocuments,
        },
      };

      console.log(
        `[FirestoreExporter] Export completo: ${totalDocuments} documentos em ${collectionRefs.length} colecoes`
      );

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[FirestoreExporter] Erro no export: ${message}`);
      throw new Error(
        `Firestore export failed for ${this.projectId}: ${message}`
      );
    }
  }

  private async exportCollection(
    collectionRef: CollectionReference,
    depth: number
  ): Promise<FirestoreDocument[]> {
    const documents: FirestoreDocument[] = [];
    const snapshot = await collectionRef.get();

    for (const doc of snapshot.docs) {
      const docData: FirestoreDocument = {
        id: doc.id,
        data: this.serializeData(doc.data()),
      };

      if (depth < this.maxSubcollectionDepth) {
        const subcollections = await doc.ref.listCollections();

        if (subcollections.length > 0) {
          docData.subcollections = {};

          for (const subcollRef of subcollections) {
            docData.subcollections[subcollRef.id] = await this.exportCollection(
              subcollRef,
              depth + 1
            );
          }
        }
      }

      documents.push(docData);
    }

    return documents;
  }

  private serializeData(
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const serialized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      serialized[key] = this.serializeValue(value);
    }

    return serialized;
  }

  private serializeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate: () => Date }).toDate === 'function'
    ) {
      return {
        _type: 'Timestamp',
        value: (value as { toDate: () => Date }).toDate().toISOString(),
      };
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      'latitude' in value &&
      'longitude' in value
    ) {
      const geoPoint = value as { latitude: number; longitude: number };
      return {
        _type: 'GeoPoint',
        latitude: geoPoint.latitude,
        longitude: geoPoint.longitude,
      };
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      'path' in value &&
      typeof (value as { path: string }).path === 'string'
    ) {
      return {
        _type: 'DocumentReference',
        path: (value as { path: string }).path,
      };
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.serializeValue(item));
    }

    if (typeof value === 'object' && value !== null) {
      return this.serializeData(value as Record<string, unknown>);
    }

    return value;
  }
}
