/**
 * Tests for keystore-operations.js
 * Tests Android keystore path transforms and copy operations
 */

const path = require('path');
const fs = require('fs');

// Mock fs
jest.mock('fs');

// Now require the module
const keystoreOps = require('../../01-client-setup/steps/modules/keystore-operations');

describe('keystore-operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('copyAndroidKeystore()', () => {
    const targetRoot = '/project/white_label_app';
    const clientCode = 'test-client';

    test('warns if credentials directory does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      keystoreOps.copyAndroidKeystore(targetRoot, clientCode);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Android keystores not found')
      );
    });

    test('warns if android directory does not exist', () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.includes('loyalty-credentials')) return true;
        if (p.includes('android')) return false;
        return true;
      });

      keystoreOps.copyAndroidKeystore(targetRoot, clientCode);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Android directory not found')
      );
    });

    test('creates app directory if it does not exist', () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.includes('loyalty-credentials')) return true;
        if (p.endsWith('/app')) return false;
        if (p.includes('android')) return true;
        if (p.includes('keystore')) return true;
        return true;
      });
      fs.mkdirSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});
      fs.readFileSync.mockReturnValue('debug.storeFile=./old\nrelease.storeFile=./old');
      fs.writeFileSync.mockImplementation(() => {});

      keystoreOps.copyAndroidKeystore(targetRoot, clientCode);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('/app'),
        { recursive: true }
      );
    });

    test('copies debug keystore file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});
      fs.readFileSync.mockReturnValue('debug.storeFile=./old\nrelease.storeFile=./old');
      fs.writeFileSync.mockImplementation(() => {});

      keystoreOps.copyAndroidKeystore(targetRoot, clientCode);

      expect(fs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('keystore-debug.jks'),
        expect.stringContaining('keystore-debug.jks')
      );
    });

    test('copies release keystore file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});
      fs.readFileSync.mockReturnValue('debug.storeFile=./old\nrelease.storeFile=./old');
      fs.writeFileSync.mockImplementation(() => {});

      keystoreOps.copyAndroidKeystore(targetRoot, clientCode);

      expect(fs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('keystore-release.jks'),
        expect.stringContaining('keystore-release.jks')
      );
    });

    test('transforms keystore.properties with correct paths', () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});
      fs.readFileSync.mockReturnValue(
        'debug.storeFile=/old/path/debug.jks\n' +
        'debug.storePassword=debug123\n' +
        'debug.keyAlias=debug\n' +
        'release.storeFile=/old/path/release.jks\n' +
        'release.storePassword=release123\n' +
        'release.keyAlias=release'
      );
      fs.writeFileSync.mockImplementation(() => {});

      keystoreOps.copyAndroidKeystore(targetRoot, clientCode);

      // Find the writeFileSync call for key.properties
      const writeCall = fs.writeFileSync.mock.calls.find(
        (call) => call[0].includes('key.properties')
      );

      expect(writeCall).toBeDefined();
      const writtenContent = writeCall[1];

      // Check paths were transformed
      expect(writtenContent).toContain('debug.storeFile=./app/keystore-debug.jks');
      expect(writtenContent).toContain('release.storeFile=./app/keystore-release.jks');

      // Check passwords were preserved
      expect(writtenContent).toContain('debug.storePassword=debug123');
      expect(writtenContent).toContain('release.storePassword=release123');

      // Check aliases were preserved
      expect(writtenContent).toContain('debug.keyAlias=debug');
      expect(writtenContent).toContain('release.keyAlias=release');
    });

    test('skips missing keystore files with warning', () => {
      fs.existsSync.mockImplementation((p) => {
        if (p.includes('loyalty-credentials') && !p.includes('keystore-debug')) return true;
        if (p.includes('keystore-debug')) return false;
        return true;
      });
      fs.copyFileSync.mockImplementation(() => {});
      fs.readFileSync.mockReturnValue('debug.storeFile=./old\nrelease.storeFile=./old');
      fs.writeFileSync.mockImplementation(() => {});

      keystoreOps.copyAndroidKeystore(targetRoot, clientCode);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Debug keystore not found')
      );
    });

    test('displays success summary when files copied', () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});
      fs.readFileSync.mockReturnValue('debug.storeFile=./old\nrelease.storeFile=./old');
      fs.writeFileSync.mockImplementation(() => {});

      keystoreOps.copyAndroidKeystore(targetRoot, clientCode);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Android keystores configured successfully')
      );
    });

    test('handles errors gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      keystoreOps.copyAndroidKeystore(targetRoot, clientCode);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error copying Android keystores'),
        expect.any(String)
      );
    });

    test('displays warning when no keystores copied', () => {
      // All directory checks pass, but no keystore files exist
      fs.existsSync.mockImplementation((p) => {
        // Credentials directory exists
        if (p.includes('loyalty-credentials') && p.includes('android') && !p.includes('.jks') && !p.includes('.properties')) {
          return true;
        }
        // Android and app directories exist
        if (p.endsWith('/android') || p.endsWith('/app')) return true;
        // Keystore files don't exist
        if (p.includes('keystore')) return false;
        return true;
      });

      keystoreOps.copyAndroidKeystore(targetRoot, clientCode);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No keystores were copied')
      );
    });
  });

  describe('updateKeystorePaths logic (via copyAndroidKeystore)', () => {
    test('updates debug.storeFile to ./app/keystore-debug.jks', () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});
      fs.readFileSync.mockReturnValue(
        'debug.storeFile=/Users/dev/keystores/debug.jks'
      );
      fs.writeFileSync.mockImplementation(() => {});

      keystoreOps.copyAndroidKeystore('/project', 'client');

      const writeCall = fs.writeFileSync.mock.calls.find(
        (call) => call[0].includes('key.properties')
      );
      expect(writeCall[1]).toContain('debug.storeFile=./app/keystore-debug.jks');
    });

    test('updates release.storeFile to ./app/keystore-release.jks', () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});
      fs.readFileSync.mockReturnValue(
        'release.storeFile=/Users/dev/keystores/release.jks'
      );
      fs.writeFileSync.mockImplementation(() => {});

      keystoreOps.copyAndroidKeystore('/project', 'client');

      const writeCall = fs.writeFileSync.mock.calls.find(
        (call) => call[0].includes('key.properties')
      );
      expect(writeCall[1]).toContain('release.storeFile=./app/keystore-release.jks');
    });
  });

  describe('getKeystoreFiles logic (via copyAndroidKeystore)', () => {
    test('copies 3 files: debug keystore, release keystore, properties', () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});
      fs.readFileSync.mockReturnValue('debug.storeFile=x\nrelease.storeFile=y');
      fs.writeFileSync.mockImplementation(() => {});

      keystoreOps.copyAndroidKeystore('/project', 'client');

      // 2 copyFileSync calls (keystores) + 1 writeFileSync (properties)
      expect(fs.copyFileSync).toHaveBeenCalledTimes(2);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    test('marks keystore.properties for transform', () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});
      fs.readFileSync.mockReturnValue('debug.storeFile=old\nrelease.storeFile=old');
      fs.writeFileSync.mockImplementation(() => {});

      keystoreOps.copyAndroidKeystore('/project', 'client');

      // readFileSync is called for keystore.properties to transform it
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('keystore.properties'),
        'utf8'
      );

      // writeFileSync is called with transformed content
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('key.properties'),
        expect.any(String)
      );
    });
  });
});
