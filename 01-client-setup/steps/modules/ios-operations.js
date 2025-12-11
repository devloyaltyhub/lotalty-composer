const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('../../config');

function cleanDerivedData() {
  const homeDir = require('os').homedir();
  const derivedDataPath = path.join(homeDir, 'Library/Developer/Xcode/DerivedData');

  if (fs.existsSync(derivedDataPath)) {
    console.log('  🗑️  Removing Xcode DerivedData...');
    fs.rmSync(derivedDataPath, { recursive: true, force: true });
    console.log('  ✅ DerivedData removed');
  }
}

function cleanWorkspaceUserData(targetRoot) {
  const xcuserdataPath = path.join(targetRoot, 'ios/Runner.xcworkspace/xcuserdata');

  if (fs.existsSync(xcuserdataPath)) {
    console.log('  🗑️  Removing Xcode workspace user data...');
    fs.rmSync(xcuserdataPath, { recursive: true, force: true });
    console.log('  ✅ Workspace user data removed');
  }
}

/**
 * Clean Xcode caches to ensure Bundle ID and other changes are reflected
 */
function cleanXcodeCaches(targetRoot) {
  console.log('\n🧹 Cleaning Xcode caches...');

  try {
    cleanDerivedData();
    cleanWorkspaceUserData(targetRoot);

    console.log('✅ Xcode caches cleaned successfully');
    console.log('   💡 If you have Xcode open, please close and reopen it to see the changes');
  } catch (error) {
    console.warn('⚠️  Warning: Could not clean Xcode caches:', error.message);
    console.log('   You may need to manually clean Xcode caches if you see stale data');
  }
}

/**
 * Clean Flutter build artifacts
 */
function cleanFlutterBuild(targetRoot) {
  console.log('\n🧹 Cleaning Flutter build artifacts...');

  try {
    execSync('flutter clean', { stdio: 'inherit', cwd: targetRoot });
    console.log('✅ Flutter build cleaned successfully');
  } catch (error) {
    console.warn('⚠️  Warning: Flutter clean failed:', error.message);
  }
}

/**
 * Run flutter pub get to restore dependencies and generate configuration files
 * This is required after flutter clean to regenerate Generated.xcconfig for iOS
 */
function flutterPubGet(targetRoot) {
  console.log('\n📦 Running flutter pub get...');

  try {
    execSync('flutter pub get', { stdio: 'inherit', cwd: targetRoot });
    console.log('✅ Flutter dependencies restored successfully');
  } catch (error) {
    console.warn('⚠️  Warning: Flutter pub get failed:', error.message);
    console.log('   You may need to run "flutter pub get" manually');
  }
}

function checkPodfileExists(iosPath) {
  const podfilePath = path.join(iosPath, 'Podfile');

  if (!fs.existsSync(podfilePath)) {
    console.log('⚠️  Podfile not found, skipping pod install');
    console.log('   Expected Podfile at:', podfilePath);
    return false;
  }

  return true;
}

function runPodInstall(iosPath) {
  const podInstallCmd = 'LANG=en_US.UTF-8 pod install';
  const podTimeout = config.timeouts.podInstall || 300000;

  execSync(podInstallCmd, {
    stdio: 'inherit',
    cwd: iosPath,
    timeout: podTimeout,
  });
}

/**
 * Reinstall iOS pods with proper encoding
 */
function reinstallPods(targetRoot) {
  console.log('\n📦 Reinstalling iOS pods...');

  try {
    const iosPath = path.join(targetRoot, 'ios');

    if (!fs.existsSync(iosPath)) {
      console.log('⚠️  iOS directory not found, skipping pod install');
      return;
    }

    if (!checkPodfileExists(iosPath)) {
      return;
    }

    runPodInstall(iosPath);
    console.log('✅ Pods reinstalled successfully');
  } catch (error) {
    console.warn('⚠️  Warning: Pod install failed:', error.message);
    console.log("   You may need to run 'pod install' manually in the ios/ directory");
  }
}

function modifyAndroidManifest(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    const applicationTagRegex = /(<application\s+)([^>]+)>/;

    content = content.replace(applicationTagRegex, (match, openingTagPart, attributes) => {
      if (attributes.includes('android:label=') && !attributes.includes('android:icon=')) {
        const newAttributes = attributes.replace(
          /(android:label\s*=\s*"[^"]*")/,
          '$1 android:icon="@mipmap/ic_launcher"'
        );
        return `${openingTagPart}${newAttributes}>`;
      }
      return match;
    });

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(
        `AndroidManifest.xml: Modificado com sucesso para garantir que android:icon="@mipmap/ic_launcher" esteja presente na tag <application>.`
      );
    } else {
      console.log(
        'AndroidManifest.xml: Nenhuma alteração necessária para android:icon na tag <application> (já estava configurado corretamente ou o label estava ausente).'
      );
    }
  } catch (error) {
    console.error(`Erro ao modificar o AndroidManifest.xml em ${filePath}: ${error.message}`);
  }
}

/**
 * Clean old Kotlin package directories before running package_rename
 * This prevents stale package directories from previous clients
 * @param {string} targetRoot - Path to white_label_app
 */
function cleanOldKotlinPackages(targetRoot) {
  console.log('\n🧹 Cleaning old Kotlin package directories...');

  const kotlinDir = path.join(targetRoot, 'android/app/src/main/kotlin');

  if (!fs.existsSync(kotlinDir)) {
    console.log('  ⚠️  Kotlin directory not found, skipping cleanup');
    return;
  }

  try {
    // Remove all contents of the kotlin directory
    const contents = fs.readdirSync(kotlinDir);
    let removedCount = 0;

    for (const item of contents) {
      const itemPath = path.join(kotlinDir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        console.log(`  🗑️  Removing old package: ${item}/`);
        fs.rmSync(itemPath, { recursive: true, force: true });
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`  ✅ Removed ${removedCount} old package director${removedCount === 1 ? 'y' : 'ies'}`);
    } else {
      console.log('  ✅ No old package directories found');
    }
  } catch (error) {
    console.warn('  ⚠️  Warning: Could not clean Kotlin packages:', error.message);
  }
}

function runPackageRename(targetRoot) {
  // Clean old packages first to prevent stale directories
  cleanOldKotlinPackages(targetRoot);

  console.log('Executando o comando "dart run package_rename" dentro da pasta white_label_app...');
  execSync('dart run package_rename', { stdio: 'inherit', cwd: targetRoot });
}

/**
 * Post-processing: update manifest, package rename, clean build
 */
function postProcess(targetRoot) {
  const manifestPath = path.join(targetRoot, 'android/app/src/main/AndroidManifest.xml');
  console.log(`Verificando e atualizando ${manifestPath} para o atributo android:icon...`);
  modifyAndroidManifest(manifestPath);

  runPackageRename(targetRoot);
  cleanFlutterBuild(targetRoot);
  flutterPubGet(targetRoot);
  reinstallPods(targetRoot);
  cleanXcodeCaches(targetRoot);
}

module.exports = {
  cleanXcodeCaches,
  cleanFlutterBuild,
  flutterPubGet,
  reinstallPods,
  postProcess,
  modifyAndroidManifest,
};
