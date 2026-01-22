const fs = require('fs');
const path = require('path');
const { validateBusinessTypeKey } = require('../input-validator');
const { SHARED_ASSETS_DIR } = require('../../../shared/utils/paths');
const { Logger } = require('./logger');
const { FileSystemService } = require('./file-system-service');

const COMPOSE_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const TEMPLATES_DIR = path.join(
  COMPOSE_ROOT,
  'loyalty-composer',
  '01-client-setup',
  'templates',
  'business-type-templates'
);

class AssetManager {
  constructor(businessTypeKey) {
    this.businessTypeKey = validateBusinessTypeKey(businessTypeKey, 'businessTypeKey');
    this.animationsDir = path.join(SHARED_ASSETS_DIR, 'animations', this.businessTypeKey);
    this.imagesDir = path.join(SHARED_ASSETS_DIR, 'images', this.businessTypeKey);
    this.configsDir = path.join(SHARED_ASSETS_DIR, 'configs', this.businessTypeKey);
  }

  createDirectories() {
    FileSystemService.ensureDirectoryExists(this.animationsDir);
    FileSystemService.ensureDirectoryExists(this.imagesDir);
    FileSystemService.ensureDirectoryExists(this.configsDir);
    Logger.success(`Created asset directories for ${this.businessTypeKey}`);
    return {
      animationsDir: this.animationsDir,
      imagesDir: this.imagesDir,
      configsDir: this.configsDir,
    };
  }

  copyFromExistingType(sourceTypeKey) {
    const validatedSourceType = validateBusinessTypeKey(sourceTypeKey, 'sourceTypeKey');
    const sourceAnimationsDir = path.join(SHARED_ASSETS_DIR, 'animations', validatedSourceType);
    const sourceImagesDir = path.join(SHARED_ASSETS_DIR, 'images', validatedSourceType);
    const sourceConfigsDir = path.join(SHARED_ASSETS_DIR, 'configs', validatedSourceType);

    let totalCopied = 0;

    if (fs.existsSync(sourceAnimationsDir)) {
      try {
        const count = FileSystemService.copyDirectory(sourceAnimationsDir, this.animationsDir);
        Logger.success(`Copied ${count} animation files`);
        totalCopied += count;
      } catch (error) {
        Logger.error(`Failed to copy animations: ${error.message}`);
      }
    } else {
      Logger.warning(`Source animations directory not found: ${sourceAnimationsDir}`);
    }

    if (fs.existsSync(sourceImagesDir)) {
      try {
        const count = FileSystemService.copyDirectory(sourceImagesDir, this.imagesDir);
        Logger.success(`Copied ${count} image files`);
        totalCopied += count;
      } catch (error) {
        Logger.error(`Failed to copy images: ${error.message}`);
      }
    } else {
      Logger.warning(`Source images directory not found: ${sourceImagesDir}`);
    }

    if (fs.existsSync(sourceConfigsDir)) {
      try {
        const count = FileSystemService.copyDirectory(sourceConfigsDir, this.configsDir);
        Logger.success(`Copied ${count} config files`);
        totalCopied += count;
      } catch (error) {
        Logger.error(`Failed to copy configs: ${error.message}`);
      }
    } else {
      Logger.warning(`Source configs directory not found: ${sourceConfigsDir}`);
    }

    return totalCopied;
  }

  createPlaceholderAssets() {
    this._createReadme();

    const placeholderPath = path.join(TEMPLATES_DIR, 'assets', 'placeholder.json');
    if (fs.existsSync(placeholderPath)) {
      try {
        FileSystemService.copyFile(
          placeholderPath,
          path.join(this.animationsDir, 'placeholder.json')
        );
        Logger.success('Created placeholder animation');
      } catch (error) {
        Logger.warning(`Could not copy placeholder: ${error.message}`);
      }
    }

    const animationFiles = fs.readdirSync(this.animationsDir);
    if (animationFiles.filter((f) => f.endsWith('.json')).length === 0) {
      this._createDefaultAnimation();
    }

    this._createRankingConfig();
  }

  _createRankingConfig() {
    const rankingConfigTemplatePath = path.join(
      TEMPLATES_DIR,
      'configs',
      'ranking_config_template.json'
    );
    const rankingConfigDestPath = path.join(this.configsDir, 'ranking_config.json');

    if (fs.existsSync(rankingConfigTemplatePath)) {
      try {
        FileSystemService.copyFile(rankingConfigTemplatePath, rankingConfigDestPath);
        Logger.success('Created ranking_config.json from template');
      } catch (error) {
        Logger.warning(`Could not copy ranking config template: ${error.message}`);
      }
    } else {
      Logger.warning(`Ranking config template not found at: ${rankingConfigTemplatePath}`);
    }
  }

  _createReadme() {
    const readmeContent = `# ${this.businessTypeKey.charAt(0).toUpperCase() + this.businessTypeKey.slice(1)} Assets

This directory contains animations for the ${this.businessTypeKey} business type.

## Files
- Add your Lottie animation files (.json) here
- Recommended animations: loading, success, main interaction

## Guidelines
- Keep file sizes under 100KB when possible
- Use descriptive filenames
- Test animations on different screen sizes

## Asset Structure
- Animations: Place Lottie JSON files in this directory
- Images: Place image files in ../images/${this.businessTypeKey}/

## Next Steps
1. Add your custom animations and images
2. Run the setup script to configure a client with this business type
3. Test the assets in the application
`;

    FileSystemService.writeFile(path.join(this.animationsDir, 'README.md'), readmeContent);
    Logger.success('Created asset documentation');
  }

  _createDefaultAnimation() {
    const defaultAnimation = {
      v: '5.5.7',
      meta: { g: 'LottieFiles AE', a: '', k: '', d: '', tc: '' },
      fr: 60,
      ip: 0,
      op: 60,
      w: 500,
      h: 500,
      nm: 'Placeholder Animation',
      ddd: 0,
      assets: [],
      layers: [],
    };

    FileSystemService.writeFile(
      path.join(this.animationsDir, 'placeholder.json'),
      JSON.stringify(defaultAnimation, null, 2)
    );
    Logger.success('Created default placeholder animation');
  }
}

module.exports = { AssetManager };
