const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  downloadAndroidConfig,
  downloadIosConfig,
} = require('../create-firebase-project/config-download');

function isFirebaseLoggedIn() {
  try {
    const output = execSync('firebase login:list --json', {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 10000,
    });
    const data = JSON.parse(output);
    return Array.isArray(data.result) && data.result.length > 0;
  } catch {
    return false;
  }
}

async function downloadFreshConfigs(clientDir, firebaseProjectId) {
  const results = { android: false, ios: false };

  if (!firebaseProjectId) {
    console.log('  firebaseProjectId nao encontrado no config.json, pulando download');
    return results;
  }

  if (!isFirebaseLoggedIn()) {
    console.log('  Firebase CLI nao autenticado. Execute "firebase login" para baixar configs atualizadas.');
    console.log('  Usando versao em cache (se disponivel)...');
    return results;
  }

  console.log(`  Baixando configs atualizadas do Firebase (${firebaseProjectId})...`);

  const androidPath = path.join(clientDir, 'android', 'google-services.json');
  try {
    await downloadAndroidConfig(firebaseProjectId, androidPath);
    results.android = true;
  } catch (error) {
    console.log(`  Falha ao baixar google-services.json: ${error.message}`);
    console.log('  Usando versao em cache (se disponivel)...');
  }

  const iosPath = path.join(clientDir, 'ios', 'Runner', 'GoogleService-Info.plist');
  try {
    const downloaded = await downloadIosConfig(firebaseProjectId, iosPath);
    results.ios = !!downloaded;
  } catch (error) {
    console.log(`  Falha ao baixar GoogleService-Info.plist: ${error.message}`);
    console.log('  Usando versao em cache (se disponivel)...');
  }

  return results;
}

module.exports = { downloadFreshConfigs };
