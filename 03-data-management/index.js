/**
 * Data Management Module
 *
 * Exporta e importa dados do Firebase (Firestore + Storage)
 * para criar snapshots reutilizáveis para novos clientes.
 */

const config = require('./config');
const FirestoreExporter = require('./shared/firestore-exporter');
const FirestoreImporter = require('./shared/firestore-importer');
const StorageExporter = require('./shared/storage-exporter');
const StorageImporter = require('./shared/storage-importer');
const UrlTransformer = require('./shared/url-transformer');
const DemoDataExporter = require('./cli/export-demo-data');

module.exports = {
  config,
  FirestoreExporter,
  FirestoreImporter,
  StorageExporter,
  StorageImporter,
  UrlTransformer,
  DemoDataExporter,
};
