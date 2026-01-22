const fs = require('fs');
const path = require('path');
const { TARGET_ROOT, LOYALTY_CREDENTIALS_PATH } = require('./config');

function parseArguments() {
  const args = process.argv.slice(2);
  const clientArg = args.find((arg) => !arg.startsWith('--')) || null;
  const deployMode = args.includes('--deploy-mode');
  return { clientArg, deployMode };
}

function validateDeployPrerequisites(clientCode) {
  console.log(`\nValidando setup existente para cliente: ${clientCode}`);

  const configPath = path.join(TARGET_ROOT, 'config.json');
  if (!fs.existsSync(configPath)) {
    console.error('\nERRO: Setup nao encontrado!');
    console.error(`   Arquivo nao existe: ${configPath}`);
    console.error(`\nExecute primeiro: npm run start -- ${clientCode}`);
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('\nERRO: config.json corrompido!');
    console.error(`   ${error.message}`);
    console.error(`\nExecute novamente: npm run start -- ${clientCode}`);
    process.exit(1);
  }

  if (config.clientCode !== clientCode) {
    console.error('\nERRO: Cliente diferente configurado!');
    console.error(`   Configurado: ${config.clientCode}`);
    console.error(`   Solicitado: ${clientCode}`);
    console.error(`\nExecute primeiro: npm run start -- ${clientCode}`);
    process.exit(1);
  }

  console.log('  config.json encontrado');
  console.log(`  Cliente correto: ${config.clientName} (${config.clientCode})`);

  const criticalAssets = [
    path.join(TARGET_ROOT, 'assets/client_specific_assets/logo.png'),
    path.join(TARGET_ROOT, 'pubspec.yaml'),
  ];

  let allAssetsPresent = true;
  for (const assetPath of criticalAssets) {
    if (!fs.existsSync(assetPath)) {
      console.error(`  Asset faltando: ${path.basename(assetPath)}`);
      allAssetsPresent = false;
    }
  }

  if (!allAssetsPresent) {
    console.error('\nERRO: Assets criticos faltando!');
    console.error(`\nExecute novamente: npm run start -- ${clientCode}`);
    process.exit(1);
  }

  console.log('  Assets criticos presentes');
  console.log('\nDeploy mode: Setup ja configurado, pulando operacoes redundantes');

  return true;
}

function validateLoyaltyCredentialsRepo() {
  console.log('Validating loyalty-credentials repository...');

  if (!fs.existsSync(LOYALTY_CREDENTIALS_PATH)) {
    console.error('\nERRO: Repositorio loyalty-credentials nao encontrado!');
    console.error(`   Caminho esperado: ${LOYALTY_CREDENTIALS_PATH}`);
    console.error('\nPara resolver:');
    console.error('   1. Clone o repositorio loyalty-credentials como irmao do loyalty-compose:');
    console.error('      cd .. && git clone <url-do-repo> loyalty-credentials');
    console.error('   2. Certifique-se de que a estrutura seja:');
    console.error('      loyaltyhub/');
    console.error('        |- loyalty-compose/');
    console.error('        \\- loyalty-credentials/');
    console.error('\nEste repositorio contem keystores Android e outras credenciais essenciais.');
    process.exit(1);
  }

  console.log('  loyalty-credentials encontrado');
  return true;
}

function validateBusinessType(businessType, BUSINESS_TYPES) {
  const validBusinessTypes = BUSINESS_TYPES.map((typeItem) => typeItem.key);
  if (!validBusinessTypes.includes(businessType)) {
    throw new Error(
      `Invalid business type "${businessType}". Valid options: ${validBusinessTypes.join(', ')}`
    );
  }
}

module.exports = {
  parseArguments,
  validateDeployPrerequisites,
  validateLoyaltyCredentialsRepo,
  validateBusinessType,
};
