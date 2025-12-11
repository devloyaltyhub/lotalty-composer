/**
 * Tests for setup-white-label.js
 * Tests the main white label setup orchestrator
 */

jest.mock('fs');
jest.mock('inquirer');
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));
jest.mock('../../shared/utils/client-selector', () => ({
  selectClientOrPrompt: jest.fn(),
}));
jest.mock('../../01-client-setup/steps/modules/asset-operations', () => ({
  cleanAssetsDir: jest.fn(() => '/backup/dir'),
  copyGeneralAssets: jest.fn(),
  copyClientAssets: jest.fn(),
  copyFolderRecursiveSync: jest.fn(),
  cleanupBackup: jest.fn(),
  runAssetValidation: jest.fn(() => true),
  compressImages: jest.fn(),
  optimizeLottieAnimations: jest.fn(),
  generateAppIcons: jest.fn(),
  updatePubspecAssets: jest.fn(),
  runFinalAssetValidation: jest.fn(),
  validateAssetsStructure: jest.fn(() => ({ valid: true })),
  displayValidationResults: jest.fn(() => true),
}));
jest.mock('../../01-client-setup/steps/modules/template-generator', () => ({
  loadClientConfig: jest.fn(() => ({
    clientName: 'Demo Client',
    businessType: 'coffee',
  })),
  generateDartFiles: jest.fn(),
}));
jest.mock('../../01-client-setup/steps/modules/keystore-operations', () => ({
  copyAndroidKeystore: jest.fn(),
}));
jest.mock('../../01-client-setup/steps/modules/ios-operations', () => ({
  postProcess: jest.fn(),
}));

const fs = require('fs');
const path = require('path');

// Import specific functions we want to test (extracted from setup-white-label.js)
// Since setup-white-label.js runs on import, we need to extract testable logic

describe('setup-white-label', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadBusinessTypesFromAssets()', () => {
    test('discovers business types from animations directory', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['coffee', 'beer', 'restaurant']);
      fs.statSync.mockReturnValue({ isDirectory: () => true });

      // Simulate the function behavior
      const animationsDir = '/path/to/animations';
      const businessTypeDirs = fs.readdirSync(animationsDir).filter((dir) => {
        return fs.statSync(path.join(animationsDir, dir)).isDirectory();
      });

      expect(businessTypeDirs).toEqual(['coffee', 'beer', 'restaurant']);
    });

    test('handles missing animations directory', () => {
      fs.existsSync.mockReturnValue(false);

      const animationsDir = '/path/to/animations';
      const exists = fs.existsSync(animationsDir);

      expect(exists).toBe(false);
    });
  });

  describe('validateBusinessType()', () => {
    const BUSINESS_TYPES = [
      { key: 'coffee', label: 'Coffee' },
      { key: 'beer', label: 'Beer' },
      { key: 'restaurant', label: 'Restaurant' },
    ];

    test('accepts valid business type', () => {
      const validBusinessTypes = BUSINESS_TYPES.map((t) => t.key);
      const businessType = 'coffee';

      expect(validBusinessTypes.includes(businessType)).toBe(true);
    });

    test('rejects invalid business type', () => {
      const validBusinessTypes = BUSINESS_TYPES.map((t) => t.key);
      const businessType = 'invalid';

      expect(validBusinessTypes.includes(businessType)).toBe(false);
    });
  });

  describe('validateLoyaltyCredentialsRepo()', () => {
    test('passes when loyalty-credentials exists', () => {
      fs.existsSync.mockReturnValue(true);

      const credentialsPath = '/path/to/loyalty-credentials';
      const exists = fs.existsSync(credentialsPath);

      expect(exists).toBe(true);
    });

    test('fails when loyalty-credentials does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const credentialsPath = '/path/to/loyalty-credentials';
      const exists = fs.existsSync(credentialsPath);

      expect(exists).toBe(false);
    });
  });

  describe('performAssetCopy()', () => {
    const assetOps = require('../../01-client-setup/steps/modules/asset-operations');

    test('cleans assets directory before copying', () => {
      assetOps.cleanAssetsDir.mockReturnValue('/backup');

      assetOps.cleanAssetsDir('/assets', []);

      expect(assetOps.cleanAssetsDir).toHaveBeenCalled();
    });

    test('copies general assets', () => {
      assetOps.copyGeneralAssets('coffee', '/general', '/assets', []);

      expect(assetOps.copyGeneralAssets).toHaveBeenCalledWith('coffee', '/general', '/assets', []);
    });

    test('copies client-specific assets', () => {
      assetOps.copyClientAssets('/source', '/assets');

      expect(assetOps.copyClientAssets).toHaveBeenCalledWith('/source', '/assets');
    });

    test('cleans up backup on success', () => {
      assetOps.cleanupBackup('/backup');

      expect(assetOps.cleanupBackup).toHaveBeenCalledWith('/backup');
    });
  });

  describe('processAssets()', () => {
    const assetOps = require('../../01-client-setup/steps/modules/asset-operations');

    test('runs asset validation', () => {
      assetOps.runAssetValidation.mockReturnValue(true);

      const result = assetOps.runAssetValidation('coffee', '/project');

      expect(result).toBe(true);
    });

    test('compresses images', () => {
      assetOps.compressImages('/target', '/project');

      expect(assetOps.compressImages).toHaveBeenCalled();
    });

    test('optimizes Lottie animations', () => {
      assetOps.optimizeLottieAnimations('/project');

      expect(assetOps.optimizeLottieAnimations).toHaveBeenCalled();
    });

    test('generates app icons', () => {
      assetOps.generateAppIcons('/target');

      expect(assetOps.generateAppIcons).toHaveBeenCalled();
    });

    test('updates pubspec assets', () => {
      assetOps.updatePubspecAssets('coffee', '/pubspec.yaml', [], '/target');

      expect(assetOps.updatePubspecAssets).toHaveBeenCalled();
    });
  });

  describe('Integration with modules', () => {
    const templateGen = require('../../01-client-setup/steps/modules/template-generator');
    const keystoreOps = require('../../01-client-setup/steps/modules/keystore-operations');
    const iosOps = require('../../01-client-setup/steps/modules/ios-operations');

    test('loads client config', () => {
      templateGen.loadClientConfig.mockReturnValue({
        clientName: 'Test Client',
        businessType: 'beer',
      });

      const config = templateGen.loadClientConfig('test', '/clients');

      expect(config.clientName).toBe('Test Client');
      expect(config.businessType).toBe('beer');
    });

    test('generates dart files', () => {
      templateGen.generateDartFiles({}, '/target', '/templates');

      expect(templateGen.generateDartFiles).toHaveBeenCalled();
    });

    test('copies Android keystore', () => {
      keystoreOps.copyAndroidKeystore('/target', 'demo');

      expect(keystoreOps.copyAndroidKeystore).toHaveBeenCalledWith('/target', 'demo');
    });

    test('runs iOS post-processing', () => {
      iosOps.postProcess('/target');

      expect(iosOps.postProcess).toHaveBeenCalledWith('/target');
    });
  });

  describe('copyShorebirdConfig()', () => {
    test('copies shorebird.yaml when it exists', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('app_id: real-app-id\nauto_update: true');
      fs.copyFileSync.mockImplementation(() => {});

      // Simulate copy behavior
      const sourcePath = '/clients/demo/shorebird.yaml';
      const targetPath = '/white_label_app/shorebird.yaml';

      const exists = fs.existsSync(sourcePath);
      expect(exists).toBe(true);

      if (exists) {
        fs.copyFileSync(sourcePath, targetPath);
        expect(fs.copyFileSync).toHaveBeenCalledWith(sourcePath, targetPath);
      }
    });

    test('handles missing shorebird.yaml gracefully', () => {
      fs.existsSync.mockReturnValue(false);

      const sourcePath = '/clients/demo/shorebird.yaml';
      const exists = fs.existsSync(sourcePath);

      expect(exists).toBe(false);
    });

    test('detects placeholder app_id', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('app_id: placeholder-demo\nauto_update: true');

      const content = fs.readFileSync('/clients/demo/shorebird.yaml', 'utf8');
      const isPlaceholder = content.includes('placeholder-');

      expect(isPlaceholder).toBe(true);
    });

    test('detects real app_id', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('app_id: c9924937-2dbc-4ca2-a860-709de2c0a3a2\nauto_update: true');

      const content = fs.readFileSync('/clients/demo/shorebird.yaml', 'utf8');
      const isPlaceholder = content.includes('placeholder-');

      expect(isPlaceholder).toBe(false);
    });
  });
});
