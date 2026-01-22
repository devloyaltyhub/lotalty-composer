const fs = require('fs');
const path = require('path');
const { SHARED_ASSETS_DIR, CLIENTS_DIR, WHITE_LABEL_APP_ROOT } = require('../../../shared/utils/paths');
const { Logger } = require('./logger');
const { InputHandler } = require('./input-handler');
const { BusinessTypeRepository } = require('./business-type-repository');

const WHITE_LABEL_USER_CONFIGS = path.join(
  WHITE_LABEL_APP_ROOT,
  'lib',
  'src',
  'utils',
  'user_configs.dart'
);

class BusinessTypeDeleter {
  async delete() {
    try {
      Logger.section('🗑️  Excluir Tipo de Negócio - Loyalty Hub');

      const existingTypes = BusinessTypeRepository.getExistingTypes();

      if (existingTypes.length === 0) {
        Logger.error('Nenhum tipo de negócio encontrado para excluir');
        return;
      }

      Logger.subsection('📋 Tipos de negócio existentes:');
      existingTypes.forEach((type, index) => {
        Logger.log(`   ${index + 1}. ${type.label} (${type.key})`);
      });

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

      await this._executeDelete(businessTypeToDelete.key);

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

    [animationsDir, imagesDir, configsDir].forEach((dir) => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        Logger.success(`Removido: ${dir}`);
      }
    });

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

          const enumMatch = content.match(/(enum BusinessType\s*{\s*)([^}]*)(})/);

          if (enumMatch) {
            let enumValues = enumMatch[2].trim();

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

      const className = businessTypeKey
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

      const animationClassRegex = new RegExp(
        `class ${className}AnimationAssets implements AnimationAssets[\\s\\S]*?^\\}\\s*$`,
        'gm'
      );
      const animationMatches = content.match(animationClassRegex);
      if (animationMatches) {
        content = content.replace(animationClassRegex, '');
        Logger.info(`Removed ${className}AnimationAssets class`);
      }

      const imagesClassRegex = new RegExp(
        `class ${className}Images implements BusinessImages[\\s\\S]*?^\\}\\s*$`,
        'gm'
      );
      const imagesMatches = content.match(imagesClassRegex);
      if (imagesMatches) {
        content = content.replace(imagesClassRegex, '');
        Logger.info(`Removed ${className}Images class`);
      }

      const animationSwitchRegex = new RegExp(
        `\\s*case BusinessType\\.${businessTypeKey}:[\\s\\S]*?_assets = ${className}AnimationAssets\\(\\);[\\s\\S]*?break;\\s*`,
        'g'
      );
      const animationSwitchMatches = content.match(animationSwitchRegex);
      if (animationSwitchMatches) {
        content = content.replace(animationSwitchRegex, '');
        Logger.info(`Removed AnimationAssetsProvider switch case for ${businessTypeKey}`);
      }

      const imagesSwitchRegex = new RegExp(
        `\\s*case BusinessType\\.${businessTypeKey}:[\\s\\S]*?_images = ${className}Images\\(\\);[\\s\\S]*?break;\\s*`,
        'g'
      );
      const imagesSwitchMatches = content.match(imagesSwitchRegex);
      if (imagesSwitchMatches) {
        content = content.replace(imagesSwitchRegex, '');
        Logger.info(`Removed BusinessImagesProvider switch case for ${businessTypeKey}`);
      }

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

module.exports = { BusinessTypeDeleter };
