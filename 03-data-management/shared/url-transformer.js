const config = require('../config');

class UrlTransformer {
  constructor(urlMapping = {}) {
    this.urlMapping = urlMapping;
    this.sourceBucket = config.demoProject.storageBucket;
  }

  /**
   * Define o mapeamento de URLs
   * @param {Object} mapping - Mapeamento de URLs (source -> target)
   */
  setUrlMapping(mapping) {
    this.urlMapping = mapping;
  }

  /**
   * Transforma URLs em um documento
   * @param {Object} data - Dados do documento
   * @param {string} targetBucket - Bucket de destino
   * @returns {Object} - Dados com URLs transformadas
   */
  transformDocument(data, targetBucket) {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.transformDocument(item, targetBucket));
    }

    if (typeof data === 'string') {
      return this.transformUrl(data, targetBucket);
    }

    if (typeof data !== 'object') {
      return data;
    }

    const transformed = {};
    for (const [key, value] of Object.entries(data)) {
      transformed[key] = this.transformDocument(value, targetBucket);
    }

    return transformed;
  }

  /**
   * Transforma uma URL específica
   * @param {string} value - Valor que pode conter URL
   * @param {string} targetBucket - Bucket de destino
   * @returns {string} - Valor com URL transformada
   */
  transformUrl(value, targetBucket) {
    if (!value || typeof value !== 'string') {
      return value;
    }

    // Verifica se existe no mapeamento direto
    if (this.urlMapping[value]) {
      return this.urlMapping[value];
    }

    // Padrões de URL do Firebase Storage
    const patterns = [
      // gs:// URL
      new RegExp(`gs://${this.escapeRegex(this.sourceBucket)}/`, 'g'),
      // HTTP URL do Firebase Storage
      new RegExp(
        `https://firebasestorage\\.googleapis\\.com/v0/b/${this.escapeRegex(this.sourceBucket)}/o/`,
        'g'
      ),
      // Outro padrão HTTP
      new RegExp(`https://storage\\.googleapis\\.com/${this.escapeRegex(this.sourceBucket)}/`, 'g'),
    ];

    let result = value;

    // Substitui gs:// URL
    result = result.replace(
      new RegExp(`gs://${this.escapeRegex(this.sourceBucket)}/`, 'g'),
      `gs://${targetBucket}/`
    );

    // Substitui HTTP URL do Firebase Storage
    result = result.replace(
      new RegExp(
        `https://firebasestorage\\.googleapis\\.com/v0/b/${this.escapeRegex(this.sourceBucket)}/o/`,
        'g'
      ),
      `https://firebasestorage.googleapis.com/v0/b/${targetBucket}/o/`
    );

    // Substitui HTTP URL do Google Storage
    result = result.replace(
      new RegExp(`https://storage\\.googleapis\\.com/${this.escapeRegex(this.sourceBucket)}/`, 'g'),
      `https://storage.googleapis.com/${targetBucket}/`
    );

    return result;
  }

  /**
   * Escape caracteres especiais para RegExp
   * @param {string} str - String a escapar
   * @returns {string} - String escapada
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Transforma um documento completo incluindo metadados especiais
   * @param {Object} exportedDoc - Documento exportado com _metadata
   * @param {string} targetBucket - Bucket de destino
   * @returns {Object} - Documento pronto para import
   */
  prepareForImport(exportedDoc, targetBucket) {
    const { _metadata, documents } = exportedDoc;

    const preparedDocuments = {};

    for (const [docId, docData] of Object.entries(documents)) {
      preparedDocuments[docId] = this.transformDocument(docData, targetBucket);
    }

    return {
      _metadata,
      documents: preparedDocuments,
    };
  }
}

module.exports = UrlTransformer;
