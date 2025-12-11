/**
 * Tests for asset-operations.js
 * Tests critical asset management logic
 */

const path = require('path');
const fs = require('fs');

// Mock child_process before requiring module
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Mock input-validator
jest.mock('../../01-client-setup/shared/input-validator', () => ({
  validateBusinessTypeKey: jest.fn((key) => key),
}));

// Now require the module
const assetOps = require('../../01-client-setup/steps/modules/asset-operations');

describe('asset-operations', () => {
  let existsSyncSpy;
  let readdirSyncSpy;
  let mkdirSyncSpy;
  let copyFileSyncSpy;
  let lstatSyncSpy;
  let readFileSyncSpy;
  let writeFileSyncSpy;
  let rmSyncSpy;
  let unlinkSyncSpy;

  const mockBusinessTypes = [
    { key: 'coffee', label: 'Coffee' },
    { key: 'beer', label: 'Beer' },
    { key: 'restaurant', label: 'Restaurant' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    existsSyncSpy = jest.spyOn(fs, 'existsSync');
    readdirSyncSpy = jest.spyOn(fs, 'readdirSync');
    mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    copyFileSyncSpy = jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
    lstatSyncSpy = jest.spyOn(fs, 'lstatSync');
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync');
    writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    rmSyncSpy = jest.spyOn(fs, 'rmSync').mockImplementation(() => {});
    unlinkSyncSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateAssetsStructure()', () => {
    test('returns error if generalAssetsDir does not exist', () => {
      existsSyncSpy.mockReturnValue(false);

      const result = assetOps.validateAssetsStructure(
        '/fake/assets',
        '/fake/clients',
        mockBusinessTypes
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('General assets directory not found');
    });

    test('returns error if clientsDir does not exist', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p === '/fake/assets') return true;
        if (p === '/fake/clients') return false;
        return true;
      });

      const result = assetOps.validateAssetsStructure(
        '/fake/assets',
        '/fake/clients',
        mockBusinessTypes
      );

      expect(result.errors.some((e) => e.includes('Clients directory not found'))).toBe(true);
    });

    test('returns warning if animations/ does not exist', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('animations') && !p.includes('coffee') && !p.includes('beer')) return false;
        return true;
      });

      const result = assetOps.validateAssetsStructure(
        '/fake/assets',
        '/fake/clients',
        mockBusinessTypes
      );

      expect(result.warnings.some((w) => w.includes('animations'))).toBe(true);
    });

    test('returns warning if images/ does not exist', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('images') && !p.includes('coffee') && !p.includes('beer')) return false;
        return true;
      });

      const result = assetOps.validateAssetsStructure(
        '/fake/assets',
        '/fake/clients',
        mockBusinessTypes
      );

      expect(result.warnings.some((w) => w.includes('images'))).toBe(true);
    });

    test('returns warning if business type has no animation assets', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('animations/coffee')) return false;
        return true;
      });

      const result = assetOps.validateAssetsStructure(
        '/fake/assets',
        '/fake/clients',
        mockBusinessTypes
      );

      expect(result.warnings.some((w) => w.includes("business type 'coffee'"))).toBe(true);
    });

    test('returns warning if business type has no image assets', () => {
      existsSyncSpy.mockImplementation((p) => {
        if (p.includes('images/beer')) return false;
        return true;
      });

      const result = assetOps.validateAssetsStructure(
        '/fake/assets',
        '/fake/clients',
        mockBusinessTypes
      );

      expect(result.warnings.some((w) => w.includes("business type 'beer'"))).toBe(true);
    });

    test('returns no errors if structure is complete', () => {
      existsSyncSpy.mockReturnValue(true);

      const result = assetOps.validateAssetsStructure(
        '/fake/assets',
        '/fake/clients',
        mockBusinessTypes
      );

      expect(result.errors).toHaveLength(0);
    });
  });

  describe('displayValidationResults()', () => {
    test('returns true if no errors', () => {
      const result = assetOps.displayValidationResults({
        errors: [],
        warnings: ['some warning'],
      });

      expect(result).toBe(true);
    });

    test('returns false if any errors', () => {
      const result = assetOps.displayValidationResults({
        errors: ['critical error'],
        warnings: [],
      });

      expect(result).toBe(false);
    });
  });

  describe('replaceBusinessTypePaths()', () => {
    // Access the internal function through module exports test
    // Since it's not exported, we test through updatePubspecAssets behavior

    test('updatePubspecAssets replaces coffee paths with beer', () => {
      existsSyncSpy.mockReturnValue(true);
      readFileSyncSpy.mockReturnValue(`
flutter:
  assets:
    - assets/animations/coffee/
    - assets/images/coffee/
    - assets/configs/coffee/
`);

      const { execSync } = require('child_process');
      execSync.mockImplementation(() => {});

      assetOps.updatePubspecAssets('beer', '/fake/pubspec.yaml', mockBusinessTypes, '/fake/target');

      expect(writeFileSyncSpy).toHaveBeenCalled();
      const writtenContent = writeFileSyncSpy.mock.calls[0][1];
      expect(writtenContent).toContain('assets/animations/beer/');
      expect(writtenContent).toContain('assets/images/beer/');
      expect(writtenContent).toContain('assets/configs/beer/');
      expect(writtenContent).not.toContain('assets/animations/coffee/');
    });

    test('updatePubspecAssets replaces multiple business types', () => {
      existsSyncSpy.mockReturnValue(true);
      readFileSyncSpy.mockReturnValue(`
flutter:
  assets:
    - assets/animations/coffee/
    - assets/animations/beer/
    - assets/images/restaurant/
`);

      const { execSync } = require('child_process');
      execSync.mockImplementation(() => {});

      assetOps.updatePubspecAssets('beer', '/fake/pubspec.yaml', mockBusinessTypes, '/fake/target');

      const writtenContent = writeFileSyncSpy.mock.calls[0][1];
      // All should be replaced with 'beer'
      expect(writtenContent).toContain('assets/animations/beer/');
      expect(writtenContent).toContain('assets/images/beer/');
      expect(writtenContent).not.toContain('assets/animations/coffee/');
      expect(writtenContent).not.toContain('assets/images/restaurant/');
    });

    test('updatePubspecAssets does not affect other paths', () => {
      existsSyncSpy.mockReturnValue(true);
      readFileSyncSpy.mockReturnValue(`
flutter:
  assets:
    - assets/animations/coffee/
    - assets/fonts/
    - assets/client_specific_assets/
`);

      const { execSync } = require('child_process');
      execSync.mockImplementation(() => {});

      assetOps.updatePubspecAssets('beer', '/fake/pubspec.yaml', mockBusinessTypes, '/fake/target');

      const writtenContent = writeFileSyncSpy.mock.calls[0][1];
      expect(writtenContent).toContain('assets/fonts/');
      expect(writtenContent).toContain('assets/client_specific_assets/');
    });

    test('updatePubspecAssets skips if pubspec not found', () => {
      existsSyncSpy.mockReturnValue(false);

      assetOps.updatePubspecAssets('beer', '/fake/pubspec.yaml', mockBusinessTypes, '/fake/target');

      expect(writeFileSyncSpy).not.toHaveBeenCalled();
    });
  });

  describe('copyFolderRecursiveSync()', () => {
    test('copies files recursively', () => {
      existsSyncSpy.mockReturnValue(true);

      // Track call count to prevent infinite recursion
      let srcCalls = 0;
      let subdirCalls = 0;

      readdirSyncSpy.mockImplementation((p) => {
        if (p === '/src' && srcCalls === 0) {
          srcCalls++;
          return ['file1.txt', 'subdir'];
        }
        if (p === '/src/subdir' && subdirCalls === 0) {
          subdirCalls++;
          return ['file2.txt'];
        }
        return [];
      });

      lstatSyncSpy.mockImplementation((p) => ({
        isDirectory: () => p === '/src/subdir',
      }));

      assetOps.copyFolderRecursiveSync('/src', '/dest');

      expect(copyFileSyncSpy).toHaveBeenCalledTimes(2);
    });

    test('respects ignorePaths', () => {
      existsSyncSpy.mockReturnValue(true);

      let callCount = 0;
      readdirSyncSpy.mockImplementation(() => {
        if (callCount === 0) {
          callCount++;
          return ['keep.txt', 'ignored'];
        }
        return [];
      });

      lstatSyncSpy.mockImplementation((p) => ({
        isDirectory: () => p.includes('ignored'),
      }));

      assetOps.copyFolderRecursiveSync('/src', '/dest', ['ignored']);

      expect(copyFileSyncSpy).toHaveBeenCalledTimes(1);
      expect(copyFileSyncSpy).toHaveBeenCalledWith('/src/keep.txt', '/dest/keep.txt');
    });

    test('creates directories that do not exist', () => {
      existsSyncSpy.mockReturnValue(false);

      let callCount = 0;
      readdirSyncSpy.mockImplementation(() => {
        if (callCount === 0) {
          callCount++;
          return ['file.txt'];
        }
        return [];
      });

      lstatSyncSpy.mockReturnValue({ isDirectory: () => false });

      assetOps.copyFolderRecursiveSync('/src', '/dest');

      expect(mkdirSyncSpy).toHaveBeenCalled();
    });
  });

  describe('ensureDir()', () => {
    test('creates directory if it does not exist', () => {
      existsSyncSpy.mockReturnValue(false);

      assetOps.ensureDir('/new/dir');

      expect(mkdirSyncSpy).toHaveBeenCalledWith('/new/dir', { recursive: true });
    });

    test('does nothing if directory exists', () => {
      existsSyncSpy.mockReturnValue(true);

      assetOps.ensureDir('/existing/dir');

      expect(mkdirSyncSpy).not.toHaveBeenCalled();
    });
  });

  describe('cleanAssetsDir()', () => {
    test('creates backup of business type folders', () => {
      existsSyncSpy.mockReturnValue(true);

      // Use specific path matching to avoid infinite recursion
      const pathResponses = new Map();
      pathResponses.set('/assets', ['animations', 'images', 'configs']);
      pathResponses.set('/assets/animations', ['coffee', 'shared']);
      pathResponses.set('/assets/images', ['coffee']);
      pathResponses.set('/assets/configs', []);

      readdirSyncSpy.mockImplementation((p) => {
        return pathResponses.get(p) || [];
      });
      lstatSyncSpy.mockReturnValue({ isDirectory: () => true });

      assetOps.cleanAssetsDir('/assets', mockBusinessTypes);

      // Should have tried to remove coffee folders
      expect(rmSyncSpy).toHaveBeenCalled();
    });

    test('only removes business type folders, not generic', () => {
      existsSyncSpy.mockReturnValue(true);

      const pathResponses = new Map();
      pathResponses.set('/assets', ['animations']);
      pathResponses.set('/assets/animations', ['coffee', 'shared', 'generic']);

      readdirSyncSpy.mockImplementation((p) => {
        return pathResponses.get(p) || [];
      });
      lstatSyncSpy.mockReturnValue({ isDirectory: () => true });

      assetOps.cleanAssetsDir('/assets', mockBusinessTypes);

      // Should only remove business type folders (coffee), not shared or generic
      const rmCalls = rmSyncSpy.mock.calls.map((c) => c[0]);
      expect(rmCalls.some((c) => c.includes('coffee'))).toBe(true);
      expect(rmCalls.some((c) => c.includes('shared'))).toBe(false);
      expect(rmCalls.some((c) => c.includes('generic'))).toBe(false);
    });

    test('returns backup directory path', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockReturnValue([]);

      const result = assetOps.cleanAssetsDir('/assets', mockBusinessTypes);

      expect(result).toBe('/assets/.backup_temp');
    });
  });

  describe('cleanupBackup()', () => {
    test('removes backup directory if exists', () => {
      existsSyncSpy.mockReturnValue(true);

      assetOps.cleanupBackup('/backup/dir');

      expect(rmSyncSpy).toHaveBeenCalledWith('/backup/dir', { recursive: true, force: true });
    });

    test('does nothing if backup does not exist', () => {
      existsSyncSpy.mockReturnValue(false);

      assetOps.cleanupBackup('/backup/dir');

      expect(rmSyncSpy).not.toHaveBeenCalled();
    });
  });

  describe('restoreFromBackup()', () => {
    test('warns if backup directory not found', () => {
      existsSyncSpy.mockReturnValue(false);

      assetOps.restoreFromBackup('/backup', []);

      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No backup directory'));
    });

    test('restores backed up items', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockReturnValue([]);
      lstatSyncSpy.mockReturnValue({ isDirectory: () => false });

      const backedUp = [
        { category: 'animations', item: 'coffee', backup: '/backup/animations/coffee', original: '/assets/animations/coffee' },
      ];

      assetOps.restoreFromBackup('/backup', backedUp);

      // Should attempt to copy from backup to original
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Restoring'));
    });
  });

  describe('copyClientAssets()', () => {
    test('copies client_specific_assets folder', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockReturnValue(['logo.png']);
      lstatSyncSpy.mockReturnValue({ isDirectory: () => false });

      assetOps.copyClientAssets('/source/client', '/dest/assets');

      expect(copyFileSyncSpy).toHaveBeenCalled();
    });

    test('logs warning if client_specific_assets not found', () => {
      existsSyncSpy.mockReturnValue(false);

      assetOps.copyClientAssets('/source/client', '/dest/assets');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('não possui a pasta assets/client_specific_assets')
      );
    });
  });

  describe('copyGeneralAssets()', () => {
    test('copies animations, images, configs, and fonts', () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSyncSpy.mockImplementation(() => []);

      assetOps.copyGeneralAssets('coffee', '/general', '/assets', mockBusinessTypes);

      // Should log success
      expect(console.log).toHaveBeenCalledWith('Assets genéricos copiados com sucesso.');
    });
  });
});
