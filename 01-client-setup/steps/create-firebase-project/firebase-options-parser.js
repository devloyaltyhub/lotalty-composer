const fs = require('fs');

function parseFirebaseOptions(optionsPath) {
  const content = fs.readFileSync(optionsPath, 'utf8');

  const extractPlatformSection = (platform) => {
    const regex = new RegExp(
      `static\\s+const\\s+FirebaseOptions\\s+${platform}\\s*=\\s*FirebaseOptions\\s*\\([^)]+\\)`,
      's'
    );
    const match = content.match(regex);
    return match ? match[0] : null;
  };

  const extractValueFromSection = (section, key) => {
    if (!section) return null;
    const regex = new RegExp(`${key}:\\s*'([^']+)'`);
    const match = section.match(regex);
    return match ? match[1] : null;
  };

  const extractValue = (key) => {
    const regex = new RegExp(`${key}:\\s*'([^']+)'`);
    const match = content.match(regex);
    return match ? match[1] : null;
  };

  const androidSection = extractPlatformSection('android');
  const iosSection = extractPlatformSection('ios');
  const webSection = extractPlatformSection('web');

  const androidAppId = extractValueFromSection(androidSection, 'appId');
  const androidApiKey = extractValueFromSection(androidSection, 'apiKey');
  const iosAppId = extractValueFromSection(iosSection, 'appId');
  const iosApiKey = extractValueFromSection(iosSection, 'apiKey');
  const webAppId = extractValueFromSection(webSection, 'appId');
  const webApiKey = extractValueFromSection(webSection, 'apiKey');

  const projectId = extractValue('projectId');
  const messagingSenderId = extractValue('messagingSenderId');
  const storageBucket = extractValue('storageBucket');
  const authDomain = extractValue('authDomain');
  const measurementId = extractValue('measurementId');
  const genericApiKey = extractValue('apiKey');
  const genericAppId = extractValue('appId');

  return {
    projectId,
    apiKey: genericApiKey,
    appId: genericAppId,
    messagingSenderId,
    storageBucket,
    authDomain,
    measurementId,
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
};
