const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const logger = require('../../shared/utils/logger');
const config = require('../config');

class FirestoreExporter {
  constructor(firebaseApp) {
    this.app = firebaseApp;
    this.firestore = admin.firestore(firebaseApp);
  }

  /**
   * Exporta uma coleção para JSON
   * @param {string} collectionName - Nome da coleção
   * @returns {Promise<{documents: Object, count: number}>}
   */
  async exportCollection(collectionName) {
    const documents = {};
    let count = 0;

    const snapshot = await this.firestore.collection(collectionName).get();

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Processa os dados para serialização
      documents[doc.id] = this.processDocumentForExport(data);
      count++;
    });

    return { documents, count };
  }

  /**
   * Processa um documento para exportação, convertendo tipos especiais
   * @param {Object} data - Dados do documento
   * @returns {Object} - Dados processados
   */
  processDocumentForExport(data) {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.processDocumentForExport(item));
    }

    if (typeof data !== 'object') {
      return data;
    }

    // Verifica se é um Timestamp do Firestore
    if (data instanceof admin.firestore.Timestamp) {
      return {
        _type: 'timestamp',
        _value: data.toDate().toISOString(),
      };
    }

    // Verifica se é um GeoPoint
    if (data instanceof admin.firestore.GeoPoint) {
      return {
        _type: 'geopoint',
        _latitude: data.latitude,
        _longitude: data.longitude,
      };
    }

    // Verifica se é uma DocumentReference
    if (data instanceof admin.firestore.DocumentReference) {
      return {
        _type: 'reference',
        _path: data.path,
      };
    }

    // Objeto normal - processa recursivamente
    const processed = {};
    for (const [key, value] of Object.entries(data)) {
      processed[key] = this.processDocumentForExport(value);
    }

    return processed;
  }

  /**
   * Exporta todas as coleções configuradas
   * @param {string} outputDir - Diretório de saída
   * @returns {Promise<Object>} - Resumo da exportação
   */
  async exportAllCollections(outputDir) {
    const firestoreDir = path.join(outputDir, 'firestore');

    // Cria diretório se não existir
    if (!fs.existsSync(firestoreDir)) {
      fs.mkdirSync(firestoreDir, { recursive: true });
    }

    const summary = {
      collections: {},
      totalDocuments: 0,
      exportedAt: new Date().toISOString(),
    };

    logger.info(`Exportando ${config.collections.length} coleções...`);

    for (const collectionName of config.collections) {
      logger.startSpinner(`Exportando ${collectionName}...`);

      try {
        const { documents, count } = await this.exportCollection(collectionName);

        // Cria objeto com metadados
        const exportData = {
          _metadata: {
            collection: collectionName,
            exportedAt: new Date().toISOString(),
            documentCount: count,
          },
          documents,
        };

        // Salva arquivo JSON
        const filePath = path.join(firestoreDir, `${collectionName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8');

        summary.collections[collectionName] = {
          documentCount: count,
          filePath: `firestore/${collectionName}.json`,
        };
        summary.totalDocuments += count;

        logger.succeedSpinner(`${collectionName}: ${count} documentos exportados`);
      } catch (error) {
        logger.failSpinner(`Erro ao exportar ${collectionName}: ${error.message}`);
        summary.collections[collectionName] = {
          error: error.message,
        };
      }
    }

    return summary;
  }
}

module.exports = FirestoreExporter;
