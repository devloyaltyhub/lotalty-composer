const fs = require('fs');

/**
 * Configuration file extractors
 * Utility functions for extracting values from Firebase and native config files
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
  const matches = content.match(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g);

  if (!matches) {
    return null;
  }

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

module.exports = {
  extractFirebaseOptionsProjectId,
  extractPlistValue,
  extractGoogleServicesInfo,
  extractXcodeBundleId,
  extractGradleIds,
};
