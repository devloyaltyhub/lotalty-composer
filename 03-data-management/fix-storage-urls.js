#!/usr/bin/env node
/**
 * Script para corrigir URLs de Storage no Firestore
 *
 * Este script:
 * 1. Lista todos os arquivos no Storage do cliente
 * 2. Gera tokens de download válidos para cada arquivo
 * 3. Atualiza todos os documentos do Firestore com as novas URLs
 *
 * Uso: node fix-storage-urls.js <projectId> <databaseId> <storageBucket>
 * Exemplo: node fix-storage-urls.js na-rede-loyalty-hub-club-4948 narede na-rede-loyalty-hub-club-4948.firebasestorage.app
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const { WHITE_LABEL_APP_ROOT } = require('../shared/utils/paths');

// Coleções que podem ter URLs de imagens
const COLLECTIONS_WITH_IMAGES = [
  'Products',
  'Team_Members',
  'Campaigns',
  'Happy_Hours',
  'Our_Story',
  'Image_Mappings',
  'Gallery',
];

// Campos que podem conter URLs de imagens
const IMAGE_FIELDS = ['image', 'imageUrl', 'photo', 'photos', 'fileName', 'url'];

class StorageUrlFixer {
  constructor(projectId, databaseId, storageBucket) {
    this.projectId = projectId;
    this.databaseId = databaseId;
    this.storageBucket = storageBucket;
    this.urlMapping = {};
  }

  async initialize() {
    // Carrega service account do white_label_app
    const serviceAccountPath = path.join(WHITE_LABEL_APP_ROOT, 'service-account.json');
    const serviceAccount = require(serviceAccountPath);

    this.app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: this.projectId,
      storageBucket: this.storageBucket,
    });

    this.db = admin.firestore(this.app);
    if (this.databaseId && this.databaseId !== '(default)') {
      this.db.settings({ databaseId: this.databaseId });
    }

    this.bucket = admin.storage(this.app).bucket();
  }

  /**
   * Lista todos os arquivos no Storage e gera tokens válidos
   */
  async generateTokensForAllFiles() {
    console.log('📦 Listando arquivos no Storage...');

    const [files] = await this.bucket.getFiles({ prefix: 'gallery/' });
    console.log(`   Encontrados ${files.length} arquivos em gallery/`);

    for (const file of files) {
      await this.ensureFileHasToken(file);
    }

    // Também processar profile_photos se existir
    try {
      const [profileFiles] = await this.bucket.getFiles({ prefix: 'profile_photos/' });
      console.log(`   Encontrados ${profileFiles.length} arquivos em profile_photos/`);

      for (const file of profileFiles) {
        await this.ensureFileHasToken(file);
      }
    } catch (err) {
      console.log('   Nenhum arquivo em profile_photos/');
    }

    console.log(`\n✅ Mapeamento criado para ${Object.keys(this.urlMapping).length} arquivos`);
  }

  /**
   * Garante que um arquivo tem token de download e cria mapeamento
   */
  async ensureFileHasToken(file) {
    const [metadata] = await file.getMetadata();
    let token = metadata.metadata?.firebaseStorageDownloadTokens;

    if (!token) {
      // Gera novo token
      token = uuidv4();
      await file.setMetadata({
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      });
      console.log(`   🔑 Token gerado para: ${file.name}`);
    } else {
      console.log(`   ✓ Token existente para: ${file.name}`);
    }

    // Cria URL válida
    const encodedPath = encodeURIComponent(file.name);
    const validUrl = `https://firebasestorage.googleapis.com/v0/b/${this.storageBucket}/o/${encodedPath}?alt=media&token=${token}`;

    // Mapeia várias formas possíveis da URL antiga
    const baseUrl = `https://firebasestorage.googleapis.com/v0/b/${this.storageBucket}/o/${encodedPath}`;
    this.urlMapping[baseUrl] = validUrl;
    this.urlMapping[file.name] = validUrl;
  }

  /**
   * Atualiza documentos do Firestore com URLs válidas
   */
  async updateFirestoreDocuments() {
    console.log('\n📝 Atualizando documentos do Firestore...');

    let totalUpdated = 0;

    for (const collectionName of COLLECTIONS_WITH_IMAGES) {
      const updated = await this.updateCollection(collectionName);
      totalUpdated += updated;
    }

    console.log(`\n✅ Total de documentos atualizados: ${totalUpdated}`);
    return totalUpdated;
  }

  /**
   * Atualiza uma coleção específica
   */
  async updateCollection(collectionName) {
    try {
      const snapshot = await this.db.collection(collectionName).get();

      if (snapshot.empty) {
        return 0;
      }

      console.log(`\n   📁 ${collectionName}: ${snapshot.size} documentos`);

      let updated = 0;
      const batch = this.db.batch();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const newData = this.transformUrls(data);

        // Verifica se houve mudança
        if (JSON.stringify(data) !== JSON.stringify(newData)) {
          batch.update(doc.ref, newData);
          updated++;
          console.log(`      ✏️  Atualizando: ${doc.id}`);
        }
      }

      if (updated > 0) {
        await batch.commit();
        console.log(`      ✅ ${updated} documentos atualizados`);
      }

      return updated;
    } catch (error) {
      console.log(`      ⚠️  Erro em ${collectionName}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Transforma URLs em um objeto recursivamente
   */
  transformUrls(data) {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.transformUrls(item));
    }

    if (typeof data === 'string') {
      return this.transformUrl(data);
    }

    if (typeof data !== 'object') {
      return data;
    }

    // Verifica se é um Timestamp do Firestore
    if (data instanceof admin.firestore.Timestamp) {
      return data;
    }

    const transformed = {};
    for (const [key, value] of Object.entries(data)) {
      transformed[key] = this.transformUrls(value);
    }
    return transformed;
  }

  /**
   * Transforma uma URL individual
   */
  transformUrl(url) {
    if (!url.includes('firebasestorage.googleapis.com')) {
      return url;
    }

    // Extrai base URL (sem query params)
    const baseUrl = url.split('?')[0];

    if (this.urlMapping[baseUrl]) {
      return this.urlMapping[baseUrl];
    }

    return url;
  }

  async cleanup() {
    await this.app.delete();
  }
}

// Execução principal
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Uso: node fix-storage-urls.js <projectId> <databaseId> <storageBucket>');
    console.log('Exemplo: node fix-storage-urls.js na-rede-loyalty-hub-club-4948 narede na-rede-loyalty-hub-club-4948.firebasestorage.app');
    process.exit(1);
  }

  const [projectId, databaseId, storageBucket] = args;

  console.log('🔧 Iniciando correção de URLs do Storage\n');
  console.log(`   Project ID: ${projectId}`);
  console.log(`   Database ID: ${databaseId}`);
  console.log(`   Storage Bucket: ${storageBucket}\n`);

  const fixer = new StorageUrlFixer(projectId, databaseId, storageBucket);

  try {
    await fixer.initialize();
    await fixer.generateTokensForAllFiles();
    await fixer.updateFirestoreDocuments();

    console.log('\n🎉 Correção concluída com sucesso!');
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await fixer.cleanup();
  }
}

main();
