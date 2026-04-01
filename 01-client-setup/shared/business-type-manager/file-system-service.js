const fs = require("fs");
const path = require("path");
const { ensureDir } = require("../../../shared/utils/fs-utils");

class FileSystemService {
  static ensureDirectoryExists(dirPath) {
    const existed = fs.existsSync(dirPath);
    ensureDir(dirPath);
    return !existed;
  }

  static copyFile(sourcePath, targetPath) {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    const targetDir = path.dirname(targetPath);
    this.ensureDirectoryExists(targetDir);

    fs.copyFileSync(sourcePath, targetPath);
  }

  static copyDirectory(sourceDir, targetDir) {
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Source directory not found: ${sourceDir}`);
    }

    this.ensureDirectoryExists(targetDir);

    const files = fs.readdirSync(sourceDir);
    let copiedCount = 0;

    files.forEach((file) => {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);

      const stats = fs.statSync(sourcePath);
      if (stats.isFile()) {
        fs.copyFileSync(sourcePath, targetPath);
        copiedCount++;
      }
    });

    return copiedCount;
  }

  static writeFile(filePath, content) {
    const dir = path.dirname(filePath);
    this.ensureDirectoryExists(dir);
    fs.writeFileSync(filePath, content, "utf8");
  }
}

module.exports = { FileSystemService };
