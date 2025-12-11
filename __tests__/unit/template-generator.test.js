/**
 * Tests for template-generator.js
 * Tests Dart file generation and template processing
 */

const path = require('path');
const fs = require('fs');

// Mock fs
jest.mock('fs');

// Mock input-validator
jest.mock('../../01-client-setup/shared/input-validator', () => ({
  validateHexColor: jest.fn((hex) => hex),
}));

// Now require the module
const templateGen = require('../../01-client-setup/steps/modules/template-generator');
const inputValidator = require('../../01-client-setup/shared/input-validator');

describe('template-generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // Reset validateHexColor to default pass-through behavior
    inputValidator.validateHexColor.mockImplementation((hex) => hex);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('hexToDartColor()', () => {
    test('converts #5D32B3 to 0xFF5D32B3', () => {
      const result = templateGen.hexToDartColor('#5D32B3');
      expect(result).toBe('0xFF5D32B3');
    });

    test('converts #ffffff to 0xFFFFFFFF', () => {
      const result = templateGen.hexToDartColor('#ffffff');
      expect(result).toBe('0xFFFFFFFF');
    });

    test('converts 6-char hex without # prefix', () => {
      const result = templateGen.hexToDartColor('5D32B3');
      expect(result).toBe('0xFF5D32B3');
    });

    test('converts 8-char hex with alpha to correct format', () => {
      // 8-char format: RRGGBBAA -> 0xAARRGGBB
      const result = templateGen.hexToDartColor('#FFFFFF1A');
      expect(result).toBe('0x1AFFFFFF');
    });

    test('converts 8-char hex 00000080 correctly', () => {
      // Black with 50% opacity
      const result = templateGen.hexToDartColor('#00000080');
      expect(result).toBe('0x80000000');
    });

    test('converts lowercase to uppercase', () => {
      const result = templateGen.hexToDartColor('#abcdef');
      expect(result).toBe('0xFFABCDEF');
    });

    test('throws error for invalid hex format', () => {
      inputValidator.validateHexColor.mockImplementation(() => {
        throw new Error('Invalid hex color');
      });

      expect(() => templateGen.hexToDartColor('invalid')).toThrow('Invalid hex color');
    });
  });

  describe('generateFromTemplate()', () => {
    const mockClientConfig = {
      clientCode: 'test-client',
      companyHint: 'Test Company',
      appName: 'Test App',
      storeUrls: {
        android: 'https://play.google.com/store/apps/details?id=com.test',
        ios: 'https://apps.apple.com/app/test/id123456',
      },
      businessType: 'coffee',
      colors: {
        primary: '#5D32B3',
        secondary: '#FF0000',
      },
    };

    test('replaces {{clientCode}} placeholder', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('const client = "{{clientCode}}";');

      const result = templateGen.generateFromTemplate('test.template', mockClientConfig, '/templates');

      expect(result).toBe('const client = "test-client";');
    });

    test('replaces {{appName}} placeholder', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('const name = "{{appName}}";');

      const result = templateGen.generateFromTemplate('test.template', mockClientConfig, '/templates');

      expect(result).toBe('const name = "Test App";');
    });

    test('replaces {{businessType}} placeholder', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('const type = "{{businessType}}";');

      const result = templateGen.generateFromTemplate('test.template', mockClientConfig, '/templates');

      expect(result).toBe('const type = "coffee";');
    });

    test('replaces {{storeUrls.android}} placeholder', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('const url = "{{storeUrls.android}}";');

      const result = templateGen.generateFromTemplate('test.template', mockClientConfig, '/templates');

      expect(result).toBe('const url = "https://play.google.com/store/apps/details?id=com.test";');
    });

    test('replaces {{storeUrls.ios}} placeholder', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('const url = "{{storeUrls.ios}}";');

      const result = templateGen.generateFromTemplate('test.template', mockClientConfig, '/templates');

      expect(result).toBe('const url = "https://apps.apple.com/app/test/id123456";');
    });

    test('replaces {{colors.primary}} with Dart color format', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('const color = Color({{colors.primary}});');

      const result = templateGen.generateFromTemplate('test.template', mockClientConfig, '/templates');

      expect(result).toBe('const color = Color(0xFF5D32B3);');
    });

    test('replaces multiple color placeholders', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        'const primary = Color({{colors.primary}});\n' +
        'const secondary = Color({{colors.secondary}});'
      );

      const result = templateGen.generateFromTemplate('test.template', mockClientConfig, '/templates');

      expect(result).toContain('Color(0xFF5D32B3)');
      expect(result).toContain('Color(0xFFFF0000)');
    });

    test('throws error if template not found', () => {
      fs.existsSync.mockReturnValue(false);

      expect(() =>
        templateGen.generateFromTemplate('missing.template', mockClientConfig, '/templates')
      ).toThrow('Template not found');
    });
  });

  describe('loadClientConfig()', () => {
    test('loads and parses valid JSON config', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        clientName: 'Test Client',
        clientCode: 'test-client',
        bundleId: 'com.test.app',
      }));

      const result = templateGen.loadClientConfig('test-client', '/clients');

      expect(result).toEqual({
        clientName: 'Test Client',
        clientCode: 'test-client',
        bundleId: 'com.test.app',
      });
    });

    test('throws error if config file not found', () => {
      fs.existsSync.mockReturnValue(false);

      expect(() => templateGen.loadClientConfig('missing', '/clients')).toThrow(
        'Config file not found'
      );
    });

    test('throws error if JSON is invalid', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{ invalid json }');

      expect(() => templateGen.loadClientConfig('test', '/clients')).toThrow(
        'Failed to parse config.json'
      );
    });

    test('uses correct path for config file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{}');

      templateGen.loadClientConfig('my-client', '/path/to/clients');

      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/path/to/clients/my-client/config.json',
        'utf8'
      );
    });
  });

  describe('generateDartFiles()', () => {
    const mockClientConfig = {
      clientCode: 'test',
      companyHint: 'Test',
      appName: 'Test',
      storeUrls: { android: 'https://android.test', ios: 'https://ios.test' },
      businessType: 'coffee',
      colors: { primary: '#000000' },
    };

    test('generates user_configs.dart file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{{clientCode}}');
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      templateGen.generateDartFiles(mockClientConfig, '/target', '/templates');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('user_configs.dart'),
        expect.any(String),
        'utf8'
      );
    });

    test('generates theme_constants.dart file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{{clientCode}}');
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      templateGen.generateDartFiles(mockClientConfig, '/target', '/templates');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('theme_constants.dart'),
        expect.any(String),
        'utf8'
      );
    });

    test('creates parent directories if needed', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{{clientCode}}');
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      templateGen.generateDartFiles(mockClientConfig, '/target', '/templates');

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    test('throws error if template processing fails', () => {
      fs.existsSync.mockReturnValue(false);

      expect(() =>
        templateGen.generateDartFiles(mockClientConfig, '/target', '/templates')
      ).toThrow();
    });

    test('logs success message on completion', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('test');
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      templateGen.generateDartFiles(mockClientConfig, '/target', '/templates');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Dart configuration files generated successfully')
      );
    });
  });
});
