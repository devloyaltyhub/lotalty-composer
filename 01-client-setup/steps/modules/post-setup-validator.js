const fs = require('fs');
const path = require('path');

// Constants
// From: 01-client-setup/steps/modules/ -> ../../../../loyalty-app
const TARGET_ROOT = path.join(__dirname, '../../../../loyalty-app');

/**
 * Post-setup validation module
 * Validates that all Firebase and native configs are consistent with config.json
 */

/**
 * Extract project ID from firebase_options.dart
 * @param {string} filePath - Path to firebase_options.dart
 * @returns {string|null} - Project ID or null if not found
 */
function extractFirebaseOptionsProjectId(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/projectId:\s*'([^']+)'/);
  return match ? match[1] : null;
}

/**
 * Extract value from plist file
 * @param {string} filePath - Path to plist file
 * @param {string} key - Key to extract
 * @returns {string|null} - Value or null if not found
 */
function extractPlistValue(filePath, key) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const regex = new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`);
  const match = content.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract project ID from google-services.json
 * @param {string} filePath - Path to google-services.json
 * @returns {object|null} - Object with projectId and packageNames or null
 */
function extractGoogleServicesInfo(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const projectId = content.project_info?.project_id || null;
    const packageNames =
      content.client?.map((c) => c.client_info?.android_client_info?.package_name).filter(Boolean) ||
      [];

    return { projectId, packageNames };
  } catch {
    return null;
  }
}

/**
 * Extract bundle ID from Xcode project
 * @param {string} projectPath - Path to project.pbxproj
 * @returns {string|null} - Bundle ID or null
 */
function extractXcodeBundleId(projectPath) {
  if (!fs.existsSync(projectPath)) {
    return null;
  }

  const content = fs.readFileSync(projectPath, 'utf8');
  // Find PRODUCT_BUNDLE_IDENTIFIER for main target (not tests)
  const matches = content.match(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g);

  if (!matches) {
    return null;
  }

  // Filter out test targets and get the main bundle ID
  for (const match of matches) {
    const bundleId = match.match(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/)[1];
    if (!bundleId.includes('Test') && !bundleId.includes('test')) {
      return bundleId;
    }
  }

  return null;
}

/**
 * Extract application ID from build.gradle
 * @param {string} filePath - Path to build.gradle
 * @returns {object|null} - Object with applicationId and namespace
 */
function extractGradleIds(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  const appIdMatch = content.match(/applicationId\s*=\s*"([^"]+)"/);
  const namespaceMatch = content.match(/namespace\s*=\s*"([^"]+)"/);

  return {
    applicationId: appIdMatch ? appIdMatch[1] : null,
    namespace: namespaceMatch ? namespaceMatch[1] : null,
  };
}

/**
 * Run post-setup validation
 * @param {object} clientConfig - Client configuration from config.json
 * @returns {object} - Validation results with errors and warnings
 */
function validatePostSetup(clientConfig) {
  const errors = [];
  const warnings = [];
  const checks = [];

  const expectedProjectId = clientConfig.firebaseProjectId;
  const expectedBundleId = clientConfig.bundleId;

  console.log('\n🔍 Validando configurações pós-setup...');
  console.log(`   Expected Firebase Project: ${expectedProjectId}`);
  console.log(`   Expected Bundle ID: ${expectedBundleId}`);

  // 1. Validate firebase_options.dart
  const firebaseOptionsPath = path.join(TARGET_ROOT, 'lib', 'firebase_options.dart');
  const firebaseOptionsProjectId = extractFirebaseOptionsProjectId(firebaseOptionsPath);

  if (!firebaseOptionsProjectId) {
    errors.push({
      file: 'lib/firebase_options.dart',
      issue: 'Arquivo não encontrado ou projectId não extraído',
      expected: expectedProjectId,
      found: null,
    });
  } else if (firebaseOptionsProjectId !== expectedProjectId) {
    errors.push({
      file: 'lib/firebase_options.dart',
      issue: 'Project ID incorreto',
      expected: expectedProjectId,
      found: firebaseOptionsProjectId,
    });
  } else {
    checks.push({ file: 'lib/firebase_options.dart', status: 'OK', value: firebaseOptionsProjectId });
  }

  // 2. Validate GoogleService-Info.plist (iOS)
  const plistPath = path.join(TARGET_ROOT, 'ios', 'Runner', 'GoogleService-Info.plist');
  const plistProjectId = extractPlistValue(plistPath, 'PROJECT_ID');
  const plistBundleId = extractPlistValue(plistPath, 'BUNDLE_ID');

  if (!plistProjectId) {
    errors.push({
      file: 'ios/Runner/GoogleService-Info.plist',
      issue: 'Arquivo não encontrado ou PROJECT_ID não extraído',
      expected: expectedProjectId,
      found: null,
    });
  } else if (plistProjectId !== expectedProjectId) {
    errors.push({
      file: 'ios/Runner/GoogleService-Info.plist',
      issue: 'PROJECT_ID incorreto',
      expected: expectedProjectId,
      found: plistProjectId,
    });
  } else {
    checks.push({
      file: 'ios/Runner/GoogleService-Info.plist (PROJECT_ID)',
      status: 'OK',
      value: plistProjectId,
    });
  }

  // Check plist bundle ID (warning only - may differ from app bundle ID)
  if (plistBundleId && plistBundleId !== expectedBundleId) {
    warnings.push({
      file: 'ios/Runner/GoogleService-Info.plist',
      issue: 'BUNDLE_ID diferente do config.json (pode precisar reconfigurar no Firebase Console)',
      expected: expectedBundleId,
      found: plistBundleId,
    });
  } else if (plistBundleId) {
    checks.push({
      file: 'ios/Runner/GoogleService-Info.plist (BUNDLE_ID)',
      status: 'OK',
      value: plistBundleId,
    });
  }

  // 3. Validate google-services.json (Android)
  const googleServicesPath = path.join(TARGET_ROOT, 'android', 'app', 'google-services.json');
  const googleServicesInfo = extractGoogleServicesInfo(googleServicesPath);

  if (!googleServicesInfo) {
    errors.push({
      file: 'android/app/google-services.json',
      issue: 'Arquivo não encontrado ou JSON inválido',
      expected: expectedProjectId,
      found: null,
    });
  } else {
    if (googleServicesInfo.projectId !== expectedProjectId) {
      errors.push({
        file: 'android/app/google-services.json',
        issue: 'project_id incorreto',
        expected: expectedProjectId,
        found: googleServicesInfo.projectId,
      });
    } else {
      checks.push({
        file: 'android/app/google-services.json (project_id)',
        status: 'OK',
        value: googleServicesInfo.projectId,
      });
    }

    // Check if any client has matching package name
    const hasMatchingPackage = googleServicesInfo.packageNames.includes(expectedBundleId);
    if (!hasMatchingPackage) {
      warnings.push({
        file: 'android/app/google-services.json',
        issue: 'Nenhum client com package_name correspondente',
        expected: expectedBundleId,
        found: googleServicesInfo.packageNames.join(', '),
      });
    } else {
      checks.push({
        file: 'android/app/google-services.json (package_name)',
        status: 'OK',
        value: expectedBundleId,
      });
    }
  }

  // 4. Validate Xcode project bundle ID
  const pbxprojPath = path.join(TARGET_ROOT, 'ios', 'Runner.xcodeproj', 'project.pbxproj');
  const xcodeBundleId = extractXcodeBundleId(pbxprojPath);

  if (!xcodeBundleId) {
    errors.push({
      file: 'ios/Runner.xcodeproj/project.pbxproj',
      issue: 'PRODUCT_BUNDLE_IDENTIFIER não encontrado',
      expected: expectedBundleId,
      found: null,
    });
  } else if (xcodeBundleId !== expectedBundleId) {
    errors.push({
      file: 'ios/Runner.xcodeproj/project.pbxproj',
      issue: 'PRODUCT_BUNDLE_IDENTIFIER incorreto',
      expected: expectedBundleId,
      found: xcodeBundleId,
    });
  } else {
    checks.push({
      file: 'ios/Runner.xcodeproj (PRODUCT_BUNDLE_IDENTIFIER)',
      status: 'OK',
      value: xcodeBundleId,
    });
  }

  // 5. Validate Android build.gradle
  const buildGradlePath = path.join(TARGET_ROOT, 'android', 'app', 'build.gradle');
  const gradleIds = extractGradleIds(buildGradlePath);

  if (!gradleIds) {
    errors.push({
      file: 'android/app/build.gradle',
      issue: 'Arquivo não encontrado',
      expected: expectedBundleId,
      found: null,
    });
  } else {
    if (gradleIds.applicationId !== expectedBundleId) {
      errors.push({
        file: 'android/app/build.gradle',
        issue: 'applicationId incorreto',
        expected: expectedBundleId,
        found: gradleIds.applicationId,
      });
    } else {
      checks.push({
        file: 'android/app/build.gradle (applicationId)',
        status: 'OK',
        value: gradleIds.applicationId,
      });
    }

    if (gradleIds.namespace !== expectedBundleId) {
      errors.push({
        file: 'android/app/build.gradle',
        issue: 'namespace incorreto',
        expected: expectedBundleId,
        found: gradleIds.namespace,
      });
    } else {
      checks.push({
        file: 'android/app/build.gradle (namespace)',
        status: 'OK',
        value: gradleIds.namespace,
      });
    }
  }

  return { errors, warnings, checks };
}

/**
 * Display validation results
 * @param {object} results - Validation results
 * @returns {boolean} - True if no errors
 */
function displayValidationResults(results) {
  const { errors, warnings, checks } = results;

  // Display successful checks
  if (checks.length > 0) {
    console.log('\n  ✅ Verificações OK:');
    checks.forEach((check) => {
      console.log(`     ${check.file}: ${check.value}`);
    });
  }

  // Display warnings
  if (warnings.length > 0) {
    console.log('\n  ⚠️  Avisos:');
    warnings.forEach((warning) => {
      console.log(`     ${warning.file}`);
      console.log(`        ${warning.issue}`);
      console.log(`        Esperado: ${warning.expected}`);
      console.log(`        Encontrado: ${warning.found}`);
    });
  }

  // Display errors
  if (errors.length > 0) {
    console.log('\n  ❌ ERROS ENCONTRADOS:');
    errors.forEach((error) => {
      console.log(`     ${error.file}`);
      console.log(`        ${error.issue}`);
      console.log(`        Esperado: ${error.expected}`);
      console.log(`        Encontrado: ${error.found || '(não encontrado)'}`);
    });

    console.log('\n  💡 Para corrigir:');
    console.log('     1. Verifique se os arquivos do cliente estão corretos em clients/<client>/');
    console.log('     2. Re-execute: npm run start -- <client>');
    console.log(
      '     3. Ou regenere firebase_options.dart: cd white_label_app && flutterfire configure --project=<project-id>'
    );

    return false;
  }

  console.log('\n  ✅ Todas as configurações estão consistentes!');
  return true;
}

/**
 * Run full post-setup validation
 * @param {object} clientConfig - Client configuration
 * @returns {boolean} - True if validation passed
 */
function runPostSetupValidation(clientConfig) {
  const results = validatePostSetup(clientConfig);
  return displayValidationResults(results);
}

module.exports = {
  validatePostSetup,
  displayValidationResults,
  runPostSetupValidation,
  extractFirebaseOptionsProjectId,
  extractPlistValue,
  extractGoogleServicesInfo,
  extractXcodeBundleId,
  extractGradleIds,
};
