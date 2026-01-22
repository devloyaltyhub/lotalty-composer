const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const logger = require('../../../shared/utils/logger');

class UrlMapper {
  constructor(app, targetBucket, snapshotDir) {
    this.app = app;
    this.targetBucket = targetBucket;
    this.snapshotDir = snapshotDir;
  }

  async buildUrlMappingFromStorage(sourceBucket) {
    const urlMapping = {};

    if (!this.targetBucket) {
      return urlMapping;
    }

    try {
      const bucket = admin.storage(this.app).bucket(this.targetBucket);
      const storageManifestPath = path.join(this.snapshotDir, 'storage', 'storage-manifest.json');

      if (!fs.existsSync(storageManifestPath)) {
        const altPath = path.join(this.snapshotDir, 'storage-manifest.json');
        if (!fs.existsSync(altPath)) {
          return urlMapping;
        }
      }

      const manifestPath = fs.existsSync(path.join(this.snapshotDir, 'storage', 'storage-manifest.json'))
        ? path.join(this.snapshotDir, 'storage', 'storage-manifest.json')
        : path.join(this.snapshotDir, 'storage-manifest.json');

      const storageManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      for (const fileMeta of storageManifest.files) {
        const filePath = fileMeta.path;

        try {
          const file = bucket.file(filePath);
          const [metadata] = await file.getMetadata();
          let token = metadata.metadata?.firebaseStorageDownloadTokens;

          if (!token) {
            token = uuidv4();
            await file.setMetadata({
              metadata: {
                firebaseStorageDownloadTokens: token,
              },
            });
          }

          const encodedPath = encodeURIComponent(filePath);
          const oldHttpUrlBase = `https://firebasestorage.googleapis.com/v0/b/${sourceBucket}/o/${encodedPath}`;
          const newHttpUrl = `https://firebasestorage.googleapis.com/v0/b/${this.targetBucket}/o/${encodedPath}?alt=media&token=${token}`;

          urlMapping[oldHttpUrlBase] = newHttpUrl;
        } catch (error) {
          logger.warn(`Arquivo nao encontrado no Storage: ${filePath}`);
        }
      }
    } catch (error) {
      logger.warn(`Falha ao construir mapeamento de URLs: ${error.message}`);
    }

    return urlMapping;
  }
}

module.exports = UrlMapper;
