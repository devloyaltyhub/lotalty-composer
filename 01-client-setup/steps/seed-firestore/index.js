const path = require('path');
const admin = require('firebase-admin');
const logger = require('../../../shared/utils/logger');

const dataManagementConfig = require('../../../03-data-management/config');
const SnapshotLoader = require('./snapshot-loader');
const DataTransformer = require('./data-transformer');
const UrlMapper = require('./url-mapper');
const UserConfig = require('./user-config');

class DataSeeder {
  constructor(firebaseApp, targetBucket = null) {
    this.app = firebaseApp;
    this.firestore = admin.firestore(firebaseApp);
    this.targetBucket = targetBucket;
    this.snapshotDir = dataManagementConfig.snapshotDir;

    this.snapshotLoader = new SnapshotLoader(this.snapshotDir);
    this.dataTransformer = new DataTransformer(this.firestore);
    this.urlMapper = new UrlMapper(this.app, this.targetBucket, this.snapshotDir);
    this.userConfig = new UserConfig(this.app, this.firestore, this.targetBucket);
  }

  hasSnapshot() {
    return this.snapshotLoader.hasSnapshot();
  }

  loadSnapshotManifest() {
    return this.snapshotLoader.loadSnapshotManifest();
  }

  loadSnapshotCollection(collectionName) {
    return this.snapshotLoader.loadSnapshotCollection(collectionName);
  }

  loadTemplate() {
    const templatePath = path.join(__dirname, '../../../shared/templates', 'default-data.json');
    return this.snapshotLoader.loadTemplate(templatePath);
  }

  async seedData(variables) {
    logger.startSpinner('Loading default data template...');

    try {
      const template = this.loadTemplate();
      logger.updateSpinner('Replacing variables...');

      const data = this.dataTransformer.replaceVariables(template, variables);
      logger.updateSpinner('Seeding data to Firestore...');

      const batch = this.firestore.batch();
      let operationCount = 0;

      for (const [collectionName, documents] of Object.entries(data)) {
        for (const [docId, docData] of Object.entries(documents)) {
          const processedData = this.dataTransformer.processTimestamps(docData);

          const ref = this.firestore.collection(collectionName).doc(docId);
          batch.set(ref, processedData);
          operationCount++;
        }
      }

      await batch.commit();

      logger.succeedSpinner(
        `Seeded ${operationCount} documents across ${Object.keys(data).length} collections`
      );

      return {
        success: true,
        collections: Object.keys(data).length,
        documents: operationCount,
      };
    } catch (error) {
      logger.failSpinner('Failed to seed data');
      throw error;
    }
  }

  async seedWithDefaults(clientName, businessType = 'restaurant', primaryColor = '#FF5733') {
    const variables = {
      CLIENT_NAME: clientName,
      BUSINESS_TYPE: businessType,
      PRIMARY_COLOR: primaryColor,
      LOGO_URL: '',
      TIMESTAMP: '{{TIMESTAMP}}',
    };

    return await this.seedData(variables);
  }

  async seedFromSnapshot(urlMapping = {}) {
    if (!this.hasSnapshot()) {
      logger.warn('Snapshot nao encontrado. Usando default-data.json como fallback.');
      return await this.seedWithDefaults('Demo Client');
    }

    logger.startSpinner('Carregando snapshot do demo...');

    try {
      const manifest = this.loadSnapshotManifest();
      const sourceBucket = manifest.sourceProject.storageBucket;

      let effectiveUrlMapping = urlMapping;
      if (Object.keys(urlMapping).length === 0 && this.targetBucket) {
        logger.updateSpinner('Gerando mapeamento de URLs do Storage...');
        effectiveUrlMapping = await this.urlMapper.buildUrlMappingFromStorage(sourceBucket);
        if (Object.keys(effectiveUrlMapping).length > 0) {
          logger.info(`URL mapping gerado para ${Object.keys(effectiveUrlMapping).length} arquivos`);
        }
      }

      logger.updateSpinner('Importando dados do Firestore...');

      let totalDocuments = 0;
      let totalCollections = 0;

      const seedSkipCollections = ['Users_Admin'];
      const collectionsToSeed = dataManagementConfig.collections.filter(
        (c) => !seedSkipCollections.includes(c)
      );

      for (const collectionName of collectionsToSeed) {
        const collectionData = this.loadSnapshotCollection(collectionName);

        if (!collectionData || !collectionData.documents) {
          logger.warn(`Colecao ${collectionName} nao encontrada no snapshot`);
          continue;
        }

        const documents = collectionData.documents;
        const docCount = Object.keys(documents).length;

        if (docCount === 0) {
          continue;
        }

        logger.updateSpinner(`Importando ${collectionName} (${docCount} docs)...`);

        const docEntries = Object.entries(documents);
        const batchSize = 500;

        for (let i = 0; i < docEntries.length; i += batchSize) {
          const batch = this.firestore.batch();
          const batchEntries = docEntries.slice(i, i + batchSize);

          for (const [docId, docData] of batchEntries) {
            let processedData = docData;
            if (Object.keys(effectiveUrlMapping).length > 0) {
              processedData = this.dataTransformer.applyUrlMapping(docData, effectiveUrlMapping);
            } else if (this.targetBucket) {
              processedData = this.dataTransformer.transformStorageUrls(docData, sourceBucket, this.targetBucket);
            }

            processedData = this.dataTransformer.processSnapshotTypes(processedData);

            const ref = this.firestore.collection(collectionName).doc(docId);
            batch.set(ref, processedData);
          }

          await batch.commit();
        }

        totalDocuments += docCount;
        totalCollections++;
      }

      logger.succeedSpinner(
        `Snapshot importado: ${totalDocuments} documentos em ${totalCollections} colecoes`
      );

      return {
        success: true,
        collections: totalCollections,
        documents: totalDocuments,
        source: 'snapshot',
      };
    } catch (error) {
      logger.failSpinner('Falha ao importar snapshot');
      throw error;
    }
  }

  async buildUrlMappingFromStorage(sourceBucket) {
    return this.urlMapper.buildUrlMappingFromStorage(sourceBucket);
  }

  async configureTestUser(testUserUid) {
    return this.userConfig.configureTestUser(testUserUid);
  }
}

module.exports = DataSeeder;

if (require.main === module) {
  const testSeed = async () => {
    try {
      let credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

      credPath = credPath.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
        return process.env[varName] || match;
      });

      const serviceAccount = require(credPath);
      const projectId = process.argv[2] || 'test-project';

      const app = admin.initializeApp(
        {
          credential: admin.credential.cert(serviceAccount),
          projectId: projectId,
        },
        'seeder-test'
      );

      const seeder = new DataSeeder(app);
      await seeder.seedWithDefaults('Test Client', 'restaurant', '#FF5733');

      logger.success('Seeding test completed!');
      process.exit(0);
    } catch (error) {
      logger.error(`Seeding test failed: ${error.message}`);
      process.exit(1);
    }
  };

  testSeed();
}
