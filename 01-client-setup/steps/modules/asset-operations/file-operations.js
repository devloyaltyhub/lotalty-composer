const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFolderRecursiveSync(src, dest, ignorePaths = []) {
  fs.readdirSync(src).forEach((item) => {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const relativePath = path.relative(src, srcPath);
    if (ignorePaths.some((ignore) => relativePath.startsWith(ignore))) {
      return;
    }
    if (fs.lstatSync(srcPath).isDirectory()) {
      ensureDir(destPath);
      copyFolderRecursiveSync(srcPath, destPath, ignorePaths);
    } else {
      ensureDir(path.dirname(destPath));
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

function backupBusinessTypeAssets(assetsDir, businessTypes) {
  const categoriesToClean = ['animations', 'images', 'configs'];
  const backupDir = path.join(assetsDir, '.backup_temp');
  const backedUp = [];

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  categoriesToClean.forEach((category) => {
    const categoryDir = path.join(assetsDir, category);
    if (!fs.existsSync(categoryDir)) {
      return;
    }

    const items = fs.readdirSync(categoryDir);

    items.forEach((item) => {
      const itemPath = path.join(categoryDir, item);
      const stat = fs.lstatSync(itemPath);

      if (stat.isDirectory()) {
        const isBusinessTypeDir = businessTypes.some((businessType) => businessType.key === item);

        if (isBusinessTypeDir) {
          const backupPath = path.join(backupDir, category, item);
          console.log(`Backing up: ${category}/${item}`);
          copyFolderRecursiveSync(itemPath, backupPath);
          backedUp.push({ category, item, original: itemPath, backup: backupPath });
        }
      }
    });
  });

  return { backupDir, backedUp };
}

function removeBackedUpAssets(backedUp) {
  backedUp.forEach(({ category, item, original }) => {
    console.log(`Removing business type folder: ${category}/${item}`);
    fs.rmSync(original, { recursive: true, force: true });
  });
}

function cleanAssetsDir(assetsDir, businessTypes) {
  console.log('Cleaning old business type assets (with backup)...');

  try {
    const { backupDir, backedUp } = backupBusinessTypeAssets(assetsDir, businessTypes);
    removeBackedUpAssets(backedUp);

    console.log('Business type assets cleaned successfully (backup created).');
    return backupDir;
  } catch (error) {
    console.error('Error during cleanup:', error.message);
    throw error;
  }
}

function restoreFromBackup(backupDir, backedUp) {
  if (!fs.existsSync(backupDir)) {
    console.warn('No backup directory found, cannot restore');
    return;
  }

  try {
    backedUp.forEach(({ category, item, backup, original }) => {
      if (fs.existsSync(backup)) {
        console.log(`Restoring: ${category}/${item}`);
        copyFolderRecursiveSync(backup, original);
      }
    });
    console.log('Backup restored successfully');
  } catch (error) {
    console.error('Failed to restore from backup:', error.message);
  }
}

function cleanupBackup(backupDir) {
  if (fs.existsSync(backupDir)) {
    console.log('Removing backup...');
    fs.rmSync(backupDir, { recursive: true, force: true });
    console.log('Backup removed');
  }
}

module.exports = {
  ensureDir,
  copyFolderRecursiveSync,
  backupBusinessTypeAssets,
  removeBackedUpAssets,
  cleanAssetsDir,
  restoreFromBackup,
  cleanupBackup,
};
