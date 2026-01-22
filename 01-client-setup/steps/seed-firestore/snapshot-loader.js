const fs = require('fs');
const path = require('path');

class SnapshotLoader {
  constructor(snapshotDir) {
    this.snapshotDir = snapshotDir;
  }

  hasSnapshot() {
    const manifestPath = path.join(this.snapshotDir, 'manifest.json');
    return fs.existsSync(manifestPath);
  }

  loadSnapshotManifest() {
    const manifestPath = path.join(this.snapshotDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  loadSnapshotCollection(collectionName) {
    const filePath = path.join(this.snapshotDir, 'firestore', `${collectionName}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  loadTemplate(templatePath) {
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    return JSON.parse(templateContent);
  }
}

module.exports = SnapshotLoader;
