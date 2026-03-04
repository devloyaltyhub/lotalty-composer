#!/usr/bin/env node
/**
 * Auditoria de Storage: cruza URLs do Firestore com arquivos reais no Storage
 *
 * Uso: node audit-storage.js <projectId> <storageBucket>
 * Exemplo: node audit-storage.js na-rede-loyalty-hub-club-4948 na-rede-loyalty-hub-club-4948.firebasestorage.app
 */

const path = require('path');
const admin = require('firebase-admin');
const { WHITE_LABEL_APP_ROOT } = require('../shared/utils/paths');

const COLLECTIONS_WITH_IMAGES = [
  { name: 'Products', fields: ['image'] },
  { name: 'Team_Members', fields: ['image'] },
  { name: 'Campaigns', fields: ['image'] },
  { name: 'Happy_Hours', fields: ['image'] },
  { name: 'Our_Story', fields: ['photos'] },
  { name: 'Image_Mappings', fields: ['fileName'] },
];

const STORAGE_PATHS = ['gallery', 'profile_photos', 'Team_Members', 'Happy_Hours', 'Campaigns', 'Products'];

class StorageAuditor {
  constructor(projectId, storageBucket) {
    this.projectId = projectId;
    this.storageBucket = storageBucket;
    this.storageFiles = new Set();
    this.brokenUrls = [];
    this.validUrls = [];
  }

  async initialize() {
    const serviceAccountPath = path.join(WHITE_LABEL_APP_ROOT, 'service-account.json');
    const serviceAccount = require(serviceAccountPath);

    this.app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: this.projectId,
      storageBucket: this.storageBucket,
    });

    this.db = admin.firestore(this.app);
    this.bucket = admin.storage(this.app).bucket();
  }

  async listAllStorageFiles() {
    console.log('\n1. Listando arquivos existentes no Storage...\n');

    for (const storagePath of STORAGE_PATHS) {
      try {
        const [files] = await this.bucket.getFiles({ prefix: `${storagePath}/` });
        for (const file of files) {
          this.storageFiles.add(file.name);
        }
        console.log(`   ${storagePath}/: ${files.length} arquivos`);
      } catch (err) {
        console.log(`   ${storagePath}/: erro ao listar - ${err.message}`);
      }
    }

    console.log(`\n   Total de arquivos no Storage: ${this.storageFiles.size}`);
  }

  extractStoragePath(url) {
    if (!url || typeof url !== 'string') return null;
    if (!url.includes('firebasestorage.googleapis.com')) return null;

    try {
      const match = url.match(/\/o\/(.+?)(\?|$)/);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    } catch {
      // ignore
    }
    return null;
  }

  async scanFirestoreCollections() {
    console.log('\n2. Varrendo coleções do Firestore...\n');

    for (const collection of COLLECTIONS_WITH_IMAGES) {
      await this.scanCollection(collection);
    }
  }

  async scanCollection({ name, fields }) {
    try {
      const snapshot = await this.db.collection(name).get();

      if (snapshot.empty) {
        console.log(`   ${name}: vazia`);
        return;
      }

      let broken = 0;
      let valid = 0;
      let noImage = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const urls = this.extractUrlsFromDoc(data, fields);

        for (const url of urls) {
          const storagePath = this.extractStoragePath(url);

          if (!storagePath) {
            continue;
          }

          if (this.storageFiles.has(storagePath)) {
            valid++;
            this.validUrls.push({ collection: name, docId: doc.id, url, storagePath });
          } else {
            broken++;
            this.brokenUrls.push({ collection: name, docId: doc.id, url, storagePath });
          }
        }

        const hasAnyUrl = urls.length > 0;
        if (!hasAnyUrl) {
          noImage++;
        }
      }

      const total = snapshot.size;
      console.log(`   ${name}: ${total} docs | ${valid} OK | ${broken} QUEBRADAS | ${noImage} sem imagem`);
    } catch (error) {
      console.log(`   ${name}: erro - ${error.message}`);
    }
  }

  extractUrlsFromDoc(data, fields) {
    const urls = [];

    for (const field of fields) {
      const value = data[field];
      if (!value) continue;

      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item.includes('firebasestorage')) {
            urls.push(item);
          }
        }
      } else if (typeof value === 'string' && value.includes('firebasestorage')) {
        urls.push(value);
      }
    }

    return urls;
  }

  printReport() {
    console.log('\n' + '='.repeat(70));
    console.log('RELATÓRIO DE AUDITORIA DO STORAGE');
    console.log('='.repeat(70));

    console.log(`\nArquivos no Storage:    ${this.storageFiles.size}`);
    console.log(`URLs válidas:           ${this.validUrls.length}`);
    console.log(`URLs QUEBRADAS:         ${this.brokenUrls.length}`);

    if (this.brokenUrls.length > 0) {
      console.log('\n' + '-'.repeat(70));
      console.log('URLS QUEBRADAS (arquivo não existe no Storage):');
      console.log('-'.repeat(70));

      const grouped = {};
      for (const item of this.brokenUrls) {
        if (!grouped[item.collection]) grouped[item.collection] = [];
        grouped[item.collection].push(item);
      }

      for (const [collection, items] of Object.entries(grouped)) {
        console.log(`\n  ${collection} (${items.length} quebradas):`);
        for (const item of items) {
          console.log(`    - Doc: ${item.docId}`);
          console.log(`      Path: ${item.storagePath}`);
        }
      }
    }

    if (this.brokenUrls.length > 0) {
      console.log('\n' + '-'.repeat(70));
      console.log('ARQUIVOS NECESSÁRIOS PARA RESTAURAÇÃO:');
      console.log('-'.repeat(70));

      const uniquePaths = [...new Set(this.brokenUrls.map(b => b.storagePath))];
      for (const p of uniquePaths) {
        console.log(`  ${p}`);
      }
      console.log(`\n  Total: ${uniquePaths.length} arquivos precisam ser restaurados`);
    }

    console.log('\n' + '='.repeat(70));
  }

  async cleanup() {
    await this.app.delete();
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Uso: node audit-storage.js <projectId> <storageBucket>');
    console.log('Exemplo: node audit-storage.js na-rede-loyalty-hub-club-4948 na-rede-loyalty-hub-club-4948.firebasestorage.app');
    process.exit(1);
  }

  const [projectId, storageBucket] = args;

  console.log('='.repeat(70));
  console.log('AUDITORIA DE STORAGE - Cruzamento Firestore x Storage');
  console.log('='.repeat(70));
  console.log(`\n  Project:  ${projectId}`);
  console.log(`  Bucket:   ${storageBucket}`);

  const auditor = new StorageAuditor(projectId, storageBucket);

  try {
    await auditor.initialize();
    await auditor.listAllStorageFiles();
    await auditor.scanFirestoreCollections();
    auditor.printReport();
  } catch (error) {
    console.error('\nErro:', error.message);
    process.exit(1);
  } finally {
    await auditor.cleanup();
  }
}

main();
