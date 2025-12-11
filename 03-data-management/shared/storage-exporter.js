const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const logger = require('../../shared/utils/logger');
const config = require('../config');

class StorageExporter {
  constructor(firebaseApp) {
    this.app = firebaseApp;
    this.bucket = admin.storage(firebaseApp).bucket(config.demoProject.storageBucket);
  }

  /**
   * Lista todos os arquivos em um path do Storage
   * @param {string} storagePath - Path no Storage
   * @returns {Promise<Array>} - Lista de arquivos
   */
  async listFiles(storagePath) {
    const [files] = await this.bucket.getFiles({ prefix: storagePath });
    return files.filter((file) => !file.name.endsWith('/')); // Ignora diretórios
  }

  /**
   * Download de um arquivo do Storage
   * @param {Object} file - Objeto do arquivo do Firebase
   * @param {string} localPath - Caminho local para salvar
   * @returns {Promise<Object>} - Metadados do arquivo
   */
  async downloadFile(file, localPath) {
    // Cria diretório se não existir
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Download do arquivo
    await file.download({ destination: localPath });

    // Obtém metadados
    const [metadata] = await file.getMetadata();

    return {
      path: file.name,
      localPath: path.relative(config.snapshotDir, localPath),
      contentType: metadata.contentType || 'application/octet-stream',
      sizeBytes: parseInt(metadata.size, 10),
    };
  }

  /**
   * Exporta todos os arquivos de um path
   * @param {string} storagePath - Path no Storage
   * @param {string} outputDir - Diretório de saída
   * @returns {Promise<Array>} - Lista de arquivos exportados
   */
  async exportPath(storagePath, outputDir) {
    const files = await this.listFiles(storagePath);
    const exportedFiles = [];
    const storageOutputDir = path.join(outputDir, 'storage');

    if (files.length === 0) {
      logger.warn(`Nenhum arquivo encontrado em: ${storagePath}`);
      return exportedFiles;
    }

    // Processa arquivos com concorrência limitada
    const concurrency = config.export.concurrentDownloads;
    const chunks = [];

    for (let i = 0; i < files.length; i += concurrency) {
      chunks.push(files.slice(i, i + concurrency));
    }

    let processed = 0;
    for (const chunk of chunks) {
      const promises = chunk.map(async (file) => {
        const localPath = path.join(storageOutputDir, file.name);

        try {
          const fileInfo = await this.downloadFile(file, localPath);
          processed++;
          logger.updateSpinner(`${storagePath}: ${processed}/${files.length} arquivos`);
          return fileInfo;
        } catch (error) {
          logger.warn(`Erro ao baixar ${file.name}: ${error.message}`);
          return null;
        }
      });

      const results = await Promise.all(promises);
      exportedFiles.push(...results.filter((r) => r !== null));
    }

    return exportedFiles;
  }

  /**
   * Exporta todos os paths configurados
   * @param {string} outputDir - Diretório de saída
   * @returns {Promise<Object>} - Manifest do Storage
   */
  async exportAllPaths(outputDir) {
    const manifest = {
      exportedAt: new Date().toISOString(),
      sourceProject: config.demoProject.projectId,
      sourceBucket: config.demoProject.storageBucket,
      totalFiles: 0,
      totalSizeBytes: 0,
      paths: {},
      files: [],
    };

    logger.info(`Exportando ${config.storagePaths.length} paths do Storage...`);

    for (const storagePath of config.storagePaths) {
      logger.startSpinner(`Exportando ${storagePath}...`);

      try {
        const files = await this.exportPath(storagePath, outputDir);

        const pathSize = files.reduce((sum, f) => sum + f.sizeBytes, 0);

        manifest.paths[storagePath] = {
          fileCount: files.length,
          totalSizeBytes: pathSize,
        };

        manifest.files.push(...files);
        manifest.totalFiles += files.length;
        manifest.totalSizeBytes += pathSize;

        logger.succeedSpinner(
          `${storagePath}: ${files.length} arquivos (${this.formatBytes(pathSize)})`
        );
      } catch (error) {
        logger.failSpinner(`Erro ao exportar ${storagePath}: ${error.message}`);
        manifest.paths[storagePath] = { error: error.message };
      }
    }

    // Salva manifest
    const manifestPath = path.join(outputDir, 'storage-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    return manifest;
  }

  /**
   * Formata bytes para exibição
   * @param {number} bytes - Quantidade de bytes
   * @returns {string} - String formatada
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = StorageExporter;
