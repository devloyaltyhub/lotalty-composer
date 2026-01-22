const fs = require('fs');
const path = require('path');
const { CLIENTS_DIR, WHITE_LABEL_APP_ROOT } = require('../../../shared/utils/paths');
const { Logger } = require('./logger');

const WHITE_LABEL_USER_CONFIGS = path.join(
  WHITE_LABEL_APP_ROOT,
  'lib',
  'src',
  'utils',
  'user_configs.dart'
);

class DartConfigUpdater {
  static updateBusinessTypeEnum(businessTypeKey) {
    const filesToUpdate = this._getConfigFiles();

    filesToUpdate.forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) {
          this._updateEnumInFile(filePath, businessTypeKey);
        }
      } catch (error) {
        Logger.error(`Failed to update ${filePath}: ${error.message}`);
      }
    });

    this._updateResourcesConstants(businessTypeKey);
  }

  static _getConfigFiles() {
    const files = [WHITE_LABEL_USER_CONFIGS];

    if (fs.existsSync(CLIENTS_DIR)) {
      try {
        const clients = fs
          .readdirSync(CLIENTS_DIR)
          .filter((dir) => fs.statSync(path.join(CLIENTS_DIR, dir)).isDirectory());

        clients.forEach((client) => {
          const clientConfigPath = path.join(
            CLIENTS_DIR,
            client,
            'lib/src/utils/user_configs.dart'
          );
          if (fs.existsSync(clientConfigPath)) {
            files.push(clientConfigPath);
          }
        });
      } catch (error) {
        Logger.warning(`Could not scan clients directory: ${error.message}`);
      }
    }

    return files;
  }

  static _updateEnumInFile(filePath, businessTypeKey) {
    let content = fs.readFileSync(filePath, 'utf8');

    const enumMatch = content.match(/(enum BusinessType\s*{\s*)([^}]*)(})/);

    if (enumMatch) {
      const existingValues = enumMatch[2].trim();
      let updatedEnum;

      if (existingValues) {
        if (existingValues.includes(businessTypeKey)) {
          Logger.info(
            `BusinessType.${businessTypeKey} already exists in ${path.basename(filePath)}`
          );
          return;
        }

        const cleanExisting = existingValues.replace(/,\s*$/, '');
        updatedEnum = `${enumMatch[1]}${cleanExisting}, ${businessTypeKey} ${enumMatch[3]}`;
      } else {
        updatedEnum = `${enumMatch[1]}${businessTypeKey} ${enumMatch[3]}`;
      }

      content = content.replace(enumMatch[0], updatedEnum);
      fs.writeFileSync(filePath, content);
      Logger.success(`Updated BusinessType enum in ${path.basename(filePath)}`);
    } else {
      Logger.warning(`Could not find BusinessType enum in ${path.basename(filePath)}`);
    }
  }

  static _updateResourcesConstants(businessTypeKey) {
    const resourcesConstantsPath = path.join(
      WHITE_LABEL_APP_ROOT,
      'lib/src/utils/resources_constants.dart'
    );

    if (!fs.existsSync(resourcesConstantsPath)) {
      Logger.warning('resources_constants.dart not found');
      return;
    }

    try {
      let content = fs.readFileSync(resourcesConstantsPath, 'utf8');

      const className = businessTypeKey
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

      const animationAssetsTemplate = `class ${className}AnimationAssets implements AnimationAssets {
  @override
  String get animation1 => 'assets/animations/${businessTypeKey}/placeholder.json';
  @override
  String get animation2 => 'assets/animations/${businessTypeKey}/placeholder.json';
  @override
  String get animation3 => 'assets/animations/${businessTypeKey}/placeholder.json';
  @override
  String get animation4 => 'assets/animations/${businessTypeKey}/placeholder.json';
  @override
  String get animation5 => 'assets/animations/${businessTypeKey}/placeholder.json';
  @override
  String get animation6 => 'assets/animations/${businessTypeKey}/placeholder.json';
  @override
  String get animation7 => 'assets/animations/${businessTypeKey}/placeholder.json';
  @override
  String get animation8 => 'assets/animations/${businessTypeKey}/placeholder.json';
  @override
  String get animation9 => 'assets/animations/${businessTypeKey}/placeholder.json';
  @override
  String get animation10 => 'assets/animations/${businessTypeKey}/placeholder.json';
  @override
  String get animation11 => 'assets/animations/${businessTypeKey}/placeholder.json';
  @override
  String get animation12 => 'assets/animations/${businessTypeKey}/placeholder.json';
}

`;

      const businessImagesTemplate = `class ${className}Images implements BusinessImages {
  @override
  String get bonusPageBanner => 'assets/images/${businessTypeKey}/placeholder.jpg';
  @override
  String get cardClubBusinessIcon => 'assets/images/${businessTypeKey}/placeholder.png';
  @override
  String get busineddIcon => 'assets/images/${businessTypeKey}/placeholder.png';
  @override
  String get busineddIconBlack => 'assets/images/${businessTypeKey}/placeholder.png';
  @override
  String get package => 'assets/images/${businessTypeKey}/placeholder.png';
}

`;

      const animationProviderMatch = content.match(/class AnimationAssetsProvider/);
      if (animationProviderMatch) {
        const insertPosition = content.indexOf(animationProviderMatch[0]);
        content =
          content.slice(0, insertPosition) +
          animationAssetsTemplate +
          businessImagesTemplate +
          content.slice(insertPosition);
        Logger.info(`Added ${className}AnimationAssets and ${className}Images classes`);
      }

      const animationSwitchEnd = content.indexOf(
        'case BusinessType.beer:\n        _assets = BeerAnimationAssets();\n        break;'
      );
      if (animationSwitchEnd !== -1) {
        const insertPosition =
          animationSwitchEnd +
          'case BusinessType.beer:\n        _assets = BeerAnimationAssets();\n        break;'
            .length;
        const newCase = `\n      case BusinessType.${businessTypeKey}:\n        _assets = ${className}AnimationAssets();\n        break;`;
        content = content.slice(0, insertPosition) + newCase + content.slice(insertPosition);
        Logger.info(`Added AnimationAssetsProvider switch case for ${businessTypeKey}`);
      }

      const imagesSwitchEnd = content.indexOf(
        'case BusinessType.beer:\n        _images = BeerImages();\n        break;'
      );
      if (imagesSwitchEnd !== -1) {
        const insertPosition =
          imagesSwitchEnd +
          'case BusinessType.beer:\n        _images = BeerImages();\n        break;'.length;
        const newCase = `\n      case BusinessType.${businessTypeKey}:\n        _images = ${className}Images();\n        break;`;
        content = content.slice(0, insertPosition) + newCase + content.slice(insertPosition);
        Logger.info(`Added BusinessImagesProvider switch case for ${businessTypeKey}`);
      }

      fs.writeFileSync(resourcesConstantsPath, content);
      Logger.success(
        `Updated resources_constants.dart with ${businessTypeKey} classes and switch cases`
      );
    } catch (error) {
      Logger.error(`Failed to update resources_constants.dart: ${error.message}`);
    }
  }

  static getConfigFilePath() {
    return WHITE_LABEL_USER_CONFIGS;
  }
}

module.exports = { DartConfigUpdater };
