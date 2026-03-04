const fs = require('fs');

/**
 * Parse firebase_options.dart to extract configuration with correct platform-specific logic.
 * This parser correctly handles iOS, Android, and Web platform sections.
 */

/**
 * Extract a platform-specific configuration section from firebase_options.dart content
 * @param {string} content - File content
 * @param {string} platform - Platform name (android, ios, web)
 * @returns {string|null} The matched section or null
 */
function extractPlatformSection(content, platform) {
  const regex = new RegExp(
    `static\\s+const\\s+FirebaseOptions\\s+${platform}\\s*=\\s*FirebaseOptions\\s*\\([^)]+\\)`,
    's'
  );
  const match = content.match(regex);
  return match ? match[0] : null;
}

/**
 * Extract a value from a specific section
 * @param {string|null} section - Section content
 * @param {string} key - Key to extract
 * @returns {string|null} The extracted value or null
 */
function extractValueFromSection(section, key) {
  if (!section) return null;
  const regex = new RegExp(`${key}:\\s*'([^']+)'`);
  const match = section.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract generic value (first occurrence in content)
 * @param {string} content - File content
 * @param {string} key - Key to extract
 * @returns {string|null} The extracted value or null
 */
function extractValue(content, key) {
  const regex = new RegExp(`${key}:\\s*'([^']+)'`);
  const match = content.match(regex);
  return match ? match[1] : null;
}

/**
 * Parse firebase_options.dart to extract all Firebase configuration
 * @param {string} optionsPath - Path to firebase_options.dart file
 * @returns {Object} Parsed Firebase options with platform-specific values
 */
function parseFirebaseOptions(optionsPath) {
  const content = fs.readFileSync(optionsPath, 'utf8');

  const androidSection = extractPlatformSection(content, 'android');
  const iosSection = extractPlatformSection(content, 'ios');
  const webSection = extractPlatformSection(content, 'web');

  const androidAppId = extractValueFromSection(androidSection, 'appId');
  const androidApiKey = extractValueFromSection(androidSection, 'apiKey');
  const iosAppId = extractValueFromSection(iosSection, 'appId');
  const iosApiKey = extractValueFromSection(iosSection, 'apiKey');
  const webAppId = extractValueFromSection(webSection, 'appId');
  const webApiKey = extractValueFromSection(webSection, 'apiKey');

  const projectId = extractValue(content, 'projectId');
  const messagingSenderId = extractValue(content, 'messagingSenderId');
  const storageBucket = extractValue(content, 'storageBucket');
  const authDomain = extractValue(content, 'authDomain');
  const measurementId = extractValue(content, 'measurementId');
  const databaseURL = extractValue(content, 'databaseURL');
  const genericApiKey = extractValue(content, 'apiKey');
  const genericAppId = extractValue(content, 'appId');

  return {
    projectId,
    apiKey: genericApiKey,
    appId: genericAppId,
    messagingSenderId,
    storageBucket,
    authDomain,
    measurementId,
    databaseURL,
    iosApiKey: iosApiKey || genericApiKey,
    iosAppId: iosAppId || genericAppId,
    androidApiKey: androidApiKey || genericApiKey,
    androidAppId: androidAppId || genericAppId,
    webApiKey: webApiKey || genericApiKey,
    webAppId: webAppId || genericAppId,
  };
}

/**
 * Parse firebase_options.dart content string directly
 * @param {string} content - File content as string
 * @returns {Object} Parsed Firebase options with platform-specific values
 */
function parseFirebaseOptionsContent(content) {
  const androidSection = extractPlatformSection(content, 'android');
  const iosSection = extractPlatformSection(content, 'ios');
  const webSection = extractPlatformSection(content, 'web');

  const androidAppId = extractValueFromSection(androidSection, 'appId');
  const androidApiKey = extractValueFromSection(androidSection, 'apiKey');
  const iosAppId = extractValueFromSection(iosSection, 'appId');
  const iosApiKey = extractValueFromSection(iosSection, 'apiKey');
  const webAppId = extractValueFromSection(webSection, 'appId');
  const webApiKey = extractValueFromSection(webSection, 'apiKey');

  const projectId = extractValue(content, 'projectId');
  const messagingSenderId = extractValue(content, 'messagingSenderId');
  const storageBucket = extractValue(content, 'storageBucket');
  const authDomain = extractValue(content, 'authDomain');
  const measurementId = extractValue(content, 'measurementId');
  const databaseURL = extractValue(content, 'databaseURL');
  const genericApiKey = extractValue(content, 'apiKey');
  const genericAppId = extractValue(content, 'appId');

  return {
    projectId,
    apiKey: genericApiKey,
    appId: genericAppId,
    messagingSenderId,
    storageBucket,
    authDomain,
    measurementId,
    databaseURL,
    iosApiKey: iosApiKey || genericApiKey,
    iosAppId: iosAppId || genericAppId,
    androidApiKey: androidApiKey || genericApiKey,
    androidAppId: androidAppId || genericAppId,
    webApiKey: webApiKey || genericApiKey,
    webAppId: webAppId || genericAppId,
  };
}

module.exports = {
  parseFirebaseOptions,
  parseFirebaseOptionsContent,
  extractPlatformSection,
  extractValueFromSection,
  extractValue,
};
