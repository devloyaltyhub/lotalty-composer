const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { validateBusinessTypeKey } = require('./input-validator');
const {
  COMPOSE_ROOT,
  LOYALTY_APP_ROOT,
  CLIENTS_DIR,
  SHARED_ASSETS_DIR,
  WHITE_LABEL_APP_ROOT,
} = require('../../shared/utils/paths');

// ============================================================================
// CONSTANTS - Using centralized paths from paths.js
// ============================================================================
const TEMPLATES_DIR = path.join(COMPOSE_ROOT, '01-client-setup', 'templates', 'business-type-templates');
const SETUP_SCRIPT_PATH = path.join(COMPOSE_ROOT, '01-client-setup', 'steps', 'setup-white-label.js');
const WHITE_LABEL_USER_CONFIGS = path.join(WHITE_LABEL_APP_ROOT, 'lib', 'src', 'utils', 'user_configs.dart');

// ============================================================================
// LOGGING UTILITIES - Single Responsibility Principle
// ============================================================================
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class Logger {
  static log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  static success(message) {
    this.log(`✅ ${message}`, 'green');
  }

  static error(message) {
    this.log(`❌ ${message}`, 'red');
  }

  static warning(message) {
    this.log(`⚠️  ${message}`, 'yellow');
  }

  static info(message) {
    this.log(`ℹ️  ${message}`, 'blue');
  }

  static section(title) {
    this.log(`\n${title}`, 'cyan');
    this.log('='.repeat(60), 'cyan');
  }

  static subsection(title) {
    this.log(`\n${title}`, 'blue');
  }
}

// ============================================================================
// INPUT UTILITIES - Interface Segregation Principle
// ============================================================================
class InputHandler {
  static askQuestion(question) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  static askYesNo(question) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(`${question} (S/N): `, (answer) => {
        rl.close();
        resolve(/^s$/i.test(answer.trim()));
      });
    });
  }
}

// ============================================================================
// BUSINESS TYPE REPOSITORY - Dependency Inversion Principle
// ============================================================================
class BusinessTypeRepository {
  static getExistingTypes() {
    // First, try to get from animations directory (source of truth)
    const typesFromAssets = this._getTypesFromAssets();
    if (typesFromAssets.length > 0) {
      return typesFromAssets;
    }

    // Fallback to setup script
    return this._getTypesFromSetupScript();
  }

  static _getTypesFromAssets() {
    try {
      const animationsDir = path.join(SHARED_ASSETS_DIR, 'animations');
      if (!fs.existsSync(animationsDir)) {
        return [];
      }

      return fs
        .readdirSync(animationsDir)
        .filter((item) => {
          const fullPath = path.join(animationsDir, item);
          const stats = fs.statSync(fullPath);
          return stats.isDirectory() && !item.startsWith('.');
        })
        .map((key) => ({
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
        }));
    } catch (error) {
      Logger.warning(`Could not read business types from assets: ${error.message}`);
      return [];
    }
  }

  static _getTypesFromSetupScript() {
    try {
      const setupContent = fs.readFileSync(SETUP_SCRIPT_PATH, 'utf8');
      const match = setupContent.match(/let BUSINESS_TYPES = \[([\s\S]*?)\];/);

      if (match) {
        const businessTypesStr = match[1];
        const types = [];
        const typeMatches = businessTypesStr.matchAll(
          /{\s*key:\s*"([^"]+)",\s*label:\s*"([^"]+)"\s*}/g
        );

        for (const typeMatch of typeMatches) {
          types.push({
            key: typeMatch[1],
            label: typeMatch[2],
          });
        }
        return types;
      }
    } catch (error) {
      Logger.warning('Could not read existing business types from setup script');
    }

    return [
      { key: 'coffee', label: 'Cafeteria' },
      { key: 'beer', label: 'Cervejaria' },
    ];
  }
}

// ============================================================================
// VALIDATION SERVICE - Single Responsibility Principle
// ============================================================================
class ValidationService {
  static validateBusinessTypeKey(key) {
    if (!key || key.length < 2) {
      return 'Business type key must be at least 2 characters long';
    }

    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return 'Business type key must start with a letter and contain only lowercase letters, numbers, and underscores';
    }

    const existingTypes = BusinessTypeRepository.getExistingTypes();
    if (existingTypes.some((type) => type.key === key)) {
      return `Business type "${key}" already exists`;
    }

    return null;
  }

  static validateLabel(label) {
    if (!label || label.trim().length === 0) {
      return 'Display label is required';
    }
    return null;
  }
}

// ============================================================================
// FILE SYSTEM SERVICE - Single Responsibility & Open/Closed Principle
// ============================================================================
class FileSystemService {
  static ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      return true;
    }
    return false;
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
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

// ============================================================================
// ASSET MANAGER - Single Responsibility Principle
// ============================================================================
class AssetManager {
  constructor(businessTypeKey) {
    // SECURITY FIX: Validate businessTypeKey to prevent path traversal attacks
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
    // SECURITY FIX: Validate sourceTypeKey to prevent path traversal attacks
    const validatedSourceType = validateBusinessTypeKey(sourceTypeKey, 'sourceTypeKey');
    const sourceAnimationsDir = path.join(SHARED_ASSETS_DIR, 'animations', validatedSourceType);
    const sourceImagesDir = path.join(SHARED_ASSETS_DIR, 'images', validatedSourceType);
    const sourceConfigsDir = path.join(SHARED_ASSETS_DIR, 'configs', validatedSourceType);

    let totalCopied = 0;

    // Copy animations
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

    // Copy images
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

    // Copy configs
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
    // Create README
    this._createReadme();

    // Try to copy placeholder animation if it exists
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

    // If no files exist yet, create a simple placeholder JSON
    const animationFiles = fs.readdirSync(this.animationsDir);
    if (animationFiles.filter((f) => f.endsWith('.json')).length === 0) {
      this._createDefaultAnimation();
    }

    // Copy ranking config template
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

// ============================================================================
// DART CONFIG UPDATER - Single Responsibility Principle
// ============================================================================
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

    // Update resources_constants.dart with switch statements
    this._updateResourcesConstants(businessTypeKey);
  }

  static _getConfigFiles() {
    const files = [WHITE_LABEL_USER_CONFIGS];

    // Also update client configs if they exist
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

    // Update the enum
    const enumMatch = content.match(/(enum BusinessType\s*{\s*)([^}]*)(})/);

    if (enumMatch) {
      const existingValues = enumMatch[2].trim();
      let updatedEnum;

      if (existingValues) {
        // Check if the value already exists
        if (existingValues.includes(businessTypeKey)) {
          Logger.info(
            `BusinessType.${businessTypeKey} already exists in ${path.basename(filePath)}`
          );
          return;
        }

        // Remove trailing comma if exists and add new value
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

      // Capitalize first letter for class names
      const className = businessTypeKey
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

      // Add AnimationAssets class implementation
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

      // Add BusinessImages class implementation
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

      // Find where to insert the classes (before AnimationAssetsProvider)
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

      // Add switch case to AnimationAssetsProvider
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

      // Add switch case to BusinessImagesProvider
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
}

// ============================================================================
// BUSINESS TYPE DELETER - Single Responsibility Principle
// ============================================================================
class BusinessTypeDeleter {
  async delete() {
    try {
      Logger.section('🗑️  Excluir Tipo de Negócio - Loyalty Hub');

      // Show existing business types
      const existingTypes = BusinessTypeRepository.getExistingTypes();

      if (existingTypes.length === 0) {
        Logger.error('Nenhum tipo de negócio encontrado para excluir');
        return;
      }

      Logger.subsection('📋 Tipos de negócio existentes:');
      existingTypes.forEach((type, index) => {
        Logger.log(`   ${index + 1}. ${type.label} (${type.key})`);
      });

      // Get business type to delete
      const deleteChoice = await InputHandler.askQuestion(
        '\n📝 Digite o número do tipo de negócio para excluir (ou 0 para cancelar): '
      );
      const deleteIndex = parseInt(deleteChoice) - 1;

      if (deleteIndex === -1) {
        Logger.log('\n❌ Operação cancelada pelo usuário', 'red');
        return;
      }

      if (deleteIndex < 0 || deleteIndex >= existingTypes.length) {
        Logger.error('Escolha inválida');
        return;
      }

      const businessTypeToDelete = existingTypes[deleteIndex];

      // Confirm deletion
      Logger.warning(
        `\n⚠️  Você está prestes a excluir o tipo de negócio: ${businessTypeToDelete.label} (${businessTypeToDelete.key})`
      );
      Logger.warning('Esta ação irá remover:');
      Logger.warning(
        `   • Todas as animações em shared_assets/animations/${businessTypeToDelete.key}`
      );
      Logger.warning(`   • Todas as imagens em shared_assets/images/${businessTypeToDelete.key}`);
      Logger.warning(`   • Todas as configs em shared_assets/configs/${businessTypeToDelete.key}`);
      Logger.warning(`   • O valor do enum BusinessType nos arquivos Dart`);

      const confirmDelete = await InputHandler.askYesNo(
        '\n❌ Tem certeza que deseja excluir? Esta ação não pode ser desfeita!'
      );

      if (!confirmDelete) {
        Logger.log('\n✅ Operação cancelada. Nenhum arquivo foi removido.', 'green');
        return;
      }

      // Execute deletion
      await this._executeDelete(businessTypeToDelete.key);

      // Display success message
      Logger.log('\n🎉 Tipo de negócio excluído com sucesso!', 'green');
      Logger.log('='.repeat(50), 'green');
    } catch (error) {
      Logger.error(`Erro: ${error.message}`);
      process.exit(1);
    }
  }

  async _executeDelete(businessTypeKey) {
    Logger.subsection('🗑️  Removendo arquivos...');

    const animationsDir = path.join(SHARED_ASSETS_DIR, 'animations', businessTypeKey);
    const imagesDir = path.join(SHARED_ASSETS_DIR, 'images', businessTypeKey);
    const configsDir = path.join(SHARED_ASSETS_DIR, 'configs', businessTypeKey);

    // Delete directories
    [animationsDir, imagesDir, configsDir].forEach((dir) => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        Logger.success(`Removido: ${dir}`);
      }
    });

    // Update Dart configurations
    Logger.subsection('⚙️ Atualizando configurações do Dart...');
    this._removeBusinessTypeFromDart(businessTypeKey);

    Logger.info('Tipo de negócio removido do sistema');
  }

  _removeBusinessTypeFromDart(businessTypeKey) {
    const filesToUpdate = this._getConfigFiles();

    filesToUpdate.forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) {
          let content = fs.readFileSync(filePath, 'utf8');

          // Remove from enum
          const enumMatch = content.match(/(enum BusinessType\s*{\s*)([^}]*)(})/);

          if (enumMatch) {
            let enumValues = enumMatch[2].trim();

            // Split by comma and filter out the business type to delete
            const values = enumValues
              .split(',')
              .map((v) => v.trim())
              .filter((v) => v && v !== businessTypeKey);

            const updatedEnum = `${enumMatch[1]}${values.join(', ')} ${enumMatch[3]}`;
            content = content.replace(enumMatch[0], updatedEnum);

            fs.writeFileSync(filePath, content);
            Logger.success(
              `Removido BusinessType.${businessTypeKey} de ${path.basename(filePath)}`
            );
          }
        }
      } catch (error) {
        Logger.error(`Failed to update ${filePath}: ${error.message}`);
      }
    });

    // Update resources_constants.dart specifically
    this._removeBusinessTypeFromResourcesConstants(businessTypeKey);
  }

  _removeBusinessTypeFromResourcesConstants(businessTypeKey) {
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

      // Capitalize first letter for class names
      const className = businessTypeKey
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

      // Remove AnimationAssets class implementation
      // More flexible regex that handles any amount of whitespace and content
      const animationClassRegex = new RegExp(
        `class ${className}AnimationAssets implements AnimationAssets[\\s\\S]*?^\\}\\s*$`,
        'gm'
      );
      const animationMatches = content.match(animationClassRegex);
      if (animationMatches) {
        content = content.replace(animationClassRegex, '');
        Logger.info(`Removed ${className}AnimationAssets class`);
      }

      // Remove BusinessImages class implementation
      const imagesClassRegex = new RegExp(
        `class ${className}Images implements BusinessImages[\\s\\S]*?^\\}\\s*$`,
        'gm'
      );
      const imagesMatches = content.match(imagesClassRegex);
      if (imagesMatches) {
        content = content.replace(imagesClassRegex, '');
        Logger.info(`Removed ${className}Images class`);
      }

      // Remove switch case from AnimationAssetsProvider
      // Handle both single-line and multi-line case statements
      const animationSwitchRegex = new RegExp(
        `\\s*case BusinessType\\.${businessTypeKey}:[\\s\\S]*?_assets = ${className}AnimationAssets\\(\\);[\\s\\S]*?break;\\s*`,
        'g'
      );
      const animationSwitchMatches = content.match(animationSwitchRegex);
      if (animationSwitchMatches) {
        content = content.replace(animationSwitchRegex, '');
        Logger.info(`Removed AnimationAssetsProvider switch case for ${businessTypeKey}`);
      }

      // Remove switch case from BusinessImagesProvider
      const imagesSwitchRegex = new RegExp(
        `\\s*case BusinessType\\.${businessTypeKey}:[\\s\\S]*?_images = ${className}Images\\(\\);[\\s\\S]*?break;\\s*`,
        'g'
      );
      const imagesSwitchMatches = content.match(imagesSwitchRegex);
      if (imagesSwitchMatches) {
        content = content.replace(imagesSwitchRegex, '');
        Logger.info(`Removed BusinessImagesProvider switch case for ${businessTypeKey}`);
      }

      // Clean up extra blank lines (more than 2 consecutive newlines)
      content = content.replace(/\n{3,}/g, '\n\n');

      fs.writeFileSync(resourcesConstantsPath, content);
      Logger.success(
        `Removidas classes e switch cases de ${className} em resources_constants.dart`
      );
    } catch (error) {
      Logger.error(`Failed to update resources_constants.dart: ${error.message}`);
    }
  }

  _getConfigFiles() {
    const files = [WHITE_LABEL_USER_CONFIGS];

    // Also update client configs if they exist
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
}

// ============================================================================
// BUSINESS TYPE CREATOR - Facade Pattern
// ============================================================================
class BusinessTypeCreator {
  async create() {
    try {
      Logger.section('🚀 Criador de Tipos de Negócio - Loyalty Hub');

      // Show existing business types
      this._displayExistingTypes();

      // Get new business type details
      const businessType = await this._promptForBusinessType();

      // Confirm creation
      if (!(await this._confirmCreation(businessType))) {
        Logger.log('\n❌ Operação cancelada pelo usuário', 'red');
        return;
      }

      // Create the business type
      await this._executeCreation(businessType);

      // Display success message
      this._displaySuccessMessage(businessType);
    } catch (error) {
      Logger.error(`Erro: ${error.message}`);
      process.exit(1);
    }
  }

  _displayExistingTypes() {
    const existingTypes = BusinessTypeRepository.getExistingTypes();
    Logger.subsection('📋 Tipos de negócio existentes:');

    if (existingTypes.length === 0) {
      Logger.warning('   Nenhum tipo de negócio encontrado');
    } else {
      existingTypes.forEach((type) => {
        Logger.log(`   • ${type.label} (${type.key})`);
      });
    }
  }

  async _promptForBusinessType() {
    Logger.subsection('🎯 Criando novo tipo de negócio');

    // Get and validate business type key
    let businessTypeKey;
    let validationError;

    do {
      businessTypeKey = await InputHandler.askQuestion(
        '\n📝 Digite a chave do tipo de negócio (ex: pizza, bakery): '
      );
      validationError = ValidationService.validateBusinessTypeKey(businessTypeKey);

      if (validationError) {
        Logger.error(validationError);
      }
    } while (validationError);

    // Get and validate display label
    let businessTypeLabel;
    do {
      businessTypeLabel = await InputHandler.askQuestion(
        '🏷️  Digite o nome de exibição (ex: Pizzaria, Padaria): '
      );
      validationError = ValidationService.validateLabel(businessTypeLabel);

      if (validationError) {
        Logger.error(validationError);
      }
    } while (validationError);

    // Ask about copying assets
    const copyFromType = await this._askAboutCopyingAssets();

    return {
      key: businessTypeKey,
      label: businessTypeLabel.trim(),
      copyFrom: copyFromType,
    };
  }

  async _askAboutCopyingAssets() {
    const existingTypes = BusinessTypeRepository.getExistingTypes();

    if (existingTypes.length === 0) {
      return null;
    }

    const shouldCopy = await InputHandler.askYesNo(
      '\n📁 Deseja copiar assets de um tipo existente?'
    );

    if (!shouldCopy) {
      return null;
    }

    Logger.log('\nTipos disponíveis:');
    existingTypes.forEach((type, index) => {
      Logger.log(`${index + 1}. ${type.label} (${type.key})`);
    });

    const copyChoice = await InputHandler.askQuestion('Digite o número do tipo para copiar: ');
    const copyIndex = parseInt(copyChoice) - 1;

    if (copyIndex >= 0 && copyIndex < existingTypes.length) {
      Logger.info(`Copiando assets de: ${existingTypes[copyIndex].label}`);
      return existingTypes[copyIndex].key;
    }

    Logger.warning('Escolha inválida. Criando sem copiar assets.');
    return null;
  }

  async _confirmCreation(businessType) {
    Logger.subsection('📝 Resumo do novo tipo de negócio:');
    Logger.log(`   Chave: ${businessType.key}`);
    Logger.log(`   Nome: ${businessType.label}`);
    if (businessType.copyFrom) {
      Logger.log(`   Copiar de: ${businessType.copyFrom}`);
    }

    return await InputHandler.askYesNo('\n✅ Confirma a criação?');
  }

  async _executeCreation(businessType) {
    Logger.subsection('📁 Criando estrutura de assets...');

    // Create asset manager
    const assetManager = new AssetManager(businessType.key);

    // Create directories
    assetManager.createDirectories();

    // Copy or create assets
    if (businessType.copyFrom) {
      Logger.subsection(`📋 Copiando assets de ${businessType.copyFrom}...`);
      const copiedCount = assetManager.copyFromExistingType(businessType.copyFrom);

      if (copiedCount === 0) {
        Logger.warning('Nenhum arquivo foi copiado. Criando placeholders...');
        assetManager.createPlaceholderAssets();
      }
    } else {
      Logger.subsection('🎨 Criando assets placeholder...');
      assetManager.createPlaceholderAssets();
    }

    // Update Dart configurations
    Logger.subsection('⚙️ Atualizando configurações do Dart...');
    DartConfigUpdater.updateBusinessTypeEnum(businessType.key);

    Logger.info('Setup script will automatically detect new business type from assets');
  }

  _displaySuccessMessage(businessType) {
    Logger.log('\n🎉 Tipo de negócio criado com sucesso!', 'green');
    Logger.log('='.repeat(50), 'green');

    Logger.log(`\n📁 Assets criados em:`);
    Logger.log(`   • ${path.join(SHARED_ASSETS_DIR, 'animations', businessType.key)}`);
    Logger.log(`   • ${path.join(SHARED_ASSETS_DIR, 'images', businessType.key)}`);

    Logger.log(`\n⚙️ Arquivos atualizados:`);
    Logger.log(`   • ${WHITE_LABEL_USER_CONFIGS}`);

    Logger.log(`\n🔄 Próximos passos:`);
    Logger.log(`   1. Adicione suas animações e imagens nos diretórios criados`);
    Logger.log(`   2. Execute o setup-white-label.js para configurar um cliente`);
    Logger.log(`   3. O script detectará automaticamente o novo tipo de negócio`);
  }
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================
async function main() {
  Logger.section('🚀 Gerenciador de Tipos de Negócio - Loyalty Hub');
  Logger.log('\nEscolha uma opção:');
  Logger.log('1. Criar novo tipo de negócio');
  Logger.log('2. Excluir tipo de negócio existente');

  const choice = await InputHandler.askQuestion('\nDigite o número da opção desejada: ');

  if (choice === '1') {
    const creator = new BusinessTypeCreator();
    await creator.create();
  } else if (choice === '2') {
    const deleter = new BusinessTypeDeleter();
    await deleter.delete();
  } else {
    Logger.error('Opção inválida');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for testing
module.exports = {
  BusinessTypeRepository,
  ValidationService,
  FileSystemService,
  AssetManager,
  DartConfigUpdater,
  BusinessTypeCreator,
  BusinessTypeDeleter,
};
