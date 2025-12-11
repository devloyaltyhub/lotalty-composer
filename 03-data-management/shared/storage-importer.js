const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const logger = require('../../shared/utils/logger');
const config = require('../config');

class StorageImporter {
  constructor(firebaseApp, targetBucket) {
    this.app = firebaseApp;
    this.bucket = admin.storage(firebaseApp).bucket(targetBucket);
    this.targetBucket = targetBucket;
  }

  /**
   * Carrega o manifest do Storage
   * @returns {Object} - Manifest do Storage
   */
  loadManifest() {
    const manifestPath = path.join(config.snapshotDir, 'storage-manifest.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest não encontrado: ${manifestPath}`);
    }

    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  /**
   * Upload de um arquivo para o Storage
   * @param {Object} fileInfo - Informações do arquivo do manifest
   * @returns {Promise<{gsUrl: string, httpUrl: string, token: string}>} - URLs e token do arquivo
   */
  async uploadFile(fileInfo) {
    const localPath = path.join(config.snapshotDir, fileInfo.localPath);

    if (!fs.existsSync(localPath)) {
      throw new Error(`Arquivo local não encontrado: ${localPath}`);
    }

    // Gera token UUID para acesso público via Firebase Storage URL
    const downloadToken = uuidv4();

    await this.bucket.upload(localPath, {
      destination: fileInfo.path,
      metadata: {
        contentType: fileInfo.contentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    // Retorna URLs do arquivo no novo bucket
    return {
      gsUrl: `gs://${this.targetBucket}/${fileInfo.path}`,
      httpUrl: this.buildFirestoreStorageUrl(this.targetBucket, fileInfo.path, downloadToken),
      token: downloadToken,
    };
  }

  /**
   * Importa todos os arquivos do snapshot
   * @returns {Promise<Object>} - Mapeamento de URLs (source -> target)
   */
  async importAll() {
    const manifest = this.loadManifest();
    const urlMapping = {};

    if (manifest.files.length === 0) {
      logger.warn('Nenhum arquivo para importar');
      return urlMapping;
    }

    logger.info(`Importando ${manifest.files.length} arquivos para ${this.targetBucket}...`);

    // Processa arquivos com concorrência limitada
    const concurrency = config.import.concurrentUploads;
    const chunks = [];

    for (let i = 0; i < manifest.files.length; i += concurrency) {
      chunks.push(manifest.files.slice(i, i + concurrency));
    }

    let processed = 0;
    let errors = 0;

    for (const chunk of chunks) {
      const promises = chunk.map(async (fileInfo) => {
        try {
          const { gsUrl, httpUrl } = await this.uploadFile(fileInfo);

          // Mapeia URL antiga para nova (gs://)
          const oldGsUrl = `gs://${manifest.sourceBucket}/${fileInfo.path}`;
          urlMapping[oldGsUrl] = gsUrl;

          // Mapeia URLs HTTP do Firebase Storage (com qualquer token antigo)
          // Usamos regex para capturar URLs com ou sem token
          const oldHttpUrlBase = this.buildFirestoreStorageUrlBase(manifest.sourceBucket, fileInfo.path);
          urlMapping[oldHttpUrlBase] = httpUrl;

          // Também mapeia a URL original exata do manifest (se tiver token antigo)
          if (fileInfo.originalUrl) {
            urlMapping[fileInfo.originalUrl] = httpUrl;
          }

          processed++;
          logger.updateSpinner(`Storage: ${processed}/${manifest.files.length} arquivos`);

          return { success: true, path: fileInfo.path, newUrl: httpUrl };
        } catch (error) {
          errors++;
          logger.warn(`Erro ao importar ${fileInfo.path}: ${error.message}`);
          return { success: false, path: fileInfo.path, error: error.message };
        }
      });

      await Promise.all(promises);
    }

    logger.info(`Import concluído: ${processed} ok, ${errors} erros`);

    return urlMapping;
  }

  /**
   * Constrói URL HTTP do Firebase Storage com token
   * @param {string} bucket - Nome do bucket
   * @param {string} filePath - Caminho do arquivo
   * @param {string} token - Token de download
   * @returns {string} - URL HTTP com token
   */
  buildFirestoreStorageUrl(bucket, filePath, token) {
    const encodedPath = encodeURIComponent(filePath);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${token}`;
  }

  /**
   * Constrói URL base HTTP do Firebase Storage (sem token, para mapeamento)
   * @param {string} bucket - Nome do bucket
   * @param {string} filePath - Caminho do arquivo
   * @returns {string} - URL HTTP base
   */
  buildFirestoreStorageUrlBase(bucket, filePath) {
    const encodedPath = encodeURIComponent(filePath);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}`;
  }
}

module.exports = StorageImporter;
