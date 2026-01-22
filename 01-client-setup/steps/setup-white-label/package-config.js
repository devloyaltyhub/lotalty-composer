const fs = require('fs');
const path = require('path');
const { TARGET_ROOT } = require('./config');

function generatePackageRenameConfig(clientConfig) {
  console.log('\nGenerating package_rename_config.yaml from config.json...');

  const { appName, bundleId } = clientConfig;

  if (!appName || !bundleId) {
    console.error('  ERRO: appName ou bundleId nao encontrado no config.json');
    return;
  }

  const bundleParts = bundleId.split('.');
  const bundleName = bundleParts.slice(Math.max(bundleParts.length - 2, 1)).join('');

  const yamlContent = `package_rename_config:
  android:
    app_name: ${appName}
    package_name: ${bundleId}

  ios:
    app_name: ${appName}
    bundle_name: ${bundleName}
    package_name: ${bundleId}
`;

  const targetPath = path.join(TARGET_ROOT, 'package_rename_config.yaml');
  fs.writeFileSync(targetPath, yamlContent, 'utf8');

  console.log(`  package_rename_config.yaml gerado com app_name: "${appName}"`);
  console.log('  CFBundleDisplayName sera atualizado para corresponder ao App Store Connect');
}

function saveUpdatedConfig(clientConfig) {
  const configPath = path.join(TARGET_ROOT, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(clientConfig, null, 2) + '\n', 'utf8');
  console.log(`  config.json atualizado com businessType: ${clientConfig.businessType}`);
}

module.exports = {
  generatePackageRenameConfig,
  saveUpdatedConfig,
};
