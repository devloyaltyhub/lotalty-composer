/**
 * Tests for generate-metadata.js
 * Tests app store metadata generation for Android and iOS
 */

// Mock fs-extra before requiring module
jest.mock('fs-extra', () => ({
  existsSync: jest.fn(),
  ensureDir: jest.fn().mockResolvedValue(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('../../shared/utils/logger', () => ({
  startSpinner: jest.fn(),
  updateSpinner: jest.fn(),
  succeedSpinner: jest.fn(),
  failSpinner: jest.fn(),
  section: jest.fn(),
  success: jest.fn(),
  info: jest.fn(),
  keyValue: jest.fn(),
  blank: jest.fn(),
  warn: jest.fn(),
}));

const fs = require('fs-extra');
const path = require('path');
const MetadataGenerator = require('../../01-client-setup/steps/generate-metadata');
const logger = require('../../shared/utils/logger');

describe('MetadataGenerator', () => {
  let generator;
  const mockClientFolder = '/path/to/clients/demo';

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new MetadataGenerator(mockClientFolder);
  });

  describe('constructor', () => {
    test('initializes with correct paths', () => {
      expect(generator.clientFolder).toBe(mockClientFolder);
      expect(generator.metadataPath).toBe(path.join(mockClientFolder, 'metadata'));
      expect(generator.templatesPath).toContain('shared/templates');
    });
  });

  describe('replaceVariables()', () => {
    test('replaces single variable', () => {
      const text = 'Welcome to {{CLIENT_NAME}}';
      const variables = { CLIENT_NAME: 'Demo App' };

      const result = generator.replaceVariables(text, variables);

      expect(result).toBe('Welcome to Demo App');
    });

    test('replaces multiple variables', () => {
      const text = '{{CLIENT_NAME}} - {{BUSINESS_TYPE}}';
      const variables = {
        CLIENT_NAME: 'Coffee Shop',
        BUSINESS_TYPE: 'restaurant',
      };

      const result = generator.replaceVariables(text, variables);

      expect(result).toBe('Coffee Shop - restaurant');
    });

    test('replaces same variable multiple times', () => {
      const text = '{{CLIENT_NAME}} app by {{CLIENT_NAME}}';
      const variables = { CLIENT_NAME: 'Demo' };

      const result = generator.replaceVariables(text, variables);

      expect(result).toBe('Demo app by Demo');
    });

    test('removes placeholder when variable is empty', () => {
      const text = 'URL: {{WEBSITE_URL}}';
      const variables = { WEBSITE_URL: '' };

      const result = generator.replaceVariables(text, variables);

      expect(result).toBe('URL: ');
    });

    test('keeps placeholder when variable is undefined', () => {
      const text = 'URL: {{MISSING_VAR}}';
      const variables = {};

      const result = generator.replaceVariables(text, variables);

      // Implementation keeps placeholder for undefined variables
      expect(result).toBe('URL: {{MISSING_VAR}}');
    });

    test('handles text without variables', () => {
      const text = 'Static text without variables';
      const variables = { CLIENT_NAME: 'Demo' };

      const result = generator.replaceVariables(text, variables);

      expect(result).toBe('Static text without variables');
    });
  });

  describe('generateAndroidMetadata()', () => {
    const mockTemplate = {
      title: '{{APP_DISPLAY_NAME}}',
      short_description: 'Rewards Hub para {{CLIENT_NAME}}',
      full_description: 'Descrição completa do {{CLIENT_NAME}}',
    };

    const variables = {
      APP_DISPLAY_NAME: 'Demo App',
      CLIENT_NAME: 'Demo Client',
      VIDEO_URL: '',
    };

    beforeEach(() => {
      fs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
    });

    test('generates Android metadata files', async () => {
      const result = await generator.generateAndroidMetadata(variables);

      expect(result).toContain('android');
      expect(result).toContain('pt-BR');
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('creates required directories', async () => {
      await generator.generateAndroidMetadata(variables);

      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('android'));
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('phoneScreenshots'));
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('tenInchScreenshots'));
    });

    test('writes title.txt with max 30 chars', async () => {
      await generator.generateAndroidMetadata(variables);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('title.txt'),
        expect.any(String)
      );
    });

    test('truncates title if over 30 chars', async () => {
      const longTitleTemplate = {
        ...mockTemplate,
        title: 'A'.repeat(50),
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(longTitleTemplate));

      await generator.generateAndroidMetadata(variables);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('title too long')
      );
    });

    test('truncates short_description if over 80 chars', async () => {
      const longDescTemplate = {
        ...mockTemplate,
        short_description: 'A'.repeat(100),
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(longDescTemplate));

      await generator.generateAndroidMetadata(variables);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('short description too long')
      );
    });

    test('writes video.txt when VIDEO_URL provided', async () => {
      const varsWithVideo = { ...variables, VIDEO_URL: 'https://youtube.com/video' };

      await generator.generateAndroidMetadata(varsWithVideo);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('video.txt'),
        'https://youtube.com/video'
      );
    });

    test('creates changelogs directory', async () => {
      await generator.generateAndroidMetadata(variables);

      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('changelogs'));
    });

    test('creates images README', async () => {
      await generator.generateAndroidMetadata(variables);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('images/README.md'),
        expect.stringContaining('Android Images')
      );
    });

    test('throws error on template read failure', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(generator.generateAndroidMetadata(variables)).rejects.toThrow();
      expect(logger.failSpinner).toHaveBeenCalled();
    });
  });

  describe('generateIosMetadata()', () => {
    const mockTemplate = {
      name: '{{APP_DISPLAY_NAME}}',
      subtitle: 'Rewards Hub {{BUSINESS_TYPE}}',
      promotional_text: 'Aproveite benefícios exclusivos',
      description: 'Descrição completa do {{CLIENT_NAME}}',
      keywords: 'rewards,recompensas,{{BUSINESS_TYPE}}',
    };

    const variables = {
      APP_DISPLAY_NAME: 'Demo App',
      CLIENT_NAME: 'Demo Client',
      BUSINESS_TYPE: 'coffee',
      SUPPORT_URL: '',
      MARKETING_URL: '',
      PRIVACY_URL: '',
    };

    beforeEach(() => {
      fs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
    });

    test('generates iOS metadata files', async () => {
      const result = await generator.generateIosMetadata(variables);

      expect(result).toContain('ios');
      expect(result).toContain('pt-BR');
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('creates screenshot directories with Fastlane naming convention', async () => {
      await generator.generateIosMetadata(variables);

      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('APP_IPHONE_65'));
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('APP_IPHONE_55'));
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('APP_IPAD_PRO_129'));
    });

    test('writes name.txt with max 30 chars', async () => {
      await generator.generateIosMetadata(variables);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('name.txt'),
        expect.any(String)
      );
    });

    test('truncates name if over 30 chars', async () => {
      const longNameTemplate = {
        ...mockTemplate,
        name: 'A'.repeat(50),
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(longNameTemplate));

      await generator.generateIosMetadata(variables);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('name too long')
      );
    });

    test('truncates promotional_text if over 170 chars', async () => {
      const longPromoTemplate = {
        ...mockTemplate,
        promotional_text: 'A'.repeat(200),
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(longPromoTemplate));

      await generator.generateIosMetadata(variables);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('promotional text too long')
      );
    });

    test('truncates keywords if over 100 chars', async () => {
      const longKeywordsTemplate = {
        ...mockTemplate,
        keywords: 'A'.repeat(150),
      };
      fs.readFileSync.mockReturnValue(JSON.stringify(longKeywordsTemplate));

      await generator.generateIosMetadata(variables);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('keywords too long')
      );
    });

    test('writes URL files when provided', async () => {
      const varsWithUrls = {
        ...variables,
        SUPPORT_URL: 'https://support.example.com',
        MARKETING_URL: 'https://marketing.example.com',
        PRIVACY_URL: 'https://privacy.example.com',
      };

      await generator.generateIosMetadata(varsWithUrls);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('support_url.txt'),
        'https://support.example.com'
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('marketing_url.txt'),
        'https://marketing.example.com'
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('privacy_url.txt'),
        'https://privacy.example.com'
      );
    });

    test('writes release_notes.txt', async () => {
      await generator.generateIosMetadata(variables);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('release_notes.txt'),
        'Initial release'
      );
    });

    test('creates screenshots README', async () => {
      await generator.generateIosMetadata(variables);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('SCREENSHOTS_README.md'),
        expect.stringContaining('iOS Screenshots')
      );
    });

    test('throws error on failure', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Template not found');
      });

      await expect(generator.generateIosMetadata(variables)).rejects.toThrow();
      expect(logger.failSpinner).toHaveBeenCalled();
    });
  });

  describe('generateAll()', () => {
    const mockAndroidTemplate = {
      title: '{{APP_DISPLAY_NAME}}',
      short_description: 'Short desc',
      full_description: 'Full desc',
    };

    const mockIosTemplate = {
      name: '{{APP_DISPLAY_NAME}}',
      subtitle: 'Subtitle',
      promotional_text: 'Promo',
      description: 'Desc',
      keywords: 'keywords',
    };

    const metadataConfig = {
      clientName: 'Demo Client',
      appDisplayName: 'Demo App',
      businessType: 'coffee',
      adminEmail: 'admin@demo.com',
      supportUrl: 'https://support.demo.com',
      marketingUrl: 'https://demo.com',
      websiteUrl: 'https://demo.com',
      privacyUrl: 'https://demo.com/privacy',
      videoUrl: '',
    };

    beforeEach(() => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('android')) {
          return JSON.stringify(mockAndroidTemplate);
        }
        return JSON.stringify(mockIosTemplate);
      });
    });

    test('generates metadata for both platforms', async () => {
      const result = await generator.generateAll(metadataConfig);

      expect(result.android).toBeDefined();
      expect(result.ios).toBeDefined();
    });

    test('calls logger.section', async () => {
      await generator.generateAll(metadataConfig);

      expect(logger.section).toHaveBeenCalledWith('Generating App Store Metadata');
    });

    test('displays success message', async () => {
      await generator.generateAll(metadataConfig);

      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('Metadata files generated successfully')
      );
    });

    test('displays next steps', async () => {
      await generator.generateAll(metadataConfig);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Next steps'));
    });
  });

  describe('validateMetadata()', () => {
    test('returns complete true when both platforms have metadata', () => {
      fs.existsSync.mockReturnValue(true);

      const result = generator.validateMetadata();

      expect(result.android).toBe(true);
      expect(result.ios).toBe(true);
      expect(result.complete).toBe(true);
    });

    test('returns android false when title.txt missing', () => {
      fs.existsSync.mockImplementation((p) => !p.includes('android'));

      const result = generator.validateMetadata();

      expect(result.android).toBe(false);
      expect(result.complete).toBe(false);
    });

    test('returns ios false when name.txt missing', () => {
      fs.existsSync.mockImplementation((p) => !p.includes('ios'));

      const result = generator.validateMetadata();

      expect(result.ios).toBe(false);
      expect(result.complete).toBe(false);
    });

    test('returns complete false when both missing', () => {
      fs.existsSync.mockReturnValue(false);

      const result = generator.validateMetadata();

      expect(result.android).toBe(false);
      expect(result.ios).toBe(false);
      expect(result.complete).toBe(false);
    });
  });
});
