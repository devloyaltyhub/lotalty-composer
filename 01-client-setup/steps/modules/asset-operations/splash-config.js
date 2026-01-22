const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HEX_RADIX = 16;
const RGB_MAX_VALUE = 255;
const HEX_RED_END = 2;
const HEX_GREEN_END = 4;
const HEX_BLUE_END = 6;
const DECIMAL_PLACES = 6;

function hexToRgbNormalized(hexColor) {
  const hex = hexColor.replace('#', '');
  return {
    red: parseInt(hex.substring(0, HEX_RED_END), HEX_RADIX) / RGB_MAX_VALUE,
    green: parseInt(hex.substring(HEX_RED_END, HEX_GREEN_END), HEX_RADIX) / RGB_MAX_VALUE,
    blue: parseInt(hex.substring(HEX_GREEN_END, HEX_BLUE_END), HEX_RADIX) / RGB_MAX_VALUE,
  };
}

function updateSplashConfig(pubspecPath, clientConfig) {
  console.log('Updating splash screen configuration...');

  if (!fs.existsSync(pubspecPath)) {
    console.warn('  pubspec.yaml nao encontrado.');
    return;
  }

  const splashColor = clientConfig.colors?.splashBackground || clientConfig.colors?.primary || '#FFFFFF';
  const colorHex = splashColor.replace('#', '').toUpperCase();

  let pubspec = fs.readFileSync(pubspecPath, 'utf8');

  pubspec = pubspec.replace(
    /flutter_native_splash:\s*\n\s*color:\s*"#[A-Fa-f0-9]+"/,
    `flutter_native_splash:\n  color: "#${colorHex}"`
  );

  pubspec = pubspec.replace(
    /image:\s*"assets\/client_specific_assets\/logo\.png"/g,
    'image: "assets/client_specific_assets/transparent-logo.png"'
  );

  pubspec = pubspec.replace(
    /android_12:\s*\n\s*image:\s*"assets\/client_specific_assets\/[^"]+"\s*\n\s*color:\s*"#[A-Fa-f0-9]+"/,
    `android_12:\n    image: "assets/client_specific_assets/transparent-logo.png"\n    color: "#${colorHex}"`
  );

  fs.writeFileSync(pubspecPath, pubspec, 'utf8');
  console.log(`  Splash configurada: cor ${splashColor}, logo transparente`);
}

function copyTransparentLogoToLaunchImage(targetRoot) {
  const sourcePath = path.join(targetRoot, 'assets/client_specific_assets/transparent-logo.png');
  const launchImageDir = path.join(targetRoot, 'ios/Runner/Assets.xcassets/LaunchImage.imageset');

  if (!fs.existsSync(sourcePath)) {
    console.warn('  transparent-logo.png nao encontrado.');
    return;
  }

  const destinations = ['LaunchImage.png', 'LaunchImage@2x.png', 'LaunchImage@3x.png'];
  destinations.forEach((filename) => {
    const destPath = path.join(launchImageDir, filename);
    fs.copyFileSync(sourcePath, destPath);
  });

  console.log('  transparent-logo.png copiado para LaunchImage.imageset');
}

function updateiOSLaunchScreen(targetRoot, clientConfig) {
  console.log('Updating iOS LaunchScreen...');

  copyTransparentLogoToLaunchImage(targetRoot);

  const storyboardPath = path.join(targetRoot, 'ios/Runner/Base.lproj/LaunchScreen.storyboard');

  if (!fs.existsSync(storyboardPath)) {
    console.warn('  LaunchScreen.storyboard nao encontrado.');
    return;
  }

  const splashColor = clientConfig.colors?.splashBackground || clientConfig.colors?.primary || '#FFFFFF';
  const rgb = hexToRgbNormalized(splashColor);

  let storyboard = fs.readFileSync(storyboardPath, 'utf8');

  const colorAttr =
    `<color key="backgroundColor" ` +
    `red="${rgb.red.toFixed(DECIMAL_PLACES)}" ` +
    `green="${rgb.green.toFixed(DECIMAL_PLACES)}" ` +
    `blue="${rgb.blue.toFixed(DECIMAL_PLACES)}" ` +
    `alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`;

  storyboard = storyboard.replace(/<color key="backgroundColor"[^/]*\/>/, colorAttr);

  fs.writeFileSync(storyboardPath, storyboard, 'utf8');
  console.log(`  iOS LaunchScreen: backgroundColor=${splashColor}, logo=transparent`);
}

function replaceBusinessTypePaths(pubspec, businessTypes, businessType) {
  let updatedPubspec = pubspec;

  businessTypes.forEach((typeItem) => {
    const animRegex = new RegExp(`assets/animations/${typeItem.key}/`, 'g');
    updatedPubspec = updatedPubspec.replace(animRegex, `assets/animations/${businessType}/`);

    const imgRegex = new RegExp(`assets/images/${typeItem.key}/`, 'g');
    updatedPubspec = updatedPubspec.replace(imgRegex, `assets/images/${businessType}/`);

    const configRegex = new RegExp(`assets/configs/${typeItem.key}/`, 'g');
    updatedPubspec = updatedPubspec.replace(configRegex, `assets/configs/${businessType}/`);
  });

  return updatedPubspec;
}

function runFlutterCommands(targetRoot) {
  execSync('flutter pub get', { stdio: 'inherit', cwd: targetRoot });
  console.log('flutter pub get executado com sucesso.');

  execSync('dart run flutter_native_splash:create', { stdio: 'inherit', cwd: targetRoot });
  console.log('flutter_native_splash:create executado com sucesso.');
}

function updatePubspecAssets(businessType, pubspecPath, businessTypes, targetRoot, clientConfig) {
  if (!fs.existsSync(pubspecPath)) {
    console.warn('pubspec.yaml nao encontrado.');
    return;
  }

  let pubspec = fs.readFileSync(pubspecPath, 'utf8');
  pubspec = replaceBusinessTypePaths(pubspec, businessTypes, businessType);

  fs.writeFileSync(pubspecPath, pubspec, 'utf8');
  console.log(`pubspec.yaml atualizado para assets do tipo "${businessType}".`);

  try {
    runFlutterCommands(targetRoot);

    if (clientConfig) {
      updateiOSLaunchScreen(targetRoot, clientConfig);
    }
  } catch (error) {
    console.error(
      'Erro ao executar flutter pub get ou flutter_native_splash:create:',
      error.message
    );
  }
}

module.exports = {
  hexToRgbNormalized,
  updateSplashConfig,
  copyTransparentLogoToLaunchImage,
  updateiOSLaunchScreen,
  replaceBusinessTypePaths,
  runFlutterCommands,
  updatePubspecAssets,
};
