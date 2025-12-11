const fs = require('fs');
const path = require('path');

function getKeystoreFiles(clientCredentialsDir) {
  return [
    {
      source: path.join(clientCredentialsDir, 'keystore-debug.jks'),
      dest: null, // Set later
      name: 'Debug keystore',
    },
    {
      source: path.join(clientCredentialsDir, 'keystore-release.jks'),
      dest: null, // Set later
      name: 'Release keystore',
    },
    {
      source: path.join(clientCredentialsDir, 'keystore.properties'),
      dest: null, // Set later
      name: 'Key properties',
      transform: true,
    },
  ];
}

function updateKeystorePaths(content) {
  let updatedContent = content;

  updatedContent = updatedContent.replace(
    /debug\.storeFile=.*/,
    'debug.storeFile=./app/keystore-debug.jks'
  );
  updatedContent = updatedContent.replace(
    /release\.storeFile=.*/,
    'release.storeFile=./app/keystore-release.jks'
  );

  return updatedContent;
}

function copyKeystoreFile(file) {
  if (!fs.existsSync(file.source)) {
    console.log(`  ⚠️  ${file.name} not found, skipping`);
    return false;
  }

  if (file.transform) {
    let content = fs.readFileSync(file.source, 'utf8');
    content = updateKeystorePaths(content);
    fs.writeFileSync(file.dest, content);
  } else {
    fs.copyFileSync(file.source, file.dest);
  }

  console.log(`  ✅ ${file.name} copied`);
  return true;
}

function displayKeystoreSummary(copiedCount) {
  if (copiedCount > 0) {
    console.log('✅ Android keystores configured successfully');
    console.log('   Debug keystore:   android/app/keystore-debug.jks');
    console.log('   Release keystore: android/app/keystore-release.jks');
    console.log('   Properties file:  android/key.properties');
  } else {
    console.log('⚠️  No keystores were copied, you may need to generate them');
  }
}

function ensureAndroidDirectories(androidDir, appDir) {
  if (!fs.existsSync(androidDir)) {
    console.log('⚠️  Android directory not found, skipping keystore setup');
    return false;
  }

  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true });
  }

  return true;
}

function copyAllKeystoreFiles(filesToCopy) {
  let copiedCount = 0;

  for (const file of filesToCopy) {
    if (copyKeystoreFile(file)) {
      copiedCount++;
    }
  }

  return copiedCount;
}

/**
 * Copies Android keystores from loyalty-credentials to white label app
 * Required for App Check Play Integrity API and app signing
 */
function copyAndroidKeystore(targetRoot, clientCode) {
  console.log('\n🔐 Setting up Android keystores...');

  const automationRoot = path.resolve(__dirname, '../..');
  const loyaltyAppRoot = path.resolve(automationRoot, '..');
  const credentialsPath = path.join(loyaltyAppRoot, '..', 'loyalty-credentials');
  const clientCredentialsDir = path.join(credentialsPath, 'clients', clientCode, 'android');

  const androidDir = path.join(targetRoot, 'android');
  const appDir = path.join(androidDir, 'app');

  if (!fs.existsSync(clientCredentialsDir)) {
    console.log('⚠️  Android keystores not found in loyalty-credentials');
    console.log(`   Expected path: ${clientCredentialsDir}`);
    console.log('   Run the client creation wizard to generate keystores');
    return;
  }

  try {
    if (!ensureAndroidDirectories(androidDir, appDir)) {
      return;
    }

    const filesToCopy = getKeystoreFiles(clientCredentialsDir);

    filesToCopy[0].dest = path.join(appDir, 'keystore-debug.jks');
    filesToCopy[1].dest = path.join(appDir, 'keystore-release.jks');
    filesToCopy[2].dest = path.join(androidDir, 'key.properties');

    const copiedCount = copyAllKeystoreFiles(filesToCopy);
    displayKeystoreSummary(copiedCount);
  } catch (error) {
    console.error('❌ Error copying Android keystores:', error.message);
    console.log('⚠️  You may need to configure the keystores manually');
  }
}

module.exports = {
  copyAndroidKeystore,
};
