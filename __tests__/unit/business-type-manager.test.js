/**
 * Tests for business-type-manager.js
 * Tests business type validation, repository, and asset management
 */

const path = require('path');
const fs = require('fs');

// Mock fs before requiring module
jest.mock('fs');

// Mock input-validator
jest.mock('../../01-client-setup/shared/input-validator', () => ({
  validateBusinessTypeKey: jest.fn((key) => key),
}));

const {
  BusinessTypeRepository,
  ValidationService,
  FileSystemService,
  AssetManager,
} = require('../../01-client-setup/shared/business-type-manager');

const inputValidator = require('../../01-client-setup/shared/input-validator');

describe('business-type-manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    inputValidator.validateBusinessTypeKey.mockImplementation((key) => key);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('BusinessTypeRepository', () => {
    describe('getExistingTypes()', () => {
      test('returns types from animations directory', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue(['coffee', 'beer', 'restaurant']);
        fs.statSync.mockReturnValue({ isDirectory: () => true });

        const result = BusinessTypeRepository.getExistingTypes();

        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({ key: 'coffee', label: 'Coffee' });
        expect(result[1]).toEqual({ key: 'beer', label: 'Beer' });
        expect(result[2]).toEqual({ key: 'restaurant', label: 'Restaurant' });
      });

      test('excludes hidden directories', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue(['coffee', '.hidden', '.DS_Store']);
        fs.statSync.mockReturnValue({ isDirectory: () => true });

        const result = BusinessTypeRepository.getExistingTypes();

        expect(result).toHaveLength(1);
        expect(result[0].key).toBe('coffee');
      });

      test('excludes files (only directories)', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue(['coffee', 'readme.md']);
        fs.statSync.mockImplementation((p) => ({
          isDirectory: () => !p.includes('readme'),
        }));

        const result = BusinessTypeRepository.getExistingTypes();

        expect(result).toHaveLength(1);
        expect(result[0].key).toBe('coffee');
      });

      test('capitalizes label correctly', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue(['pizza']);
        fs.statSync.mockReturnValue({ isDirectory: () => true });

        const result = BusinessTypeRepository.getExistingTypes();

        expect(result[0].label).toBe('Pizza');
      });

      test('falls back to defaults when assets directory not found', () => {
        fs.existsSync.mockReturnValue(false);
        fs.readFileSync.mockImplementation(() => {
          throw new Error('File not found');
        });

        const result = BusinessTypeRepository.getExistingTypes();

        // Falls back to default types
        expect(result.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('ValidationService', () => {
    describe('validateBusinessTypeKey()', () => {
      beforeEach(() => {
        // Mock repository to return existing types
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue(['coffee', 'beer']);
        fs.statSync.mockReturnValue({ isDirectory: () => true });
      });

      test('returns error for key less than 2 chars', () => {
        const result = ValidationService.validateBusinessTypeKey('a');
        expect(result).toContain('at least 2 characters');
      });

      test('returns error for empty key', () => {
        const result = ValidationService.validateBusinessTypeKey('');
        expect(result).toContain('at least 2 characters');
      });

      test('returns error for key starting with number', () => {
        const result = ValidationService.validateBusinessTypeKey('1coffee');
        expect(result).toContain('start with a letter');
      });

      test('returns error for uppercase letters', () => {
        const result = ValidationService.validateBusinessTypeKey('Coffee');
        expect(result).toContain('lowercase letters');
      });

      test('returns error for hyphens', () => {
        const result = ValidationService.validateBusinessTypeKey('coffee-shop');
        expect(result).toContain('lowercase letters');
      });

      test('returns error for existing type', () => {
        const result = ValidationService.validateBusinessTypeKey('coffee');
        expect(result).toContain('already exists');
      });

      test('returns null for valid new key', () => {
        const result = ValidationService.validateBusinessTypeKey('pizza');
        expect(result).toBeNull();
      });

      test('accepts underscores', () => {
        const result = ValidationService.validateBusinessTypeKey('coffee_shop');
        expect(result).toBeNull();
      });

      test('accepts numbers after first char', () => {
        const result = ValidationService.validateBusinessTypeKey('shop2go');
        expect(result).toBeNull();
      });
    });

    describe('validateLabel()', () => {
      test('returns error for empty label', () => {
        const result = ValidationService.validateLabel('');
        expect(result).toContain('required');
      });

      test('returns error for whitespace-only label', () => {
        const result = ValidationService.validateLabel('   ');
        expect(result).toContain('required');
      });

      test('returns null for valid label', () => {
        const result = ValidationService.validateLabel('Coffee Shop');
        expect(result).toBeNull();
      });
    });
  });

  describe('FileSystemService', () => {
    describe('ensureDirectoryExists()', () => {
      test('creates directory if not exists', () => {
        fs.existsSync.mockReturnValue(false);
        fs.mkdirSync.mockImplementation(() => {});

        const result = FileSystemService.ensureDirectoryExists('/new/dir');

        expect(result).toBe(true);
        expect(fs.mkdirSync).toHaveBeenCalledWith('/new/dir', { recursive: true });
      });

      test('returns false if directory exists', () => {
        fs.existsSync.mockReturnValue(true);

        const result = FileSystemService.ensureDirectoryExists('/existing/dir');

        expect(result).toBe(false);
        expect(fs.mkdirSync).not.toHaveBeenCalled();
      });
    });

    describe('copyFile()', () => {
      test('copies file successfully', () => {
        fs.existsSync.mockReturnValue(true);
        fs.copyFileSync.mockImplementation(() => {});

        FileSystemService.copyFile('/source/file.txt', '/dest/file.txt');

        expect(fs.copyFileSync).toHaveBeenCalledWith('/source/file.txt', '/dest/file.txt');
      });

      test('throws error if source not found', () => {
        fs.existsSync.mockReturnValue(false);

        expect(() => FileSystemService.copyFile('/missing/file.txt', '/dest/file.txt')).toThrow(
          'Source file not found'
        );
      });

      test('creates parent directory if needed', () => {
        fs.existsSync.mockImplementation((p) => {
          if (p === '/source/file.txt') return true;
          return false;
        });
        fs.mkdirSync.mockImplementation(() => {});
        fs.copyFileSync.mockImplementation(() => {});

        FileSystemService.copyFile('/source/file.txt', '/new/dest/file.txt');

        expect(fs.mkdirSync).toHaveBeenCalled();
      });
    });

    describe('copyDirectory()', () => {
      test('copies files in directory', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue(['file1.txt', 'file2.txt']);
        fs.statSync.mockReturnValue({ isFile: () => true });
        fs.mkdirSync.mockImplementation(() => {});
        fs.copyFileSync.mockImplementation(() => {});

        const count = FileSystemService.copyDirectory('/source', '/dest');

        expect(count).toBe(2);
        expect(fs.copyFileSync).toHaveBeenCalledTimes(2);
      });

      test('throws error if source directory not found', () => {
        fs.existsSync.mockReturnValue(false);

        expect(() => FileSystemService.copyDirectory('/missing', '/dest')).toThrow(
          'Source directory not found'
        );
      });

      test('creates target directory', () => {
        fs.existsSync.mockImplementation((p) => p === '/source');
        fs.readdirSync.mockReturnValue([]);
        fs.mkdirSync.mockImplementation(() => {});

        FileSystemService.copyDirectory('/source', '/dest');

        expect(fs.mkdirSync).toHaveBeenCalled();
      });
    });

    describe('writeFile()', () => {
      test('writes file with content', () => {
        fs.existsSync.mockReturnValue(true);
        fs.writeFileSync.mockImplementation(() => {});

        FileSystemService.writeFile('/path/file.txt', 'content');

        expect(fs.writeFileSync).toHaveBeenCalledWith('/path/file.txt', 'content', 'utf8');
      });

      test('creates parent directory if needed', () => {
        fs.existsSync.mockReturnValue(false);
        fs.mkdirSync.mockImplementation(() => {});
        fs.writeFileSync.mockImplementation(() => {});

        FileSystemService.writeFile('/new/path/file.txt', 'content');

        expect(fs.mkdirSync).toHaveBeenCalled();
      });
    });
  });

  describe('AssetManager', () => {
    let assetManager;

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.mkdirSync.mockImplementation(() => {});
      fs.readdirSync.mockReturnValue([]);
      fs.writeFileSync.mockImplementation(() => {});
      assetManager = new AssetManager('pizza');
    });

    describe('constructor', () => {
      test('validates business type key', () => {
        new AssetManager('test_type');
        expect(inputValidator.validateBusinessTypeKey).toHaveBeenCalledWith(
          'test_type',
          'businessTypeKey'
        );
      });

      test('throws on invalid key', () => {
        inputValidator.validateBusinessTypeKey.mockImplementation(() => {
          throw new Error('Invalid key');
        });

        expect(() => new AssetManager('../invalid')).toThrow('Invalid key');
      });
    });

    describe('createDirectories()', () => {
      test('creates animations, images, and configs directories', () => {
        fs.existsSync.mockReturnValue(false);

        assetManager.createDirectories();

        expect(fs.mkdirSync).toHaveBeenCalledTimes(3);
      });

      test('returns created directory paths', () => {
        fs.existsSync.mockReturnValue(false);

        const result = assetManager.createDirectories();

        expect(result.animationsDir).toContain('animations/pizza');
        expect(result.imagesDir).toContain('images/pizza');
        expect(result.configsDir).toContain('configs/pizza');
      });
    });

    describe('copyFromExistingType()', () => {
      test('validates source type key', () => {
        fs.existsSync.mockReturnValue(false);
        fs.readdirSync.mockReturnValue([]);

        assetManager.copyFromExistingType('coffee');

        expect(inputValidator.validateBusinessTypeKey).toHaveBeenCalledWith(
          'coffee',
          'sourceTypeKey'
        );
      });

      test('copies animations, images, and configs', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue(['file1.json', 'file2.json']);
        fs.statSync.mockReturnValue({ isFile: () => true });
        fs.copyFileSync.mockImplementation(() => {});

        const count = assetManager.copyFromExistingType('coffee');

        // 2 files in each of 3 directories
        expect(count).toBe(6);
      });

      test('handles missing source directories gracefully', () => {
        fs.existsSync.mockReturnValue(false);

        const count = assetManager.copyFromExistingType('nonexistent');

        expect(count).toBe(0);
      });
    });

    describe('createPlaceholderAssets()', () => {
      test('creates README file', () => {
        fs.existsSync.mockReturnValue(false);
        fs.readdirSync.mockReturnValue([]);

        assetManager.createPlaceholderAssets();

        expect(fs.writeFileSync).toHaveBeenCalledWith(
          expect.stringContaining('README.md'),
          expect.stringContaining('Pizza Assets'),
          'utf8'
        );
      });

      test('creates default animation when no animations exist', () => {
        fs.existsSync.mockReturnValue(false);
        fs.readdirSync.mockReturnValue([]);

        assetManager.createPlaceholderAssets();

        expect(fs.writeFileSync).toHaveBeenCalledWith(
          expect.stringContaining('placeholder.json'),
          expect.stringContaining('"nm": "Placeholder Animation"'),
          expect.any(String)
        );
      });

      test('copies ranking config template if exists', () => {
        fs.existsSync.mockImplementation((p) => p.includes('ranking_config_template'));
        fs.readdirSync.mockReturnValue([]);
        fs.copyFileSync.mockImplementation(() => {});

        assetManager.createPlaceholderAssets();

        // Should attempt to copy ranking config
        expect(fs.copyFileSync).toHaveBeenCalled();
      });
    });
  });
});
