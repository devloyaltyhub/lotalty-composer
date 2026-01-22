const path = require('path');
const { SHARED_ASSETS_DIR } = require('../../../shared/utils/paths');
const { Logger } = require('./logger');
const { InputHandler } = require('./input-handler');
const { ValidationService } = require('./validation-service');
const { BusinessTypeRepository } = require('./business-type-repository');
const { AssetManager } = require('./asset-manager');
const { DartConfigUpdater } = require('./dart-config-updater');

class BusinessTypeCreator {
  async create() {
    try {
      Logger.section('🚀 Criador de Tipos de Negócio - Loyalty Hub');

      this._displayExistingTypes();

      const businessType = await this._promptForBusinessType();

      if (!(await this._confirmCreation(businessType))) {
        Logger.log('\n❌ Operação cancelada pelo usuário', 'red');
        return;
      }

      await this._executeCreation(businessType);

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

    const assetManager = new AssetManager(businessType.key);

    assetManager.createDirectories();

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
    Logger.log(`   • ${DartConfigUpdater.getConfigFilePath()}`);

    Logger.log(`\n🔄 Próximos passos:`);
    Logger.log(`   1. Adicione suas animações e imagens nos diretórios criados`);
    Logger.log(`   2. Execute o setup-white-label.js para configurar um cliente`);
    Logger.log(`   3. O script detectará automaticamente o novo tipo de negócio`);
  }
}

module.exports = { BusinessTypeCreator };
