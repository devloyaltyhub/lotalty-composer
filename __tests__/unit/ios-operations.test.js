/**
 * Tests for ios-operations.js
 * Tests iOS/Xcode operations and post-processing
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Mock dependencies before requiring module
jest.mock('fs');
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));
jest.mock('../../01-client-setup/config', () => ({
  timeouts: {
    podInstall: 300000,
  },
}));

const { execSync } = require('child_process');
const iosOps = require('../../01-client-setup/steps/modules/ios-operations');

describe('ios-operations', () => {
  const mockTargetRoot = '/project/white_label_app';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('cleanXcodeCaches()', () => {
    test('removes DerivedData directory if exists', () => {
      const homeDir = os.homedir();
      const derivedDataPath = path.join(homeDir, 'Library/Developer/Xcode/DerivedData');

      fs.existsSync.mockImplementation((p) => p === derivedDataPath);
      fs.rmSync.mockImplementation(() => {});

      iosOps.cleanXcodeCaches(mockTargetRoot);

      expect(fs.rmSync).toHaveBeenCalledWith(derivedDataPath, { recursive: true, force: true });
    });

    test('removes workspace userdata if exists', () => {
      const xcuserdataPath = path.join(mockTargetRoot, 'ios/Runner.xcworkspace/xcuserdata');

      fs.existsSync.mockImplementation((p) => p === xcuserdataPath);
      fs.rmSync.mockImplementation(() => {});

      iosOps.cleanXcodeCaches(mockTargetRoot);

      expect(fs.rmSync).toHaveBeenCalledWith(xcuserdataPath, { recursive: true, force: true });
    });

    test('handles errors gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.rmSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw
      expect(() => iosOps.cleanXcodeCaches(mockTargetRoot)).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not clean Xcode caches'),
        expect.any(String)
      );
    });

    test('skips if directories do not exist', () => {
      fs.existsSync.mockReturnValue(false);

      iosOps.cleanXcodeCaches(mockTargetRoot);

      expect(fs.rmSync).not.toHaveBeenCalled();
    });
  });

  describe('cleanFlutterBuild()', () => {
    test('runs flutter clean command', () => {
      execSync.mockImplementation(() => {});

      iosOps.cleanFlutterBuild(mockTargetRoot);

      expect(execSync).toHaveBeenCalledWith('flutter clean', {
        stdio: 'inherit',
        cwd: mockTargetRoot,
      });
    });

    test('handles flutter clean failure gracefully', () => {
      execSync.mockImplementation(() => {
        throw new Error('flutter not found');
      });

      expect(() => iosOps.cleanFlutterBuild(mockTargetRoot)).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Flutter clean failed'),
        expect.any(String)
      );
    });

    test('logs success message on completion', () => {
      execSync.mockImplementation(() => {});

      iosOps.cleanFlutterBuild(mockTargetRoot);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Flutter build cleaned successfully')
      );
    });
  });

  describe('reinstallPods()', () => {
    test('runs pod install with correct encoding', () => {
      const iosPath = path.join(mockTargetRoot, 'ios');

      fs.existsSync.mockReturnValue(true);
      execSync.mockImplementation(() => {});

      iosOps.reinstallPods(mockTargetRoot);

      expect(execSync).toHaveBeenCalledWith('LANG=en_US.UTF-8 pod install', {
        stdio: 'inherit',
        cwd: iosPath,
        timeout: 300000,
      });
    });

    test('skips if ios directory does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      iosOps.reinstallPods(mockTargetRoot);

      expect(execSync).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('iOS directory not found')
      );
    });

    test('skips if Podfile does not exist', () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.includes('Podfile')) return false;
        return true;
      });

      iosOps.reinstallPods(mockTargetRoot);

      expect(execSync).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Podfile not found')
      );
    });

    test('handles pod install failure gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      execSync.mockImplementation(() => {
        throw new Error('pod command not found');
      });

      expect(() => iosOps.reinstallPods(mockTargetRoot)).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Pod install failed'),
        expect.any(String)
      );
    });
  });

  describe('modifyAndroidManifest()', () => {
    const manifestPath = '/project/android/app/src/main/AndroidManifest.xml';

    test('adds android:icon if missing but label exists', () => {
      const originalManifest = `
        <application
          android:label="Test App"
          android:name="io.flutter.app.FlutterApplication">
      `;

      fs.readFileSync.mockReturnValue(originalManifest);
      fs.writeFileSync.mockImplementation(() => {});

      iosOps.modifyAndroidManifest(manifestPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('android:icon="@mipmap/ic_launcher"');
    });

    test('does not modify if android:icon already exists', () => {
      const originalManifest = `
        <application
          android:label="Test App"
          android:icon="@mipmap/ic_launcher"
          android:name="io.flutter.app.FlutterApplication">
      `;

      fs.readFileSync.mockReturnValue(originalManifest);
      fs.writeFileSync.mockImplementation(() => {});

      iosOps.modifyAndroidManifest(manifestPath);

      // Should not write since no changes needed
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    test('handles read error gracefully', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => iosOps.modifyAndroidManifest(manifestPath)).not.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao modificar o AndroidManifest')
      );
    });

    test('preserves existing attributes', () => {
      const originalManifest = `
        <application
          android:label="Test App"
          android:theme="@style/AppTheme"
          android:name="io.flutter.app.FlutterApplication">
      `;

      fs.readFileSync.mockReturnValue(originalManifest);
      fs.writeFileSync.mockImplementation(() => {});

      iosOps.modifyAndroidManifest(manifestPath);

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('android:theme="@style/AppTheme"');
      expect(writtenContent).toContain('android:name="io.flutter.app.FlutterApplication"');
    });
  });

  describe('postProcess()', () => {
    test('runs all post-processing steps in order', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('<application android:label="Test">');
      fs.writeFileSync.mockImplementation(() => {});
      fs.rmSync.mockImplementation(() => {});
      execSync.mockImplementation(() => {});

      iosOps.postProcess(mockTargetRoot);

      // Should have called execSync for:
      // 1. dart run package_rename
      // 2. flutter clean
      // 3. pod install
      expect(execSync).toHaveBeenCalledWith(
        'dart run package_rename',
        expect.objectContaining({ cwd: mockTargetRoot })
      );
      expect(execSync).toHaveBeenCalledWith(
        'flutter clean',
        expect.objectContaining({ cwd: mockTargetRoot })
      );
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('pod install'),
        expect.any(Object)
      );
    });

    test('modifies AndroidManifest.xml', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('<application android:label="Test">');
      fs.writeFileSync.mockImplementation(() => {});
      fs.rmSync.mockImplementation(() => {});
      execSync.mockImplementation(() => {});

      iosOps.postProcess(mockTargetRoot);

      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('AndroidManifest.xml'),
        'utf8'
      );
    });

    test('cleans Xcode caches', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('<application android:label="Test" android:icon="@mipmap/ic_launcher">');
      fs.rmSync.mockImplementation(() => {});
      execSync.mockImplementation(() => {});

      iosOps.postProcess(mockTargetRoot);

      // Should try to clean DerivedData
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('DerivedData')
      );
    });
  });
});
