const path = require('path');
const fs = require('fs');
const logger = require('../../../shared/utils/logger');

class MetadataCopier {
  constructor(screenshotsDir, metadataDir) {
    this.screenshotsDir = screenshotsDir;
    this.metadataDir = metadataDir;
  }

  copyToMetadata() {
    logger.section('Copiando para Metadata');

    const mockupsDir = path.join(this.screenshotsDir, 'mockups');
    const phoneDir = path.join(mockupsDir, 'gplay_phone');
    const tabletDir = path.join(mockupsDir, 'gplay_tablet');
    const featureGraphicSrc = path.join(mockupsDir, 'feature_graphic', 'featureGraphic.png');

    const phoneMetadataDir = path.join(this.metadataDir, 'phoneScreenshots');
    const tabletMetadataDir = path.join(this.metadataDir, 'tenInchScreenshots');

    fs.mkdirSync(phoneMetadataDir, { recursive: true });
    fs.mkdirSync(tabletMetadataDir, { recursive: true });

    let copiedCount = 0;

    if (fs.existsSync(phoneDir)) {
      const phoneScreenshots = fs.readdirSync(phoneDir).filter((f) => f.endsWith('.png'));

      if (phoneScreenshots.length > 0) {
        logger.startSpinner(`Copiando ${phoneScreenshots.length} phone screenshots...`);

        fs.readdirSync(phoneMetadataDir).forEach((f) => {
          if (f.endsWith('.png')) {
            fs.unlinkSync(path.join(phoneMetadataDir, f));
          }
        });

        phoneScreenshots.forEach((file) => {
          fs.copyFileSync(path.join(phoneDir, file), path.join(phoneMetadataDir, file));
        });

        logger.succeedSpinner(`Phone screenshots copiados (${phoneScreenshots.length})`);
        copiedCount += phoneScreenshots.length;
      }
    }

    if (fs.existsSync(tabletDir)) {
      const tabletScreenshots = fs.readdirSync(tabletDir).filter((f) => f.endsWith('.png'));

      if (tabletScreenshots.length > 0) {
        logger.startSpinner(`Copiando ${tabletScreenshots.length} tablet screenshots...`);

        fs.readdirSync(tabletMetadataDir).forEach((f) => {
          if (f.endsWith('.png')) {
            fs.unlinkSync(path.join(tabletMetadataDir, f));
          }
        });

        tabletScreenshots.forEach((file) => {
          fs.copyFileSync(path.join(tabletDir, file), path.join(tabletMetadataDir, file));
        });

        logger.succeedSpinner(`Tablet screenshots copiados (${tabletScreenshots.length})`);
        copiedCount += tabletScreenshots.length;
      }
    }

    if (fs.existsSync(featureGraphicSrc)) {
      const featureGraphicDest = path.join(this.metadataDir, 'featureGraphic.png');
      fs.copyFileSync(featureGraphicSrc, featureGraphicDest);
      logger.success('Feature Graphic copiado');
      copiedCount++;
    }

    if (copiedCount === 0) {
      logger.warn('Nenhum mockup encontrado para copiar');
      return false;
    }

    logger.blank();
    logger.success(`Total de arquivos copiados: ${copiedCount}`);
    return true;
  }

  countScreenshots() {
    const phoneMetadataDir = path.join(this.metadataDir, 'phoneScreenshots');
    const tabletMetadataDir = path.join(this.metadataDir, 'tenInchScreenshots');

    const phoneCount = fs.existsSync(phoneMetadataDir)
      ? fs.readdirSync(phoneMetadataDir).filter((f) => f.endsWith('.png')).length
      : 0;

    const tabletCount = fs.existsSync(tabletMetadataDir)
      ? fs.readdirSync(tabletMetadataDir).filter((f) => f.endsWith('.png')).length
      : 0;

    return { phoneCount, tabletCount };
  }
}

module.exports = MetadataCopier;
