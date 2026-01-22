const {
  Logger,
  InputHandler,
  FileSystemService,
  BusinessTypeRepository,
  ValidationService,
  AssetManager,
  DartConfigUpdater,
  BusinessTypeCreator,
  BusinessTypeDeleter,
} = require('./business-type-manager/index');

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

if (require.main === module) {
  main();
}

module.exports = {
  BusinessTypeRepository,
  ValidationService,
  FileSystemService,
  AssetManager,
  DartConfigUpdater,
  BusinessTypeCreator,
  BusinessTypeDeleter,
};
