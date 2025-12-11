/**
 * Tests for 02-build-deploy/utils/screenshot-metadata-copier.js
 */

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  copyFileSync: jest.fn(),
  rmdirSync: jest.fn(),
}));

jest.mock('../../shared/utils/logger', () => ({
  section: jest.fn(),
  startSpinner: jest.fn(),
  succeedSpinner: jest.fn(),
  failSpinner: jest.fn(),
  blank: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  keyValue: jest.fn(),
}));

const fs = require('fs');
const {
  ScreenshotMetadataCopier,
  IOS_DEVICES,
  ANDROID_DEVICES,
} = require('../../02-build-deploy/utils/screenshot-metadata-copier');

describe('ScreenshotMetadataCopier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constants', () => {
    test('IOS_DEVICES has only required device configurations (simplified since Sept 2024)', () => {
      // iPhone 6.7" (mandatory - Apple scales for smaller devices)
      expect(IOS_DEVICES.APP_IPHONE_67).toBeDefined();
      expect(IOS_DEVICES.APP_IPHONE_67.resolution).toEqual({ width: 1290, height: 2796 });
      expect(IOS_DEVICES.APP_IPHONE_67.simulators).toBeDefined();

      // iPad Pro 12.9" (mandatory for iPad support - Apple scales for smaller iPads)
      expect(IOS_DEVICES.APP_IPAD_PRO_129).toBeDefined();
      expect(IOS_DEVICES.APP_IPAD_PRO_129.resolution).toEqual({ width: 2048, height: 2732 });

      // Old device sizes should NOT exist (Apple auto-scales now)
      expect(IOS_DEVICES.APP_IPHONE_65).toBeUndefined();
      expect(IOS_DEVICES.APP_IPHONE_55).toBeUndefined();
    });

    test('ANDROID_DEVICES has required device configurations', () => {
      expect(ANDROID_DEVICES.phone).toBeDefined();
      expect(ANDROID_DEVICES.phone.name).toBe('Phone');
      expect(ANDROID_DEVICES.phone.folder).toBe('phoneScreenshots');
      expect(ANDROID_DEVICES.phone.emulators).toBeDefined();

      expect(ANDROID_DEVICES.tablet).toBeDefined();
      expect(ANDROID_DEVICES.tablet.name).toBe('Tablet 10"');
      expect(ANDROID_DEVICES.tablet.folder).toBe('tenInchScreenshots');
    });
  });

  describe('constructor', () => {
    test('initializes with client code', () => {
      const copier = new ScreenshotMetadataCopier('demo');

      expect(copier.clientCode).toBe('demo');
    });

    test('sets correct paths', () => {
      const copier = new ScreenshotMetadataCopier('demo', '/repo');

      expect(copier.repoPath).toBe('/repo');
      expect(copier.screenshotsDir).toContain('screenshots');
      expect(copier.outputMetadataDir).toContain('metadata');
    });
  });

  describe('ensureDir()', () => {
    test('creates directory when it does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      const copier = new ScreenshotMetadataCopier('demo');

      copier.ensureDir('/some/path');

      expect(fs.mkdirSync).toHaveBeenCalledWith('/some/path', { recursive: true });
    });

    test('does not create directory when it exists', () => {
      fs.existsSync.mockReturnValue(true);
      const copier = new ScreenshotMetadataCopier('demo');

      copier.ensureDir('/some/path');

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('getScreenshotFiles()', () => {
    test('returns empty array when directory does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      const copier = new ScreenshotMetadataCopier('demo');

      const files = copier.getScreenshotFiles('/nonexistent');

      expect(files).toEqual([]);
    });

    test('returns only PNG files sorted', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['z.png', 'a.png', 'file.txt', 'b.png']);

      const copier = new ScreenshotMetadataCopier('demo');
      const files = copier.getScreenshotFiles('/dir');

      expect(files).toEqual(['a.png', 'b.png', 'z.png']);
    });
  });

  describe('copyToAndroidDevice()', () => {
    test('copies screenshots to phone metadata directory', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.includes('mockups')) return ['screen1.png', 'screen2.png'];
        return [];
      });

      const copier = new ScreenshotMetadataCopier('demo', '/repo');
      const result = copier.copyToAndroidDevice('phone');

      expect(result.count).toBe(2);
      expect(result.destination).toContain('phoneScreenshots');
    });

    test('copies screenshots to tablet metadata directory', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.includes('mockups')) return ['screen1.png'];
        return [];
      });

      const copier = new ScreenshotMetadataCopier('demo', '/repo');
      const result = copier.copyToAndroidDevice('tablet');

      expect(result.count).toBe(1);
      expect(result.destination).toContain('tenInchScreenshots');
    });

    test('returns 0 for unknown device', () => {
      const copier = new ScreenshotMetadataCopier('demo');
      const result = copier.copyToAndroidDevice('unknown_device');

      expect(result.count).toBe(0);
      expect(result.destination).toBeNull();
    });
  });

  describe('copyToAndroid()', () => {
    test('copies screenshots to all Android device types', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.includes('mockups')) return ['screen1.png', 'screen2.png'];
        return [];
      });

      const copier = new ScreenshotMetadataCopier('demo', '/repo');
      const results = copier.copyToAndroid();

      expect(results.phone).toBeDefined();
      expect(results.tablet).toBeDefined();
      expect(results.phone.count).toBe(2);
      expect(results.tablet.count).toBe(2);
    });

    test('returns 0 count when no screenshots', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([]);

      const copier = new ScreenshotMetadataCopier('demo');
      const results = copier.copyToAndroid();

      expect(results.phone.count).toBe(0);
      expect(results.tablet.count).toBe(0);
    });

    test('clears existing screenshots before copying', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.includes('mockups')) return ['new.png'];
        return ['old.png'];
      });

      const copier = new ScreenshotMetadataCopier('demo', '/repo');
      copier.copyToAndroid();

      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('copyIosScreenshots()', () => {
    test('copies screenshots to locale folder with device-specific suffix', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.includes('mockups')) return ['screen.png'];
        return [];
      });

      const copier = new ScreenshotMetadataCopier('demo', '/repo');
      const result = copier.copyIosScreenshots('APP_IPHONE_67', 'iphone_6_7', '/dest/pt-BR');

      expect(result.count).toBe(1);
      // iPhone screenshots get _iphone suffix for Fastlane device detection
      expect(result.files).toContain('screen_iphone.png');
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    test('adds _ipadPro129 suffix for iPad screenshots (Fastlane requirement)', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir) => {
        if (dir.includes('mockups')) return ['screen.png'];
        return [];
      });

      const copier = new ScreenshotMetadataCopier('demo', '/repo');
      const result = copier.copyIosScreenshots('APP_IPAD_PRO_129', 'ipad_12_9', '/dest/pt-BR');

      expect(result.count).toBe(1);
      // iPad screenshots MUST have ipadPro129 in filename for Fastlane to detect correctly
      expect(result.files).toContain('screen_ipadPro129.png');
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    test('returns 0 for unknown device', () => {
      const copier = new ScreenshotMetadataCopier('demo');
      const result = copier.copyIosScreenshots('unknown_device', null, '/dest');

      expect(result.count).toBe(0);
      expect(result.files).toEqual([]);
    });
  });

  describe('copyToIos()', () => {
    test('copies screenshots directly to locale folder (Fastlane requirement)', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir, opts) => {
        // When checking for withFileTypes (removeDir)
        if (opts && opts.withFileTypes) return [];
        // When getting mockups
        if (dir.includes('mockups')) return ['screen.png'];
        // When getting existing files in dest
        return [];
      });

      const copier = new ScreenshotMetadataCopier('demo', '/repo');
      const results = copier.copyToIos();

      // Only iPhone 6.7" and iPad 12.9" results (Apple scales for others)
      expect(results.APP_IPHONE_67).toBeDefined();
      expect(results.APP_IPAD_PRO_129).toBeDefined();

      // Old device sizes should NOT have results
      expect(results.APP_IPHONE_65).toBeUndefined();
      expect(results.APP_IPHONE_55).toBeUndefined();
    });

    test('cleans up old device subfolders during migration', () => {
      fs.existsSync.mockImplementation((path) => {
        // Old device subfolders exist
        if (path.includes('APP_IPHONE_55') || path.includes('APP_IPHONE_65')) return true;
        return true;
      });
      fs.readdirSync.mockImplementation((dir, opts) => {
        if (opts && opts.withFileTypes) return [];
        if (dir.includes('mockups')) return ['screen.png'];
        return [];
      });

      const copier = new ScreenshotMetadataCopier('demo', '/repo');
      copier.copyToIos();

      // Should have attempted to clean up old folders
      expect(fs.rmdirSync).toHaveBeenCalled();
    });
  });

  describe('copyAll()', () => {
    test('copies to both Android and iOS', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dir, opts) => {
        if (opts && opts.withFileTypes) return [];
        if (dir.includes('mockups')) return ['screen.png'];
        return [];
      });

      const copier = new ScreenshotMetadataCopier('demo', '/repo');
      const results = copier.copyAll();

      expect(results.android).toBeDefined();
      expect(results.ios).toBeDefined();
    });

    test('returns empty results when mockups dir not found', () => {
      fs.existsSync.mockReturnValue(false);

      const copier = new ScreenshotMetadataCopier('demo');
      const results = copier.copyAll();

      expect(results.android.phone?.count || 0).toBe(0);
      expect(results.android.tablet?.count || 0).toBe(0);
    });
  });

  describe('getDeviceConfigs()', () => {
    test('returns device configurations', () => {
      const configs = ScreenshotMetadataCopier.getDeviceConfigs();

      expect(configs.ios).toBe(IOS_DEVICES);
      expect(configs.android).toBe(ANDROID_DEVICES);
    });
  });
});
