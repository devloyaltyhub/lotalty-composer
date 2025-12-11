const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const logger = require('../../shared/utils/logger');
const config = require('../config');
const UrlTransformer = require('./url-transformer');

class FirestoreImporter {
  constructor(firebaseApp, targetBucket) {
    this.app = firebaseApp;
    this.firestore = admin.firestore(firebaseApp);
    this.targetBucket = targetBucket;
    this.urlTransformer = new UrlTransformer();
  }

  /**
   * Define o mapeamento de URLs (após import do Storage)
   * @param {Object} urlMapping - Mapeamento de URLs
   */
  setUrlMapping(urlMapping) {
    this.urlTransformer.setUrlMapping(urlMapping);
  }

  /**
   * Carrega dados de uma coleção do snapshot
   * @param {string} collectionName - Nome da coleção
   * @returns {Object|null} - Dados da coleção ou null se não existir
   */
  loadCollectionData(collectionName) {
    const filePath = path.join(config.snapshotDir, 'firestore', `${collectionName}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  /**
   * Processa tipos especiais para import (Timestamps, GeoPoints, References)
   * @param {Object} data - Dados do documento
   * @returns {Object} - Dados processados
   */
  processSpecialTypes(data) {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.processSpecialTypes(item));
    }

    if (typeof data !== 'object') {
      return data;
    }

    // Verifica se é um tipo especial serializado
    if (data._type === 'timestamp' && data._value) {
      return admin.firestore.Timestamp.fromDate(new Date(data._value));
    }

    if (data._type === 'geopoint' && data._latitude !== undefined && data._longitude !== undefined) {
      return new admin.firestore.GeoPoint(data._latitude, data._longitude);
    }

    if (data._type === 'reference' && data._path) {
      return this.firestore.doc(data._path);
    }

    // Objeto normal - processa recursivamente
    const processed = {};
    for (const [key, value] of Object.entries(data)) {
      processed[key] = this.processSpecialTypes(value);
    }

    return processed;
  }

  /**
   * Importa uma coleção do snapshot
   * @param {string} collectionName - Nome da coleção
   * @returns {Promise<{success: boolean, count: number}>}
   */
  async importCollection(collectionName) {
    const data = this.loadCollectionData(collectionName);

    if (!data || !data.documents) {
      return { success: false, count: 0, error: 'Dados não encontrados' };
    }

    const BATCH_SIZE = 500;
    let batch = this.firestore.batch();
    let count = 0;
    let batchCount = 0;

    for (const [docId, docData] of Object.entries(data.documents)) {
      // Transforma URLs para o novo bucket
      const transformedData = this.urlTransformer.transformDocument(docData, this.targetBucket);

      // Processa tipos especiais
      const processedData = this.processSpecialTypes(transformedData);

      const ref = this.firestore.collection(collectionName).doc(docId);
      batch.set(ref, processedData);
      count++;
      batchCount++;

      // Firestore tem limite de 500 operações por batch
      if (batchCount === BATCH_SIZE) {
        await batch.commit();
        batch = this.firestore.batch(); // Cria novo batch após commit
        batchCount = 0;
      }
    }

    // Commit do restante (apenas se houver operações pendentes)
    if (batchCount > 0) {
      await batch.commit();
    }

    return { success: true, count };
  }

  /**
   * Importa todas as coleções do snapshot
   * @returns {Promise<Object>} - Resumo da importação
   */
  async importAllCollections() {
    const summary = {
      collections: {},
      totalDocuments: 0,
      errors: [],
    };

    logger.info(`Importando ${config.collections.length} coleções do snapshot...`);

    for (const collectionName of config.collections) {
      logger.startSpinner(`Importando ${collectionName}...`);

      try {
        const result = await this.importCollection(collectionName);

        if (result.success) {
          summary.collections[collectionName] = { documentCount: result.count };
          summary.totalDocuments += result.count;
          logger.succeedSpinner(`${collectionName}: ${result.count} documentos importados`);
        } else {
          summary.collections[collectionName] = { error: result.error };
          summary.errors.push({ collection: collectionName, error: result.error });
          logger.failSpinner(`${collectionName}: ${result.error}`);
        }
      } catch (error) {
        summary.collections[collectionName] = { error: error.message };
        summary.errors.push({ collection: collectionName, error: error.message });
        logger.failSpinner(`${collectionName}: ${error.message}`);
      }
    }

    return summary;
  }
}

module.exports = FirestoreImporter;
