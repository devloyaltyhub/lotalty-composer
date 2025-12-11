const fs = require('fs');
const path = require('path');
const logger = require('../../shared/utils/logger');

/**
 * iOS device configurations for App Store screenshots
 *
 * IMPORTANT: Fastlane auto-detects device type by IMAGE RESOLUTION, not by folder structure.
 * Screenshots must be placed DIRECTLY in locale folder (e.g., metadata/ios/pt-BR/*.png)
 * NOT in device subfolders (e.g., metadata/ios/pt-BR/APP_IPHONE_67/*.png - WRONG!)
 *
 * Reference: https://docs.fastlane.tools/actions/deliver/
 *
 * Since September 2024, Apple only requires ONE iPhone size (6.7" or 6.9") and ONE iPad size (12.9" or 13").
 * Apple automatically scales screenshots for smaller devices.
 *
 * Required resolutions:
 * - iPhone 6.7": 1290x2796 (iPhone 14/15/16 Pro Max)
 * - iPad 12.9": 2048x2732 (iPad Pro 12.9")
 */
const IOS_DEVICES = {
  // Only need iPhone 6.7" - Apple scales for smaller devices
  APP_IPHONE_67: {
    name: 'iPhone 6.7"',
    resolution: { width: 1290, height: 2796 },
    simulators: ['iPhone 15 Pro Max', 'iPhone 14 Pro Max', 'iPhone 13 Pro Max'],
    filenameSuffix: '_iphone',
  },
  // iPad 12.9" - Apple scales for smaller iPads
  // IMPORTANT: Fastlane requires 'ipadPro129' in filename to detect iPad Pro 3rd gen+
  APP_IPAD_PRO_129: {
    name: 'iPad 12.9"',
    resolution: { width: 2048, height: 2732 },
    simulators: ['iPad Pro (12.9-inch) (6th generation)', 'iPad Pro (12.9-inch)'],
    filenameSuffix: '_ipadPro129',
  },
};

/**
 * Android device configurations for Play Store screenshots
 */
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

/**
 * Mapping from device type to source mockup folders
 * The Python mockup generator creates folders like 'iphone_6_7', 'ipad_12_9', etc.
 */
const SOURCE_FOLDER_MAPPING = {
  // iOS mappings (device type -> mockup source folder)
  APP_IPHONE_67: 'iphone_6_7', // iPhone 6.7" mockups (1290x2796)
  APP_IPAD_PRO_129: 'ipad_12_9', // iPad 12.9" mockups (2048x2732)
  // Android mappings
  phoneScreenshots: 'gplay_phone', // Google Play phone mockups
  tenInchScreenshots: 'gplay_tablet', // Google Play tablet mockups
  // Feature Graphic (1024x500)
  featureGraphic: 'feature_graphic', // Google Play Feature Graphic
};

/**
 * Screenshot copier for multi-device store metadata
 *
 * Copies mockup images to white_label_app/metadata/ for Fastlane submission.
 * Source mockups: white_label_app/screenshots/mockups/
 * Destination: white_label_app/metadata/
 *
 * Note: Text metadata (description, title, etc) is already in white_label_app/metadata/
 * from the white-label setup step. This class only handles screenshot/mockup images.
 */
class ScreenshotMetadataCopier {
  /**
   * @param {string} clientCode - Client identifier
   * @param {string} repoPath - Repository root path
   */
  constructor(clientCode, repoPath = process.cwd()) {
    this.clientCode = clientCode;
    this.repoPath = repoPath;
    this.screenshotsDir = path.join(repoPath, 'white_label_app', 'screenshots');
    this.mockupsDir = path.join(this.screenshotsDir, 'mockups');
    // Source and destination for metadata is the same: white_label_app/metadata
    // Text metadata is already copied there by white-label setup
    this.outputMetadataDir = path.join(repoPath, 'white_label_app', 'metadata');
  }

  /**
   * Ensure directory exists
   * @param {string} dir - Directory path
   */
  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Get list of screenshot files from source directory
   * @param {string} sourceDir - Source directory
   * @returns {string[]} Array of PNG file names
   */
  getScreenshotFiles(sourceDir) {
    if (!fs.existsSync(sourceDir)) {
      return [];
    }

    return fs
      .readdirSync(sourceDir)
      .filter((file) => file.endsWith('.png'))
      .sort();
  }

  /**
   * Copy screenshots to Android metadata directory for a specific device type
   * @param {string} deviceKey - Device key from ANDROID_DEVICES
   * @returns {Object} Result with count and destination
   */
  copyToAndroidDevice(deviceKey) {
    const device = ANDROID_DEVICES[deviceKey];
    if (!device) {
      logger.warn(`Dispositivo Android desconhecido: ${deviceKey}`);
      return { count: 0, destination: null };
    }

    // Use mapped source folder (e.g., phoneScreenshots -> gplay_phone)
    const sourceSubdir = SOURCE_FOLDER_MAPPING[device.folder] || '';
    const sourceDir = sourceSubdir ? path.join(this.mockupsDir, sourceSubdir) : this.mockupsDir;
    const destDir = path.join(this.outputMetadataDir, 'android', 'pt-BR', 'images', device.folder);

    this.ensureDir(destDir);

    const files = this.getScreenshotFiles(sourceDir);
    if (files.length === 0) {
      return { count: 0, destination: destDir };
    }

    // Clear existing screenshots
    const existingFiles = fs.readdirSync(destDir).filter((f) => f.endsWith('.png'));
    existingFiles.forEach((file) => fs.unlinkSync(path.join(destDir, file)));

    // Copy screenshots (keep original names, which already have numbers)
    files.forEach((file) => {
      const src = path.join(sourceDir, file);
      const dest = path.join(destDir, file);
      fs.copyFileSync(src, dest);
    });

    return { count: files.length, destination: destDir };
  }

  /**
   * Copy Feature Graphic to Android metadata directory
   * Feature Graphic is a 1024x500 banner image displayed at the top of Play Store listing
   *
   * @returns {Object} Result with copied flag and destination
   */
  copyFeatureGraphic() {
    const sourceSubdir = SOURCE_FOLDER_MAPPING.featureGraphic;
    const sourceDir = path.join(this.mockupsDir, sourceSubdir);
    const destDir = path.join(this.outputMetadataDir, 'android', 'pt-BR', 'images');

    this.ensureDir(destDir);

    const sourceFile = path.join(sourceDir, 'featureGraphic.png');
    const destFile = path.join(destDir, 'featureGraphic.png');

    if (!fs.existsSync(sourceFile)) {
      return { copied: false, destination: null };
    }

    // Remove existing feature graphic if present
    if (fs.existsSync(destFile)) {
      fs.unlinkSync(destFile);
    }

    fs.copyFileSync(sourceFile, destFile);
    return { copied: true, destination: destFile };
  }

  /**
   * Copy screenshots to all Android device types
   * @returns {Object} Results per device
   */
  copyToAndroid() {
    logger.startSpinner('Copiando screenshots para Android...');

    const results = {};
    let totalCount = 0;

    for (const deviceKey of Object.keys(ANDROID_DEVICES)) {
      results[deviceKey] = this.copyToAndroidDevice(deviceKey);
      totalCount += results[deviceKey].count;
    }

    // Copy Feature Graphic
    results.featureGraphic = this.copyFeatureGraphic();

    if (totalCount === 0) {
      logger.failSpinner('Nenhum screenshot encontrado para Android');
    } else {
      const parts = [];
      if (results.phone?.count > 0) parts.push(`${results.phone.count} phone`);
      if (results.tablet?.count > 0) parts.push(`${results.tablet.count} tablet`);
      if (results.featureGraphic?.copied) parts.push('1 feature graphic');
      logger.succeedSpinner(`Android: ${parts.join(' + ')} copiados`);
    }

    return results;
  }

  /**
   * Copy screenshots from source to iOS screenshots directory
   * Screenshots go DIRECTLY in locale folder (NOT in device subfolders)
   *
   * IMPORTANT: iPad Pro 12.9" (3rd gen+) requires 'ipadPro129' in filename
   * for Fastlane to correctly detect the device type during upload.
   *
   * @param {string} deviceKey - Device key from IOS_DEVICES
   * @param {string} sourceSubdir - Subdirectory in mockups folder
   * @param {string} destDir - Destination directory (locale folder)
   * @returns {Object} Result with count and files copied
   */
  copyIosScreenshots(deviceKey, sourceSubdir, destDir) {
    const device = IOS_DEVICES[deviceKey];
    if (!device) {
      logger.warn(`Dispositivo iOS desconhecido: ${deviceKey}`);
      return { count: 0, files: [] };
    }

    const sourceDir = path.join(this.mockupsDir, sourceSubdir);
    const files = this.getScreenshotFiles(sourceDir);

    if (files.length === 0) {
      return { count: 0, files: [] };
    }

    const copiedFiles = [];
    files.forEach((file) => {
      const src = path.join(sourceDir, file);

      // Apply device-specific suffix for Fastlane device detection
      // e.g., 01_home_mockup.png -> 01_home_mockup_iphone.png or 01_home_mockup_ipadPro129.png
      let destFilename = file;
      if (device.filenameSuffix) {
        const ext = path.extname(file);
        const basename = path.basename(file, ext);
        destFilename = `${basename}${device.filenameSuffix}${ext}`;
      }

      const dest = path.join(destDir, destFilename);
      fs.copyFileSync(src, dest);
      copiedFiles.push(destFilename);
    });

    return { count: files.length, files: copiedFiles };
  }

  /**
   * Copy screenshots to iOS metadata directory
   *
   * IMPORTANT: Fastlane expects screenshots DIRECTLY in locale folder, NOT in device subfolders!
   * Correct:   metadata/ios/pt-BR/*.png
   * WRONG:     metadata/ios/pt-BR/APP_IPHONE_67/*.png
   *
   * Device detection:
   * - iPhone: Auto-detected by resolution (1290x2796), suffix '_iphone' added for clarity
   * - iPad Pro 12.9": REQUIRES 'ipadPro129' in filename for Fastlane to detect correctly
   *
   * @returns {Object} Results per device
   */
  copyToIos() {
    logger.startSpinner('Copiando screenshots para iOS...');

    // Screenshots go directly in locale folder (Fastlane requirement)
    const destDir = path.join(this.outputMetadataDir, 'ios', 'pt-BR');
    this.ensureDir(destDir);

    // Clear existing screenshots in locale folder
    const existingFiles = fs.readdirSync(destDir).filter((f) => f.endsWith('.png'));
    existingFiles.forEach((file) => fs.unlinkSync(path.join(destDir, file)));

    // Also clean up old device subfolders if they exist (migration from old structure)
    const oldDeviceFolders = ['APP_IPHONE_55', 'APP_IPHONE_65', 'APP_IPHONE_67', 'APP_IPAD_PRO_129'];
    for (const folder of oldDeviceFolders) {
      const oldPath = path.join(destDir, folder);
      if (fs.existsSync(oldPath)) {
        this.removeDir(oldPath);
        logger.info(`  Removida pasta antiga: ${folder}`);
      }
    }

    const results = {};
    let totalCount = 0;

    // Copy screenshots from each device type to the same locale folder
    for (const deviceKey of Object.keys(IOS_DEVICES)) {
      const sourceSubdir = SOURCE_FOLDER_MAPPING[deviceKey];
      if (sourceSubdir) {
        results[deviceKey] = this.copyIosScreenshots(deviceKey, sourceSubdir, destDir);
        totalCount += results[deviceKey].count;
      } else {
        results[deviceKey] = { count: 0, files: [] };
      }
    }

    if (totalCount === 0) {
      logger.failSpinner('Nenhum screenshot encontrado para iOS');
    } else {
      const iPhoneCount = results.APP_IPHONE_67?.count || 0;
      const iPadCount = results.APP_IPAD_PRO_129?.count || 0;
      logger.succeedSpinner(`iOS: ${iPhoneCount} iPhone + ${iPadCount} iPad screenshots copiados para pt-BR/`);
    }

    return results;
  }

  /**
   * Copy mockup screenshots to all platforms
   *
   * Structure created:
   * - Android: metadata/android/pt-BR/images/phoneScreenshots/*.png
   *            metadata/android/pt-BR/images/tenInchScreenshots/*.png
   * - iOS:     metadata/ios/pt-BR/*.png (ALL screenshots in locale folder, Fastlane detects device by resolution)
   *
   * Note: Text metadata (description, title, etc) is already in white_label_app/metadata
   * from the white-label setup step. This class only handles screenshot/mockup images.
   *
   * @returns {Object} Complete results
   */
  copyAll() {
    logger.section('Copiando Screenshots para white_label_app/metadata');

    // Copy mockups (screenshots) to metadata folders
    if (!fs.existsSync(this.mockupsDir)) {
      logger.error(`Diretorio de mockups nao encontrado: ${this.mockupsDir}`);
      logger.info('Execute "npm run screenshots" primeiro para gerar os screenshots');
      return { android: { count: 0 }, ios: {} };
    }

    const results = {
      android: this.copyToAndroid(),
      ios: this.copyToIos(),
    };

    // Summary
    logger.blank();
    logger.info('Screenshots copiados:');

    // Android summary
    for (const [deviceKey, device] of Object.entries(ANDROID_DEVICES)) {
      const count = results.android[deviceKey]?.count || 0;
      logger.keyValue(`  Android ${device.name}`, `${count} arquivos`);
    }
    if (results.android.featureGraphic?.copied) {
      logger.keyValue(`  Android Feature Graphic`, `1 arquivo (1024x500)`);
    }

    // iOS summary (screenshots are in locale folder, not device subfolders)
    const iosTotal = Object.values(results.ios).reduce((sum, r) => sum + (r?.count || 0), 0);
    logger.keyValue(`  iOS (pt-BR/)`, `${iosTotal} arquivos`);
    for (const [deviceKey, device] of Object.entries(IOS_DEVICES)) {
      const count = results.ios[deviceKey]?.count || 0;
      if (count > 0) {
        logger.keyValue(`    - ${device.name}`, `${count} arquivos`);
      }
    }

    logger.blank();
    logger.info(`Destino: ${this.outputMetadataDir}`);
    logger.info(`iOS: Screenshots em metadata/ios/pt-BR/ (Fastlane detecta device por resolucao)`);

    // Clean up temporary screenshots directory after successful copy
    this.cleanupScreenshotsDir();

    return results;
  }

  /**
   * Recursively remove a directory and its contents
   * @param {string} dir - Directory path to remove
   */
  removeDir(dir) {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.removeDir(fullPath);
      } else {
        fs.unlinkSync(fullPath);
      }
    }
    fs.rmdirSync(dir);
  }

  /**
   * Clean up the temporary screenshots directory after copying to metadata
   * This removes white_label_app/screenshots/ folder entirely
   */
  cleanupScreenshotsDir() {
    if (!fs.existsSync(this.screenshotsDir)) {
      return;
    }

    logger.startSpinner('Limpando pasta temporaria de screenshots...');
    try {
      this.removeDir(this.screenshotsDir);
      logger.succeedSpinner('Pasta white_label_app/screenshots/ removida');
    } catch (error) {
      logger.failSpinner(`Erro ao limpar pasta screenshots: ${error.message}`);
    }
  }

  /**
   * Get all device configurations
   * @returns {Object} Device configurations
   */
  static getDeviceConfigs() {
    return {
      ios: IOS_DEVICES,
      android: ANDROID_DEVICES,
    };
  }
}

module.exports = {
  ScreenshotMetadataCopier,
  IOS_DEVICES,
  ANDROID_DEVICES,
};
