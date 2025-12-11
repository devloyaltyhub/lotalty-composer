const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const logger = require('../../shared/utils/logger');

// Import data management modules
const dataManagementConfig = require('../../03-data-management/config');

class DataSeeder {
  constructor(firebaseApp, targetBucket = null) {
    this.app = firebaseApp;
    this.firestore = admin.firestore(firebaseApp);
    this.targetBucket = targetBucket;
    this.snapshotDir = dataManagementConfig.snapshotDir;
  }

  // Check if snapshot exists
  hasSnapshot() {
    const manifestPath = path.join(this.snapshotDir, 'manifest.json');
    return fs.existsSync(manifestPath);
  }

  // Load snapshot manifest
  loadSnapshotManifest() {
    const manifestPath = path.join(this.snapshotDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  // Load collection data from snapshot
  loadSnapshotCollection(collectionName) {
    const filePath = path.join(this.snapshotDir, 'firestore', `${collectionName}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  // Load default data template (fallback)
  loadTemplate() {
    const templatePath = path.join(__dirname, '../../shared/templates', 'default-data.json');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    return JSON.parse(templateContent);
  }

  // Replace template variables
  replaceVariables(data, variables) {
    let dataString = JSON.stringify(data);

    // Replace all variables
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      dataString = dataString.split(placeholder).join(value);
    });

    return JSON.parse(dataString);
  }

  // Convert timestamp placeholders to Firestore timestamps
  processTimestamps(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.processTimestamps(item));
    }

    const processed = {};
    Object.entries(obj).forEach(([key, value]) => {
      if (value === '{{TIMESTAMP}}') {
        processed[key] = admin.firestore.FieldValue.serverTimestamp();
      } else if (typeof value === 'object') {
        processed[key] = this.processTimestamps(value);
      } else {
        processed[key] = value;
      }
    });

    return processed;
  }

  // Seed data to Firestore
  async seedData(variables) {
    logger.startSpinner('Loading default data template...');

    try {
      // Load template
      const template = this.loadTemplate();
      logger.updateSpinner('Replacing variables...');

      // Replace variables
      const data = this.replaceVariables(template, variables);
      logger.updateSpinner('Seeding data to Firestore...');

      // Batch write
      const batch = this.firestore.batch();
      let operationCount = 0;

      // Iterate through collections
      for (const [collectionName, documents] of Object.entries(data)) {
        for (const [docId, docData] of Object.entries(documents)) {
          // Process timestamps
          const processedData = this.processTimestamps(docData);

          const ref = this.firestore.collection(collectionName).doc(docId);
          batch.set(ref, processedData);
          operationCount++;
        }
      }

      // Commit batch
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

  // Seed with default variables (legacy method - uses default-data.json)
  async seedWithDefaults(clientName, businessType = 'restaurant', primaryColor = '#FF5733') {
    const variables = {
      CLIENT_NAME: clientName,
      BUSINESS_TYPE: businessType,
      PRIMARY_COLOR: primaryColor,
      LOGO_URL: '',
      TIMESTAMP: '{{TIMESTAMP}}', // Will be replaced with server timestamp
    };

    return await this.seedData(variables);
  }

  // Process special types from snapshot (Timestamps, GeoPoints, References)
  processSnapshotTypes(data) {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.processSnapshotTypes(item));
    }

    if (typeof data !== 'object') {
      return data;
    }

    // Check for serialized special types
    if (data._type === 'timestamp' && data._value) {
      return admin.firestore.Timestamp.fromDate(new Date(data._value));
    }

    if (data._type === 'geopoint' && data._latitude !== undefined && data._longitude !== undefined) {
      return new admin.firestore.GeoPoint(data._latitude, data._longitude);
    }

    if (data._type === 'reference' && data._path) {
      return this.firestore.doc(data._path);
    }

    // Regular object - process recursively
    const processed = {};
    for (const [key, value] of Object.entries(data)) {
      processed[key] = this.processSnapshotTypes(value);
    }

    return processed;
  }

  // Transform Storage URLs for target bucket
  transformStorageUrls(data, sourceBucket, targetBucket) {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.transformStorageUrls(item, sourceBucket, targetBucket));
    }

    if (typeof data === 'string') {
      // Replace Storage URLs
      let result = data;

      // gs:// URLs
      result = result.replace(
        new RegExp(`gs://${this.escapeRegex(sourceBucket)}/`, 'g'),
        `gs://${targetBucket}/`
      );

      // HTTP Firebase Storage URLs
      result = result.replace(
        new RegExp(
          `https://firebasestorage\\.googleapis\\.com/v0/b/${this.escapeRegex(sourceBucket)}/o/`,
          'g'
        ),
        `https://firebasestorage.googleapis.com/v0/b/${targetBucket}/o/`
      );

      return result;
    }

    if (typeof data !== 'object') {
      return data;
    }

    const transformed = {};
    for (const [key, value] of Object.entries(data)) {
      transformed[key] = this.transformStorageUrls(value, sourceBucket, targetBucket);
    }

    return transformed;
  }

  // Escape regex special characters
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Build URL mapping by reading existing files from target Storage bucket
  // This gets real tokens from files that were already uploaded
  async buildUrlMappingFromStorage(sourceBucket) {
    const storageManifestPath = path.join(this.snapshotDir, 'storage-manifest.json');

    if (!fs.existsSync(storageManifestPath)) {
      return {};
    }

    const storageManifest = JSON.parse(fs.readFileSync(storageManifestPath, 'utf8'));
    const urlMapping = {};
    const bucket = admin.storage(this.app).bucket(this.targetBucket);

    for (const fileInfo of storageManifest.files) {
      try {
        const file = bucket.file(fileInfo.path);
        const [metadata] = await file.getMetadata();
        let token = metadata.metadata?.firebaseStorageDownloadTokens;

        // If no token exists, generate one and set it
        if (!token) {
          token = uuidv4();
          await file.setMetadata({
            metadata: {
              firebaseStorageDownloadTokens: token,
            },
          });
        }

        // Build the old URL (source bucket) - this is what's in the Firestore documents
        const encodedPath = encodeURIComponent(fileInfo.path);
        const oldHttpUrlBase = `https://firebasestorage.googleapis.com/v0/b/${sourceBucket}/o/${encodedPath}`;

        // Build the new URL (target bucket with valid token)
        const newHttpUrl = `https://firebasestorage.googleapis.com/v0/b/${this.targetBucket}/o/${encodedPath}?alt=media&token=${token}`;

        urlMapping[oldHttpUrlBase] = newHttpUrl;
      } catch (error) {
        // File doesn't exist in target bucket - skip it
        logger.warn(`Arquivo não encontrado no Storage: ${fileInfo.path}`);
      }
    }

    return urlMapping;
  }

  // Seed from snapshot (main method for new clients)
  // @param {Object} urlMapping - Mapeamento de URLs do Storage (source -> target com tokens válidos)
  async seedFromSnapshot(urlMapping = {}) {
    if (!this.hasSnapshot()) {
      logger.warn('Snapshot não encontrado. Usando default-data.json como fallback.');
      return await this.seedWithDefaults('Demo Client');
    }

    logger.startSpinner('Carregando snapshot do demo...');

    try {
      const manifest = this.loadSnapshotManifest();
      const sourceBucket = manifest.sourceProject.storageBucket;

      // If no URL mapping was provided but we have a target bucket,
      // build the mapping by reading tokens from existing files in Storage
      let effectiveUrlMapping = urlMapping;
      if (Object.keys(urlMapping).length === 0 && this.targetBucket) {
        logger.updateSpinner('Gerando mapeamento de URLs do Storage...');
        effectiveUrlMapping = await this.buildUrlMappingFromStorage(sourceBucket);
        if (Object.keys(effectiveUrlMapping).length > 0) {
          logger.info(`URL mapping gerado para ${Object.keys(effectiveUrlMapping).length} arquivos`);
        }
      }

      logger.updateSpinner('Importando dados do Firestore...');

      let totalDocuments = 0;
      let totalCollections = 0;

      // Import each collection from snapshot
      for (const collectionName of dataManagementConfig.collections) {
        const collectionData = this.loadSnapshotCollection(collectionName);

        if (!collectionData || !collectionData.documents) {
          logger.warn(`Coleção ${collectionName} não encontrada no snapshot`);
          continue;
        }

        const documents = collectionData.documents;
        const docCount = Object.keys(documents).length;

        if (docCount === 0) {
          continue;
        }

        logger.updateSpinner(`Importando ${collectionName} (${docCount} docs)...`);

        // Use batched writes (max 500 per batch)
        const docEntries = Object.entries(documents);
        const batchSize = 500;

        for (let i = 0; i < docEntries.length; i += batchSize) {
          const batch = this.firestore.batch();
          const batchEntries = docEntries.slice(i, i + batchSize);

          for (const [docId, docData] of batchEntries) {
            // Transform Storage URLs using the mapping
            let processedData = docData;
            if (Object.keys(effectiveUrlMapping).length > 0) {
              // Use URL mapping (with valid tokens)
              processedData = this.applyUrlMapping(docData, effectiveUrlMapping);
            } else if (this.targetBucket) {
              // Last resort fallback: simple bucket replacement (tokens will be invalid)
              processedData = this.transformStorageUrls(docData, sourceBucket, this.targetBucket);
            }

            // Process special types (Timestamps, GeoPoints, References)
            processedData = this.processSnapshotTypes(processedData);

            const ref = this.firestore.collection(collectionName).doc(docId);
            batch.set(ref, processedData);
          }

          await batch.commit();
        }

        totalDocuments += docCount;
        totalCollections++;
      }

      logger.succeedSpinner(
        `Snapshot importado: ${totalDocuments} documentos em ${totalCollections} coleções`
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

  // Build URL mapping by reading actual tokens from Storage files
  // This is a fallback when StorageImporter's urlMapping is not available
  async buildUrlMappingFromStorage(sourceBucket) {
    const urlMapping = {};

    if (!this.targetBucket) {
      return urlMapping;
    }

    try {
      const bucket = admin.storage(this.app).bucket(this.targetBucket);
      const manifest = this.loadSnapshotManifest();

      if (!manifest || !manifest.storage || !manifest.storage.paths) {
        return urlMapping;
      }

      // Read storage-manifest.json to get file list
      const storageManifestPath = path.join(this.snapshotDir, 'storage', 'storage-manifest.json');
      if (!fs.existsSync(storageManifestPath)) {
        return urlMapping;
      }

      const storageManifest = JSON.parse(fs.readFileSync(storageManifestPath, 'utf8'));

      // For each file in the storage manifest, get the actual token from target bucket
      for (const fileMeta of storageManifest.files) {
        const filePath = fileMeta.path;

        try {
          const file = bucket.file(filePath);
          const [metadata] = await file.getMetadata();
          const token = metadata.metadata?.firebaseStorageDownloadTokens;

          if (token) {
            // Build source URL (from demo bucket)
            const sourceUrl = `https://firebasestorage.googleapis.com/v0/b/${sourceBucket}/o/${encodeURIComponent(filePath).replace(/%2F/g, '%2F')}?alt=media&token=${fileMeta.token || 'placeholder'}`;
            const sourceUrlBase = `https://firebasestorage.googleapis.com/v0/b/${sourceBucket}/o/${encodeURIComponent(filePath).replace(/%2F/g, '%2F')}`;

            // Build target URL (with valid token)
            const targetUrl = `https://firebasestorage.googleapis.com/v0/b/${this.targetBucket}/o/${encodeURIComponent(filePath).replace(/%2F/g, '%2F')}?alt=media&token=${token}`;

            // Map both full URL and base URL to target
            urlMapping[sourceUrl] = targetUrl;
            urlMapping[sourceUrlBase] = targetUrl;
          }
        } catch {
          // File might not exist in target bucket yet
        }
      }
    } catch (error) {
      logger.warn(`Falha ao construir mapeamento de URLs: ${error.message}`);
    }

    return urlMapping;
  }

  // Configure test user with correct UID
  // This copies the profile photo to the new UID path and migrates the user document
  async configureTestUser(testUserUid) {
    const demoUserUid = '2GJwqHeoKGgYJTCEjYrbbnydflg1';

    if (!testUserUid || testUserUid === demoUserUid) {
      logger.info('UID do usuário de teste igual ao demo, pulando migração');
      return;
    }

    logger.startSpinner('Configurando usuário de teste...');

    try {
      const bucket = admin.storage(this.app).bucket(this.targetBucket);

      // 1. Copy profile photo from demo UID path to new UID path
      const sourcePhotoPath = `profile_photos/${demoUserUid}.jpg`;
      const targetPhotoPath = `profile_photos/${testUserUid}.jpg`;

      let newProfilePhotoUrl = null;

      try {
        const sourceFile = bucket.file(sourcePhotoPath);
        const [exists] = await sourceFile.exists();

        if (exists) {
          // Generate new token for the copied file
          const newToken = uuidv4();

          // Copy file to new path with new token
          await sourceFile.copy(bucket.file(targetPhotoPath), {
            metadata: {
              metadata: {
                firebaseStorageDownloadTokens: newToken,
              },
            },
          });

          // Build the new URL
          newProfilePhotoUrl = `https://firebasestorage.googleapis.com/v0/b/${this.targetBucket}/o/${encodeURIComponent(targetPhotoPath).replace(/%2F/g, '%2F')}?alt=media&token=${newToken}`;

          logger.updateSpinner('Foto de perfil copiada para novo UID...');
        }
      } catch (error) {
        logger.warn(`Falha ao copiar foto de perfil: ${error.message}`);
      }

      // 2. Get the demo user document
      const demoUserDoc = await this.firestore.collection('Users').doc(demoUserUid).get();

      if (demoUserDoc.exists) {
        const userData = demoUserDoc.data();

        // Update userId to new UID
        userData.userId = testUserUid;

        // Update profilePhoto URL if we copied the photo
        if (newProfilePhotoUrl) {
          userData.profilePhoto = newProfilePhotoUrl;
        }

        // 3. Create new user document with test UID
        await this.firestore.collection('Users').doc(testUserUid).set(userData);

        // 4. Delete the old demo user document
        await this.firestore.collection('Users').doc(demoUserUid).delete();

        logger.updateSpinner('Documento de usuário migrado...');
      }

      // 5. Update related collections (Clients_Score, Consumptions, Notifications)
      // These collections might reference the user by clubId, not userId, so we check first
      const userDoc = await this.firestore.collection('Users').doc(testUserUid).get();
      if (userDoc.exists) {
        const clubId = userDoc.data()?.club?.clubId;

        if (clubId) {
          // Update Clients_Score if it references the old UID
          const clientScoreDoc = await this.firestore.collection('Clients_Score').doc(demoUserUid).get();
          if (clientScoreDoc.exists) {
            const scoreData = clientScoreDoc.data();
            scoreData.id = testUserUid;
            await this.firestore.collection('Clients_Score').doc(testUserUid).set(scoreData);
            await this.firestore.collection('Clients_Score').doc(demoUserUid).delete();
          }
        }
      }

      logger.succeedSpinner(`Usuário de teste configurado: ${testUserUid}`);
    } catch (error) {
      logger.failSpinner('Falha ao configurar usuário de teste');
      throw error;
    }
  }

  // Apply URL mapping from StorageImporter to document data
  applyUrlMapping(data, urlMapping) {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.applyUrlMapping(item, urlMapping));
    }

    if (typeof data === 'string') {
      // Check if this string is a URL that needs mapping
      // Try exact match first
      if (urlMapping[data]) {
        return urlMapping[data];
      }

      // Try matching by base URL (without query params)
      const baseUrl = data.split('?')[0];
      if (urlMapping[baseUrl]) {
        return urlMapping[baseUrl];
      }

      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    const mapped = {};
    for (const [key, value] of Object.entries(data)) {
      mapped[key] = this.applyUrlMapping(value, urlMapping);
    }

    return mapped;
  }

  /**
   * Configura o usuário de teste com UID correto e foto de perfil
   * Deve ser chamado APÓS o seed do Firestore e Storage
   *
   * @param {string} testUserUid - UID do usuário de teste no Authentication
   * @returns {Promise<Object>} - Resultado da configuração
   */
  async configureTestUser(testUserUid) {
    if (!testUserUid) {
      logger.warn('UID do usuário de teste não fornecido, pulando configuração');
      return { success: false, reason: 'no_uid' };
    }

    const demoUserUid = '2GJwqHeoKGgYJTCEjYrbbnydflg1'; // UID do usuário no snapshot
    const bucket = admin.storage(this.app).bucket(this.targetBucket);

    logger.startSpinner('Configurando usuário de teste...');

    try {
      // 1. Copiar foto de perfil para o novo UID
      const oldPhotoPath = `profile_photos/${demoUserUid}.jpg`;
      const newPhotoPath = `profile_photos/${testUserUid}.jpg`;

      const oldFile = bucket.file(oldPhotoPath);
      const newFile = bucket.file(newPhotoPath);

      const [oldExists] = await oldFile.exists();

      let profilePhotoUrl = null;

      if (oldExists) {
        // Copiar arquivo para novo path
        await oldFile.copy(newFile);

        // Gerar token para o novo arquivo
        const token = uuidv4();
        await newFile.setMetadata({
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        });

        // Construir URL
        const encodedPath = encodeURIComponent(newPhotoPath);
        profilePhotoUrl = `https://firebasestorage.googleapis.com/v0/b/${this.targetBucket}/o/${encodedPath}?alt=media&token=${token}`;

        // Deletar arquivo antigo
        await oldFile.delete();

        logger.updateSpinner('Foto de perfil migrada para novo UID');
      }

      // 2. Verificar se existe documento do demo user e migrar para novo UID
      const oldUserRef = this.firestore.collection('Users').doc(demoUserUid);
      const oldUserDoc = await oldUserRef.get();

      if (oldUserDoc.exists) {
        const userData = oldUserDoc.data();

        // Atualizar campos com novo UID
        userData.userId = testUserUid;

        // Atualizar foto de perfil se disponível
        if (profilePhotoUrl) {
          userData.profilePhoto = profilePhotoUrl;
        }

        // Criar documento com novo UID
        const newUserRef = this.firestore.collection('Users').doc(testUserUid);
        await newUserRef.set(userData);

        // Deletar documento antigo
        await oldUserRef.delete();

        logger.succeedSpinner(`Usuário de teste configurado: ${testUserUid}`);

        return {
          success: true,
          oldUid: demoUserUid,
          newUid: testUserUid,
          profilePhotoUrl,
        };
      } else {
        logger.warnSpinner('Documento do usuário demo não encontrado');
        return { success: false, reason: 'demo_user_not_found' };
      }
    } catch (error) {
      logger.failSpinner(`Erro ao configurar usuário de teste: ${error.message}`);
      throw error;
    }
  }
}

module.exports = DataSeeder;

// Allow running directly for testing
if (require.main === module) {
  const testSeed = async () => {
    try {
      // Initialize Firebase (test mode)
      const path = require('path');
      let credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

      // Expand environment variables like $HOME
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
