const fs = require('fs');
const path = require('path');
const firebaseOptionsGenerator = require('../modules/firebase-options-generator');
const { TARGET_ROOT, CLIENTS_DIR } = require('./config');

function copyFirebaseConfigs(clientCode, clientConfig) {
  console.log('\nCopying Firebase configuration files...');

  const clientDir = path.join(CLIENTS_DIR, clientCode);
  let copied = 0;
  let missing = [];

  const residualFiles = [
    path.join(TARGET_ROOT, 'android', 'google-services.json'),
    path.join(TARGET_ROOT, 'ios', 'GoogleService-Info.plist'),
  ];

  residualFiles.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`  Removido arquivo residual: ${path.relative(TARGET_ROOT, filePath)}`);
    }
  });

  const androidPossiblePaths = [
    path.join(clientDir, 'android', 'google-services.json'),
    path.join(clientDir, 'google-services.json'),
  ];
  const androidDest = path.join(TARGET_ROOT, 'android', 'app', 'google-services.json');

  const androidSource = androidPossiblePaths.find((p) => fs.existsSync(p));
  if (androidSource) {
    fs.copyFileSync(androidSource, androidDest);
    const relativePath = path.relative(clientDir, androidSource);
    console.log(`  google-services.json copiado para android/app/ (de ${relativePath})`);
    copied++;
  } else {
    missing.push('google-services.json');
  }

  const iosPossiblePaths = [
    path.join(clientDir, 'ios', 'Runner', 'GoogleService-Info.plist'),
    path.join(clientDir, 'ios', 'GoogleService-Info.plist'),
    path.join(clientDir, 'GoogleService-Info.plist'),
  ];
  const iosDest = path.join(TARGET_ROOT, 'ios', 'Runner', 'GoogleService-Info.plist');

  const iosSource = iosPossiblePaths.find((p) => fs.existsSync(p));
  if (iosSource) {
    fs.copyFileSync(iosSource, iosDest);
    const relativePath = path.relative(clientDir, iosSource);
    console.log(`  GoogleService-Info.plist copiado para ios/Runner/ (de ${relativePath})`);
    copied++;
  } else {
    missing.push('ios/Runner/GoogleService-Info.plist');
  }

  const dartPossiblePaths = [
    path.join(clientDir, 'lib', 'firebase_options.dart'),
    path.join(clientDir, 'firebase_options.dart'),
  ];
  const dartDest = path.join(TARGET_ROOT, 'lib', 'firebase_options.dart');

  const dartSource = dartPossiblePaths.find((p) => fs.existsSync(p));
  if (dartSource) {
    fs.copyFileSync(dartSource, dartDest);
    const relativePath = path.relative(clientDir, dartSource);
    console.log(`  firebase_options.dart copiado para lib/ (de ${relativePath})`);
    copied++;
  } else {
    console.log(`  firebase_options.dart nao encontrado, tentando gerar automaticamente...`);
    let generated = false;

    const projectId = clientConfig.firebaseOptions?.projectId;
    if (projectId) {
      try {
        const { execSync } = require('child_process');
        execSync(`flutterfire configure --project=${projectId} --out=lib/firebase_options.dart --yes`, {
          cwd: TARGET_ROOT,
          stdio: 'inherit',
          timeout: 180000,
        });
        console.log('  firebase_options.dart gerado via FlutterFire CLI');

        if (fs.existsSync(dartDest)) {
          const clientLibDir = path.join(clientDir, 'lib');
          if (!fs.existsSync(clientLibDir)) {
            fs.mkdirSync(clientLibDir, { recursive: true });
          }
          fs.copyFileSync(dartDest, path.join(clientLibDir, 'firebase_options.dart'));
          console.log('  firebase_options.dart salvo na pasta do cliente para uso futuro');
        }
        generated = true;
        copied++;
      } catch (flutterfireError) {
        console.log(`  FlutterFire CLI falhou: ${flutterfireError.message}`);
        console.log('  Tentando gerar a partir dos arquivos de configuracao existentes...');
      }
    }

    if (!generated) {
      const bundleId = clientConfig.bundleId || clientConfig.packageName;
      const clientName = clientConfig.clientName || clientCode;

      if (bundleId) {
        generated = firebaseOptionsGenerator.generateFirebaseOptionsFromConfigs(
          clientDir,
          TARGET_ROOT,
          bundleId,
          clientName
        );
        if (generated) {
          copied++;
        }
      }
    }

    if (!generated) {
      missing.push('lib/firebase_options.dart');
    }
  }

  if (missing.length > 0) {
    console.log('\n  ATENCAO: Arquivos Firebase nao encontrados no cliente:');
    missing.forEach((file) => console.log(`     - ${file}`));
    console.log('\n  Para corrigir, execute para baixar os arquivos:');
    console.log(`     cd clients/${clientCode}`);
    console.log(`     firebase apps:sdkconfig android --project <project-id> > android/google-services.json`);
    console.log(`     firebase apps:sdkconfig ios --project <project-id> > ios/Runner/GoogleService-Info.plist`);
    console.log('\n  Para regenerar firebase_options.dart:');
    console.log(`     cd white_label_app && flutterfire configure --project=<project-id>`);
    console.log('\n  O app pode nao funcionar corretamente sem esses arquivos!');
  }

  if (copied > 0) {
    console.log(`\n  ${copied} arquivo(s) Firebase copiado(s)`);
  }
}

function copyFirebaseJson(clientCode, clientConfig) {
  console.log('\nCopying firebase.json with flutter.platforms...');

  const sourcePath = path.join(CLIENTS_DIR, clientCode, 'firebase.json');
  const targetPath = path.join(TARGET_ROOT, 'firebase.json');

  if (!fs.existsSync(sourcePath)) {
    console.log('  firebase.json nao encontrado no cliente');
    console.log('     FlutterFire CLI pode falhar durante upload de simbolos Crashlytics');
    return;
  }

  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

    if (!firebaseConfig.flutter?.platforms) {
      console.log('  flutter.platforms nao encontrado no firebase.json do cliente');
      console.log('     Gerando a partir do config.json...');

      const { firebaseOptions } = clientConfig;
      if (firebaseOptions) {
        firebaseConfig.flutter = {
          platforms: {
            android: {
              default: {
                projectId: firebaseOptions.projectId,
                appId: firebaseOptions.appId,
                fileOutput: 'android/app/google-services.json',
              },
            },
            ios: {
              default: {
                projectId: firebaseOptions.projectId,
                appId: firebaseOptions.iosAppId || firebaseOptions.appId,
                uploadDebugSymbols: true,
                fileOutput: 'ios/Runner/GoogleService-Info.plist',
              },
            },
            dart: {
              'lib/firebase_options.dart': {
                projectId: firebaseOptions.projectId,
                configurations: {
                  android: firebaseOptions.appId,
                  ios: firebaseOptions.iosAppId || firebaseOptions.appId,
                },
              },
            },
          },
        };
        console.log('  flutter.platforms gerado a partir do config.json');
      }
    }

    fs.writeFileSync(targetPath, JSON.stringify(firebaseConfig, null, 2) + '\n');
    console.log('  firebase.json copiado para white_label_app/');
  } catch (error) {
    console.error('  Erro ao processar firebase.json:', error.message);
  }
}

function copyShorebirdConfig(clientCode) {
  console.log('\nCopying Shorebird configuration...');

  const sourcePath = path.join(CLIENTS_DIR, clientCode, 'shorebird.yaml');
  const targetPath = path.join(TARGET_ROOT, 'shorebird.yaml');

  if (fs.existsSync(sourcePath)) {
    const content = fs.readFileSync(sourcePath, 'utf8');
    fs.copyFileSync(sourcePath, targetPath);

    if (content.includes('placeholder-')) {
      console.log('  shorebird.yaml copiado (app_id e placeholder)');
      console.log('     Execute "cd white_label_app && shorebird init" para gerar app_id real');
    } else {
      console.log('  shorebird.yaml copiado para white_label_app/');
    }
  } else {
    console.log('  shorebird.yaml nao encontrado para este cliente');
    console.log('     OTA updates via Shorebird nao estarao disponiveis');
  }
}

function generateGHAExportOptions(clientConfig) {
  console.log('\nGenerating GHAExportOptions.plist...');

  const { bundleId } = clientConfig;
  if (!bundleId) {
    console.log('  ATENCAO: bundleId nao encontrado no config.json, pulando GHAExportOptions.plist');
    return;
  }

  const teamId = process.env.APPLE_TEAM_ID || '84LT77P2DM';

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${bundleId}</key>
    <string>match AppStore ${bundleId}</string>
  </dict>
  <key>signingCertificate</key>
  <string>Apple Distribution</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>teamID</key>
  <string>${teamId}</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>testFlightInternalTestingOnly</key>
  <false/>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
`;

  const targetPath = path.join(TARGET_ROOT, 'ios', 'GHAExportOptions.plist');
  const iosDir = path.join(TARGET_ROOT, 'ios');
  if (!fs.existsSync(iosDir)) {
    fs.mkdirSync(iosDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, plistContent, 'utf8');
  console.log(`  GHAExportOptions.plist gerado com bundleId: ${bundleId}`);
}

function copyServiceAccount(clientCode) {
  console.log('\nCopying service-account.json...');

  const clientDir = path.join(CLIENTS_DIR, clientCode);

  // Limpar residual na raiz do white_label_app
  const residualPath = path.join(TARGET_ROOT, 'service-account.json');
  if (fs.existsSync(residualPath)) {
    fs.unlinkSync(residualPath);
    console.log('  Removido service-account.json residual da raiz');
  }

  const sourcePath = path.join(clientDir, 'service-account.json');
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, residualPath);
    console.log('  service-account.json copiado para white_label_app/');
  } else {
    console.log('  service-account.json nao encontrado para este cliente');
    console.log('     Alguns scripts de administracao podem nao funcionar');
  }
}

module.exports = {
  copyFirebaseConfigs,
  copyFirebaseJson,
  copyShorebirdConfig,
  generateGHAExportOptions,
  copyServiceAccount,
};
