#!/usr/bin/env node

/**
 * CLI para exportar dados do Firebase Demo Project
 * Exporta todas as coleções do Firestore e arquivos do Storage
 *
 * Uso: npm run export-demo
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Carrega variáveis de ambiente
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const logger = require('../../shared/utils/logger');
const config = require('../config');
const FirestoreExporter = require('../shared/firestore-exporter');
const StorageExporter = require('../shared/storage-exporter');

class DemoDataExporter {
  constructor() {
    this.app = null;
    this.outputDir = config.snapshotDir;
  }

  /**
   * Inicializa conexão com Firebase
   */
  async initializeFirebase() {
    logger.startSpinner('Conectando ao Firebase Demo Project...');

    try {
      let serviceAccountPath =
        process.env.MASTER_FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;

      if (!serviceAccountPath) {
        throw new Error(
          'MASTER_FIREBASE_SERVICE_ACCOUNT ou GOOGLE_APPLICATION_CREDENTIALS não configurado'
        );
      }

      // Expande variáveis de ambiente
      serviceAccountPath = serviceAccountPath.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
        return process.env[varName] || match;
      });

      // Resolve caminho relativo
      if (!path.isAbsolute(serviceAccountPath)) {
        serviceAccountPath = path.resolve(__dirname, '../..', serviceAccountPath);
      }

      const serviceAccount = require(serviceAccountPath);

      this.app = admin.initializeApp(
        {
          credential: admin.credential.cert(serviceAccount),
          projectId: config.demoProject.projectId,
          storageBucket: config.demoProject.storageBucket,
        },
        'demo-exporter'
      );

      logger.succeedSpinner(`Conectado ao projeto: ${config.demoProject.projectId}`);
    } catch (error) {
      logger.failSpinner(`Erro ao conectar: ${error.message}`);
      throw error;
    }
  }

  /**
   * Prepara diretório de saída
   */
  prepareOutputDir() {
    logger.startSpinner('Preparando diretório de saída...');

    // Limpa diretório existente
    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true });
    }

    // Cria estrutura de diretórios
    fs.mkdirSync(path.join(this.outputDir, 'firestore'), { recursive: true });
    fs.mkdirSync(path.join(this.outputDir, 'storage'), { recursive: true });

    logger.succeedSpinner(`Diretório preparado: ${this.outputDir}`);
  }

  /**
   * Exporta dados do Firestore
   */
  async exportFirestore() {
    logger.section('Exportando Firestore');

    const exporter = new FirestoreExporter(this.app);
    return await exporter.exportAllCollections(this.outputDir);
  }

  /**
   * Exporta arquivos do Storage
   */
  async exportStorage() {
    logger.section('Exportando Storage');

    const exporter = new StorageExporter(this.app);
    return await exporter.exportAllPaths(this.outputDir);
  }

  /**
   * Gera manifest consolidado
   */
  generateManifest(firestoreSummary, storageSummary) {
    logger.startSpinner('Gerando manifest...');

    const manifest = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      sourceProject: {
        projectId: config.demoProject.projectId,
        storageBucket: config.demoProject.storageBucket,
      },
      firestore: {
        collections: firestoreSummary.collections,
        totalDocuments: firestoreSummary.totalDocuments,
      },
      storage: {
        paths: storageSummary.paths,
        totalFiles: storageSummary.totalFiles,
        totalSizeBytes: storageSummary.totalSizeBytes,
      },
    };

    const manifestPath = path.join(this.outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    logger.succeedSpinner('Manifest gerado');
    return manifest;
  }

  /**
   * Executa exportação completa
   */
  async run() {
    logger.section('Export Demo Data');
    logger.info('Exportando dados do Firebase Demo Project para snapshot local');
    console.log('');

    const startTime = Date.now();

    try {
      // 1. Inicializa Firebase
      await this.initializeFirebase();

      // 2. Prepara diretório
      this.prepareOutputDir();

      // 3. Exporta Firestore
      const firestoreSummary = await this.exportFirestore();

      // 4. Exporta Storage
      const storageSummary = await this.exportStorage();

      // 5. Gera manifest
      const manifest = this.generateManifest(firestoreSummary, storageSummary);

      // Resumo final
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('');
      logger.section('Exportação Concluída');
      logger.success(`Tempo total: ${elapsed}s`);
      logger.success(`Coleções: ${Object.keys(manifest.firestore.collections).length}`);
      logger.success(`Documentos: ${manifest.firestore.totalDocuments}`);
      logger.success(`Arquivos Storage: ${manifest.storage.totalFiles}`);
      logger.success(`Tamanho total: ${this.formatBytes(manifest.storage.totalSizeBytes)}`);
      logger.success(`Snapshot salvo em: ${this.outputDir}`);

      return manifest;
    } catch (error) {
      logger.error(`Exportação falhou: ${error.message}`);
      throw error;
    } finally {
      // Cleanup
      if (this.app) {
        await this.app.delete();
      }
    }
  }

  /**
   * Formata bytes para exibição
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Executa se chamado diretamente
if (require.main === module) {
  const exporter = new DemoDataExporter();
  exporter
    .run()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error(error.message);
      process.exit(1);
    });
}

module.exports = DemoDataExporter;
