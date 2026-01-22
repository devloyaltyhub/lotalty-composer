const path = require('path');
const { WHITE_LABEL_APP_ROOT } = require('../../../shared/utils/paths');
const {
  extractFirebaseOptionsProjectId,
  extractPlistValue,
  extractGoogleServicesInfo,
  extractXcodeBundleId,
  extractGradleIds,
} = require('./config-extractors');
const { displayValidationResults } = require('./validation-display');

const TARGET_ROOT = WHITE_LABEL_APP_ROOT;

/**
 * Post-setup validation module
 * Validates that all Firebase and native configs are consistent with config.json
 */

function addError(errors, file, issue, expected, found) {
  errors.push({ file, issue, expected, found });
}

function addCheck(checks, file, value) {
  checks.push({ file, status: 'OK', value });
}

function addWarning(warnings, file, issue, expected, found) {
  warnings.push({ file, issue, expected, found });
}

function validateFirebaseOptions(results, expectedProjectId) {
  const { errors, checks } = results;
  const filePath = path.join(TARGET_ROOT, 'lib', 'firebase_options.dart');
  const projectId = extractFirebaseOptionsProjectId(filePath);

  if (!projectId) {
    addError(errors, 'lib/firebase_options.dart', 'Arquivo não encontrado ou projectId não extraído', expectedProjectId, null);
  } else if (projectId !== expectedProjectId) {
    addError(errors, 'lib/firebase_options.dart', 'Project ID incorreto', expectedProjectId, projectId);
  } else {
    addCheck(checks, 'lib/firebase_options.dart', projectId);
  }
}

function validateGoogleServiceInfoPlist(results, expectedProjectId, expectedBundleId) {
  const { errors, warnings, checks } = results;
  const filePath = path.join(TARGET_ROOT, 'ios', 'Runner', 'GoogleService-Info.plist');
  const projectId = extractPlistValue(filePath, 'PROJECT_ID');
  const bundleId = extractPlistValue(filePath, 'BUNDLE_ID');

  if (!projectId) {
    addError(errors, 'ios/Runner/GoogleService-Info.plist', 'Arquivo não encontrado ou PROJECT_ID não extraído', expectedProjectId, null);
  } else if (projectId !== expectedProjectId) {
    addError(errors, 'ios/Runner/GoogleService-Info.plist', 'PROJECT_ID incorreto', expectedProjectId, projectId);
  } else {
    addCheck(checks, 'ios/Runner/GoogleService-Info.plist (PROJECT_ID)', projectId);
  }

  if (bundleId && bundleId !== expectedBundleId) {
    addWarning(warnings, 'ios/Runner/GoogleService-Info.plist', 'BUNDLE_ID diferente do config.json (pode precisar reconfigurar no Firebase Console)', expectedBundleId, bundleId);
  } else if (bundleId) {
    addCheck(checks, 'ios/Runner/GoogleService-Info.plist (BUNDLE_ID)', bundleId);
  }
}

function validateGoogleServicesJson(results, expectedProjectId, expectedBundleId) {
  const { errors, warnings, checks } = results;
  const filePath = path.join(TARGET_ROOT, 'android', 'app', 'google-services.json');
  const info = extractGoogleServicesInfo(filePath);

  if (!info) {
    addError(errors, 'android/app/google-services.json', 'Arquivo não encontrado ou JSON inválido', expectedProjectId, null);
    return;
  }

  if (info.projectId !== expectedProjectId) {
    addError(errors, 'android/app/google-services.json', 'project_id incorreto', expectedProjectId, info.projectId);
  } else {
    addCheck(checks, 'android/app/google-services.json (project_id)', info.projectId);
  }

  const hasMatchingPackage = info.packageNames.includes(expectedBundleId);
  if (!hasMatchingPackage) {
    addWarning(warnings, 'android/app/google-services.json', 'Nenhum client com package_name correspondente', expectedBundleId, info.packageNames.join(', '));
  } else {
    addCheck(checks, 'android/app/google-services.json (package_name)', expectedBundleId);
  }
}

function validateXcodeProject(results, expectedBundleId) {
  const { errors, checks } = results;
  const filePath = path.join(TARGET_ROOT, 'ios', 'Runner.xcodeproj', 'project.pbxproj');
  const bundleId = extractXcodeBundleId(filePath);

  if (!bundleId) {
    addError(errors, 'ios/Runner.xcodeproj/project.pbxproj', 'PRODUCT_BUNDLE_IDENTIFIER não encontrado', expectedBundleId, null);
  } else if (bundleId !== expectedBundleId) {
    addError(errors, 'ios/Runner.xcodeproj/project.pbxproj', 'PRODUCT_BUNDLE_IDENTIFIER incorreto', expectedBundleId, bundleId);
  } else {
    addCheck(checks, 'ios/Runner.xcodeproj (PRODUCT_BUNDLE_IDENTIFIER)', bundleId);
  }
}

function validateBuildGradle(results, expectedBundleId) {
  const { errors, checks } = results;
  const filePath = path.join(TARGET_ROOT, 'android', 'app', 'build.gradle');
  const ids = extractGradleIds(filePath);

  if (!ids) {
    addError(errors, 'android/app/build.gradle', 'Arquivo não encontrado', expectedBundleId, null);
    return;
  }

  if (ids.applicationId !== expectedBundleId) {
    addError(errors, 'android/app/build.gradle', 'applicationId incorreto', expectedBundleId, ids.applicationId);
  } else {
    addCheck(checks, 'android/app/build.gradle (applicationId)', ids.applicationId);
  }

  if (ids.namespace !== expectedBundleId) {
    addError(errors, 'android/app/build.gradle', 'namespace incorreto', expectedBundleId, ids.namespace);
  } else {
    addCheck(checks, 'android/app/build.gradle (namespace)', ids.namespace);
  }
}

/**
 * Run post-setup validation
 * @param {object} clientConfig - Client configuration from config.json
 * @returns {object} - Validation results with errors and warnings
 */
function validatePostSetup(clientConfig) {
  const results = { errors: [], warnings: [], checks: [] };
  const expectedProjectId = clientConfig.firebaseProjectId;
  const expectedBundleId = clientConfig.bundleId;

  console.log('\n🔍 Validando configurações pós-setup...');
  console.log(`   Expected Firebase Project: ${expectedProjectId}`);
  console.log(`   Expected Bundle ID: ${expectedBundleId}`);

  validateFirebaseOptions(results, expectedProjectId);
  validateGoogleServiceInfoPlist(results, expectedProjectId, expectedBundleId);
  validateGoogleServicesJson(results, expectedProjectId, expectedBundleId);
  validateXcodeProject(results, expectedBundleId);
  validateBuildGradle(results, expectedBundleId);

  return results;
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
