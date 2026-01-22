const path = require('path');

const PROJECT_CONFIGS = {
  app: {
    name: 'Loyalty App (Mobile)',
    screenshotsDir: (repoPath) => path.join(repoPath, 'loyalty-app', 'white_label_app', 'screenshots'),
    mockupsDir: (repoPath) =>
      path.join(repoPath, 'loyalty-app', 'white_label_app', 'screenshots', 'mockups'),
    metadataDir: (repoPath) => path.join(repoPath, 'loyalty-app', 'white_label_app', 'metadata'),
    generateIos: true,
    generateAndroid: true,
    cleanupAfterCopy: true,
  },

  admin: {
    name: 'Loyalty Admin (Merchant Panel)',
    screenshotsDir: (repoPath) => path.join(repoPath, 'loyalty-admin-main', 'screenshots'),
    mockupsDir: (repoPath) => path.join(repoPath, 'loyalty-admin-main', 'screenshots', 'mockups'),
    metadataDir: (repoPath) => path.join(repoPath, 'loyalty-admin-main', 'metadata'),
    generateIos: false,
    generateAndroid: true,
    cleanupAfterCopy: false,
  },
};

const IOS_DEVICES = {
  APP_IPHONE_67: {
    name: 'iPhone 6.7"',
    resolution: { width: 1290, height: 2796 },
    simulators: ['iPhone 15 Pro Max', 'iPhone 14 Pro Max', 'iPhone 13 Pro Max'],
    filenameSuffix: '_iphone',
  },
  APP_IPAD_PRO_129: {
    name: 'iPad 12.9"',
    resolution: { width: 2048, height: 2732 },
    simulators: ['iPad Pro (12.9-inch) (6th generation)', 'iPad Pro (12.9-inch)'],
    filenameSuffix: '_ipadPro129',
  },
};

const ANDROID_DEVICES = {
  phone: {
    name: 'Phone',
    folder: 'phoneScreenshots',
    emulators: ['Pixel_8_Pro_API_34', 'Pixel_7_Pro_API_33'],
  },
  tablet: {
    name: 'Tablet 10"',
    folder: 'tenInchScreenshots',
    emulators: ['Pixel_Tablet_API_34'],
  },
};

const SOURCE_FOLDER_MAPPING = {
  APP_IPHONE_67: 'iphone_6_7',
  APP_IPAD_PRO_129: 'ipad_12_9',
  phoneScreenshots: 'gplay_phone',
  tenInchScreenshots: 'gplay_tablet',
  featureGraphic: 'feature_graphic',
};

function getProjectConfig(projectKey) {
  const config = PROJECT_CONFIGS[projectKey];
  if (!config) {
    const available = Object.keys(PROJECT_CONFIGS).join(', ');
    throw new Error(`Unknown project: '${projectKey}'. Available: ${available}`);
  }
  return config;
}

module.exports = {
  PROJECT_CONFIGS,
  IOS_DEVICES,
  ANDROID_DEVICES,
  SOURCE_FOLDER_MAPPING,
  getProjectConfig,
};
