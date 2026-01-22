/**
 * Screenshot Checker
 *
 * Utility to check for existing screenshots in metadata folders.
 */

const fs = require('fs');
const path = require('path');

const { WHITE_LABEL_APP_ROOT } = require('../../../shared/utils/paths');

/**
 * Check if screenshots already exist in metadata folders
 * @returns {Object} Object with exists flag and details
 */
function checkExistingScreenshots() {
  const metadataDir = path.join(WHITE_LABEL_APP_ROOT, 'metadata');

  const screenshotPaths = [
    {
      platform: 'Android Phone',
      path: path.join(metadataDir, 'android', 'pt-BR', 'images', 'phoneScreenshots'),
    },
    {
      platform: 'Android Tablet',
      path: path.join(metadataDir, 'android', 'pt-BR', 'images', 'tenInchScreenshots'),
    },
  ];

  const existingScreenshots = [];
  let totalCount = 0;

  for (const { platform, path: screenshotPath } of screenshotPaths) {
    if (fs.existsSync(screenshotPath)) {
      const pngFiles = fs.readdirSync(screenshotPath).filter((f) => f.endsWith('.png'));
      if (pngFiles.length > 0) {
        existingScreenshots.push({ platform, count: pngFiles.length });
        totalCount += pngFiles.length;
      }
    }
  }

  const iosDir = path.join(metadataDir, 'ios', 'pt-BR');
  if (fs.existsSync(iosDir)) {
    const pngFiles = fs.readdirSync(iosDir).filter((f) => f.endsWith('.png'));
    if (pngFiles.length > 0) {
      existingScreenshots.push({ platform: 'iOS (iPhone + iPad)', count: pngFiles.length });
      totalCount += pngFiles.length;
    }
  }

  return {
    exists: totalCount > 0,
    total: totalCount,
    details: existingScreenshots,
  };
}

module.exports = { checkExistingScreenshots };
