const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function removeDir(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyFolderRecursive(src, dest, ignorePaths = []) {
  fs.readdirSync(src).forEach((item) => {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const relativePath = path.relative(src, srcPath);
    if (ignorePaths.some((ignore) => relativePath.startsWith(ignore))) {
      return;
    }
    if (fs.lstatSync(srcPath).isDirectory()) {
      ensureDir(destPath);
      copyFolderRecursive(srcPath, destPath, ignorePaths);
    } else {
      ensureDir(path.dirname(destPath));
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

function findFirstExisting(paths) {
  return paths.find((p) => fs.existsSync(p)) || null;
}

module.exports = {
  ensureDir,
  removeDir,
  copyFolderRecursive,
  findFirstExisting,
};
