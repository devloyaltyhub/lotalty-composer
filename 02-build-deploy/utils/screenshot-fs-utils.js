const fs = require("fs");
const { ensureDir, removeDir } = require("../../shared/utils/fs-utils");

function getScreenshotFiles(sourceDir) {
  if (!fs.existsSync(sourceDir)) {
    return [];
  }

  return fs
    .readdirSync(sourceDir)
    .filter((file) => file.endsWith(".png"))
    .sort();
}

module.exports = { ensureDir, getScreenshotFiles, removeDir };
