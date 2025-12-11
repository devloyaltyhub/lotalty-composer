/**
 * Tests for CLI scripts in 01-client-setup/cli/
 * Tests various CLI utilities and commands
 */

// Common mocks for CLI scripts
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  copyFileSync: jest.fn(),
}));

jest.mock('chalk', () => ({
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  red: jest.fn((str) => str),
  cyan: jest.fn((str) => str),
  gray: jest.fn((str) => str),
  white: jest.fn((str) => str),
}));

jest.mock('../../shared/utils/logger', () => ({
  section: jest.fn(),
  subSection: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn(),
  blank: jest.fn(),
  keyValue: jest.fn(),
  startSpinner: jest.fn(),
  succeedSpinner: jest.fn(),
  failSpinner: jest.fn(),
  summaryBox: jest.fn(),
  log: jest.fn(),
  credentialsBox: jest.fn(),
}));

const fs = require('fs');
const path = require('path');

describe('CLI Scripts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolveCredentialPath()', () => {
    // Extracted from create-client.js - env var resolution logic
    const resolveCredentialPath = (envVar) => {
      const automationRoot = '/automation';
      let value = process.env[envVar];
      if (!value) return;

      // Expand environment variables like $HOME, $USER, etc.
      value = value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
        return process.env[varName] || match;
      });

      // Resolve relative paths
      if (!path.isAbsolute(value)) {
        value = path.resolve(automationRoot, value);
      }

      process.env[envVar] = value;
    };

    test('expands $HOME in path', () => {
      process.env.HOME = '/Users/test';
      process.env.TEST_CRED = '$HOME/creds/file.json';

      resolveCredentialPath('TEST_CRED');

      expect(process.env.TEST_CRED).toBe('/Users/test/creds/file.json');

      delete process.env.TEST_CRED;
    });

    test('resolves relative paths', () => {
      process.env.TEST_CRED = './relative/path.json';

      resolveCredentialPath('TEST_CRED');

      expect(path.isAbsolute(process.env.TEST_CRED)).toBe(true);

      delete process.env.TEST_CRED;
    });

    test('keeps absolute paths unchanged', () => {
      process.env.TEST_CRED = '/absolute/path/file.json';

      resolveCredentialPath('TEST_CRED');

      expect(process.env.TEST_CRED).toBe('/absolute/path/file.json');

      delete process.env.TEST_CRED;
    });

    test('handles undefined env var', () => {
      delete process.env.UNDEFINED_VAR;

      resolveCredentialPath('UNDEFINED_VAR');

      expect(process.env.UNDEFINED_VAR).toBeUndefined();
    });
  });

  describe('generateColorPalette()', () => {
    // Extracted from create-client.js
    const generateColorPalette = (primaryColor) => {
      const hex = primaryColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      const lighten = (value) => Math.min(255, Math.floor(value + (255 - value) * 0.3));
      const primaryLight =
        `#${lighten(r).toString(16).padStart(2, '0')}${lighten(g).toString(16).padStart(2, '0')}${lighten(b).toString(16).padStart(2, '0')}`.toUpperCase();

      return {
        primary: primaryColor.toUpperCase(),
        primaryLight: primaryLight,
        dark: '#000000',
        light: '#FFFFFF',
      };
    };

    test('generates color palette from primary color', () => {
      const palette = generateColorPalette('#FF5733');

      expect(palette.primary).toBe('#FF5733');
      expect(palette.dark).toBe('#000000');
      expect(palette.light).toBe('#FFFFFF');
    });

    test('generates lighter version of primary', () => {
      const palette = generateColorPalette('#000000');

      expect(palette.primaryLight).not.toBe('#000000');
    });

    test('handles uppercase hex', () => {
      const palette = generateColorPalette('#AABBCC');

      expect(palette.primary).toBe('#AABBCC');
    });

    test('handles lowercase hex', () => {
      const palette = generateColorPalette('#aabbcc');

      expect(palette.primary).toBe('#AABBCC');
    });
  });

  describe('getCompanyHintFromBusinessType()', () => {
    // Extracted from create-client.js
    const getCompanyHintFromBusinessType = (businessType) => {
      const hints = {
        coffee: 'Café',
        beer: 'Cervejaria',
        sportfood: 'Club',
        restaurant: 'Restaurante',
        retail: 'Loja',
        gym: 'Academia',
      };
      return hints[businessType] || 'Club';
    };

    test('returns correct hint for coffee', () => {
      expect(getCompanyHintFromBusinessType('coffee')).toBe('Café');
    });

    test('returns correct hint for beer', () => {
      expect(getCompanyHintFromBusinessType('beer')).toBe('Cervejaria');
    });

    test('returns correct hint for restaurant', () => {
      expect(getCompanyHintFromBusinessType('restaurant')).toBe('Restaurante');
    });

    test('returns default Club for unknown type', () => {
      expect(getCompanyHintFromBusinessType('unknown')).toBe('Club');
    });
  });

  describe('formatDuration()', () => {
    // Extracted from create-client.js
    const formatDuration = (milliseconds) => {
      const seconds = Math.floor(milliseconds / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;

      if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
      }
      return `${seconds}s`;
    };

    test('formats seconds only', () => {
      expect(formatDuration(30000)).toBe('30s');
    });

    test('formats minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
    });

    test('formats multiple minutes', () => {
      expect(formatDuration(180000)).toBe('3m 0s');
    });

    test('handles zero', () => {
      expect(formatDuration(0)).toBe('0s');
    });
  });

  describe('Config file operations', () => {
    test('reads config.json', () => {
      const mockConfig = {
        clientCode: 'demo',
        clientName: 'Demo Client',
        bundleId: 'com.example.demo',
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const content = fs.readFileSync('/clients/demo/config.json', 'utf8');
      const config = JSON.parse(content);

      expect(config.clientCode).toBe('demo');
    });

    test('writes config.json', () => {
      const config = {
        clientCode: 'demo',
        clientName: 'Demo Client',
      };

      fs.writeFileSync('/clients/demo/config.json', JSON.stringify(config, null, 2));

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('creates directory if not exists', () => {
      fs.existsSync.mockReturnValue(false);

      fs.mkdirSync('/clients/new-client', { recursive: true });

      expect(fs.mkdirSync).toHaveBeenCalledWith('/clients/new-client', { recursive: true });
    });
  });

  describe('Feature flags conversion', () => {
    // Logic from create-client.js
    const convertFeatureFlags = (featureFlagsArray) => ({
      delivery: featureFlagsArray.includes('delivery'),
      club: featureFlagsArray.includes('club'),
      happyHour: featureFlagsArray.includes('happyHour'),
      campaigns: featureFlagsArray.includes('campaigns'),
      storeHours: featureFlagsArray.includes('storeHours'),
      pushNotifications: featureFlagsArray.includes('pushNotifications'),
      suggestionBox: featureFlagsArray.includes('suggestionBox'),
      clarity: featureFlagsArray.includes('clarity'),
      ourStory: featureFlagsArray.includes('ourStory'),
    });

    test('converts array to object with all flags', () => {
      const flags = convertFeatureFlags(['delivery', 'club']);

      expect(flags.delivery).toBe(true);
      expect(flags.club).toBe(true);
      expect(flags.happyHour).toBe(false);
    });

    test('handles empty array', () => {
      const flags = convertFeatureFlags([]);

      expect(flags.delivery).toBe(false);
      expect(flags.club).toBe(false);
    });

    test('handles all flags enabled', () => {
      const allFlags = [
        'delivery',
        'club',
        'happyHour',
        'campaigns',
        'storeHours',
        'pushNotifications',
        'suggestionBox',
        'clarity',
        'ourStory',
      ];
      const flags = convertFeatureFlags(allFlags);

      expect(Object.values(flags).every((v) => v === true)).toBe(true);
    });
  });

  describe('Firebase Project ID generation', () => {
    // Logic from create-client.js
    const generateFirebaseProjectId = (clientCode) => {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      return `${clientCode}-lhc-${randomSuffix}`;
    };

    test('generates project ID with correct format', () => {
      const projectId = generateFirebaseProjectId('demo');

      expect(projectId).toMatch(/^demo-lhc-\d{4}$/);
    });

    test('generates 4-digit random suffix', () => {
      const projectId = generateFirebaseProjectId('test');
      const suffix = projectId.split('-').pop();

      expect(suffix.length).toBe(4);
      expect(parseInt(suffix)).toBeGreaterThanOrEqual(1000);
      expect(parseInt(suffix)).toBeLessThan(10000);
    });

    test('project ID length is within GCP limit', () => {
      const projectId = generateFirebaseProjectId('short-name');

      expect(projectId.length).toBeLessThanOrEqual(30);
    });
  });

  describe('Bundle name extraction', () => {
    // Logic from create-client.js - createPackageRenameConfig
    const extractBundleName = (bundleId) => {
      return bundleId
        .split('.')
        .slice(1)
        .join('');
    };

    test('extracts bundle name from bundle ID', () => {
      const bundleName = extractBundleName('club.loyaltyhub.demo');

      expect(bundleName).toBe('loyaltyhubdemo');
    });

    test('handles multiple segments', () => {
      const bundleName = extractBundleName('com.example.my.app');

      expect(bundleName).toBe('examplemyapp');
    });

    test('handles two segments', () => {
      const bundleName = extractBundleName('com.example');

      expect(bundleName).toBe('example');
    });
  });
});
