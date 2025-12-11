#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const logger = require('../../shared/utils/logger');

class MetadataGenerator {
  constructor(clientFolder, locale = 'pt-BR') {
    this.clientFolder = clientFolder;
    this.metadataPath = path.join(clientFolder, 'metadata');
    this.templatesPath = path.join(__dirname, '../../shared/templates');
    this.fastlaneMetadataPath = path.join(__dirname, '../../02-build-deploy/fastlane/metadata');
    this.locale = locale;
  }

  /**
   * Replace template variables in text
   */
  replaceVariables(text, variables) {
    let result = text;
    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, variables[key] || '');
    });
    return result;
  }

  /**
   * Generate Android metadata files
   */
  async generateAndroidMetadata(variables) {
    logger.startSpinner('Generating Android metadata files...');

    try {
      // Load template based on locale
      const templatePath = path.join(this.templatesPath, `android-template-${this.locale}.json`);
      const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

      // Create directory structure
      const androidMetadataPath = path.join(this.metadataPath, 'android', this.locale);
      await fs.ensureDir(androidMetadataPath);
      await fs.ensureDir(path.join(androidMetadataPath, 'images', 'phoneScreenshots'));
      await fs.ensureDir(path.join(androidMetadataPath, 'images', 'tenInchScreenshots'));

      // Generate text files
      const title = this.replaceVariables(template.title, variables);
      const shortDescription = this.replaceVariables(template.short_description, variables);
      const fullDescription = this.replaceVariables(template.full_description, variables);

      // Validate lengths
      if (title.length > 30) {
        logger.warn(`Android title too long (${title.length}/30 chars). Truncating...`);
      }
      if (shortDescription.length > 80) {
        logger.warn(
          `Android short description too long (${shortDescription.length}/80 chars). Truncating...`
        );
      }

      // Write metadata files
      fs.writeFileSync(path.join(androidMetadataPath, 'title.txt'), title.substring(0, 30));

      fs.writeFileSync(
        path.join(androidMetadataPath, 'short_description.txt'),
        shortDescription.substring(0, 80)
      );

      fs.writeFileSync(
        path.join(androidMetadataPath, 'full_description.txt'),
        fullDescription.substring(0, 4000)
      );

      if (variables.VIDEO_URL) {
        fs.writeFileSync(path.join(androidMetadataPath, 'video.txt'), variables.VIDEO_URL);
      }

      // Write changelogs directory with default changelog
      await fs.ensureDir(path.join(androidMetadataPath, 'changelogs'));
      fs.writeFileSync(
        path.join(androidMetadataPath, 'changelogs', 'default.txt'),
        'Novidades desta versao:\n- Melhorias de performance e estabilidade\n- Correcoes de bugs'
      );

      // Create README for images
      const imagesReadme = `# Android Images

Place your app store images in this folder:

## Required:
- icon.png (512x512, 32-bit PNG with alpha)
- featureGraphic.png (1024x500, 24-bit PNG or JPEG, no alpha)

## Screenshots (2-8 images):
Place in phoneScreenshots/ folder:
- Min: 320px on shortest side
- Max: 3840px on longest side
- Aspect ratio: 16:9 or 9:16
- Format: 24-bit PNG or JPEG, no alpha

## Tablet Screenshots (optional):
Place in tenInchScreenshots/ folder:
- Same requirements as phone screenshots

## Naming:
- 01.png, 02.png, 03.png, etc.
- Screenshots appear in alphabetical order in Play Store
`;

      fs.writeFileSync(path.join(androidMetadataPath, 'images', 'README.md'), imagesReadme);

      logger.succeedSpinner('Android metadata files created');
      return androidMetadataPath;
    } catch (error) {
      logger.failSpinner('Failed to generate Android metadata');
      throw error;
    }
  }

  /**
   * Generate iOS metadata files
   */
  async generateIosMetadata(variables) {
    logger.startSpinner('Generating iOS metadata files...');

    try {
      // Load template based on locale
      const templatePath = path.join(this.templatesPath, `ios-template-${this.locale}.json`);
      const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

      // Create directory structure
      const iosMetadataPath = path.join(this.metadataPath, 'ios', this.locale);
      await fs.ensureDir(iosMetadataPath);
      // Device folders directly under locale (Fastlane expects: [path]/[locale]/[device]/*.png)
      await fs.ensureDir(path.join(iosMetadataPath, 'APP_IPHONE_65'));
      await fs.ensureDir(path.join(iosMetadataPath, 'APP_IPHONE_55'));
      await fs.ensureDir(path.join(iosMetadataPath, 'APP_IPAD_PRO_129'));

      // Create review_information directory (required for App Store review)
      const reviewInfoPath = path.join(this.metadataPath, 'ios', 'review_information');
      await fs.ensureDir(reviewInfoPath);

      // Generate text files
      const name = this.replaceVariables(template.name, variables);
      const subtitle = this.replaceVariables(template.subtitle, variables);
      const promotionalText = this.replaceVariables(template.promotional_text, variables);
      const description = this.replaceVariables(template.description, variables);
      const keywords = this.replaceVariables(template.keywords, variables);

      // Validate lengths
      if (name.length > 30) {
        logger.warn(`iOS name too long (${name.length}/30 chars). Truncating...`);
      }
      if (subtitle.length > 30) {
        logger.warn(`iOS subtitle too long (${subtitle.length}/30 chars). Truncating...`);
      }
      if (promotionalText.length > 170) {
        logger.warn(
          `iOS promotional text too long (${promotionalText.length}/170 chars). Truncating...`
        );
      }
      if (keywords.length > 100) {
        logger.warn(`iOS keywords too long (${keywords.length}/100 chars). Truncating...`);
      }

      // Write metadata files
      fs.writeFileSync(path.join(iosMetadataPath, 'name.txt'), name.substring(0, 30));

      fs.writeFileSync(path.join(iosMetadataPath, 'subtitle.txt'), subtitle.substring(0, 30));

      fs.writeFileSync(
        path.join(iosMetadataPath, 'promotional_text.txt'),
        promotionalText.substring(0, 170)
      );

      fs.writeFileSync(
        path.join(iosMetadataPath, 'description.txt'),
        description.substring(0, 4000)
      );

      fs.writeFileSync(path.join(iosMetadataPath, 'keywords.txt'), keywords.substring(0, 100));

      // Write URL files (use defaults if not provided - required for App Store)
      fs.writeFileSync(
        path.join(iosMetadataPath, 'support_url.txt'),
        variables.SUPPORT_URL || 'https://loyaltyhub.club/suporte'
      );
      fs.writeFileSync(
        path.join(iosMetadataPath, 'marketing_url.txt'),
        variables.MARKETING_URL || 'https://loyaltyhub.club'
      );
      fs.writeFileSync(
        path.join(iosMetadataPath, 'privacy_url.txt'),
        variables.PRIVACY_URL || 'https://loyaltyhub.club/privacidade'
      );

      // Write release notes
      fs.writeFileSync(path.join(iosMetadataPath, 'release_notes.txt'), 'Initial release');

      // Write review_information files (for App Store review)
      // Demo credentials
      fs.writeFileSync(
        path.join(reviewInfoPath, 'demo_user.txt'),
        'contato@loyaltyhub.club'
      );
      fs.writeFileSync(
        path.join(reviewInfoPath, 'demo_password.txt'),
        '123456'
      );
      fs.writeFileSync(
        path.join(reviewInfoPath, 'notes.txt'),
        'Use as credenciais acima para fazer login no app e testar todas as funcionalidades.\n\nO app é um Club de Rewards que permite aos usuarios acumular pontos em compras e resgatar recompensas.'
      );
      // Contact information for Apple review team
      fs.writeFileSync(
        path.join(reviewInfoPath, 'first_name.txt'),
        'Leonardo'
      );
      fs.writeFileSync(
        path.join(reviewInfoPath, 'last_name.txt'),
        'Marinho'
      );
      fs.writeFileSync(
        path.join(reviewInfoPath, 'phone_number.txt'),
        '+55 11 99999-9999'
      );
      fs.writeFileSync(
        path.join(reviewInfoPath, 'email_address.txt'),
        'contato@loyaltyhub.club'
      );

      // Write copyright (at ios level, not locale-specific)
      const currentYear = new Date().getFullYear();
      fs.writeFileSync(
        path.join(this.metadataPath, 'ios', 'copyright.txt'),
        `${currentYear} LoyaltyHub`
      );

      // Create README for screenshots
      const screenshotsReadme = `# iOS Screenshots

Place your app store screenshots in these folders.
Folder names follow Fastlane deliver naming convention.

## Required Sizes:

### iPhone 6.5" Display (iPhone 11 Pro Max, 12 Pro Max, etc.)
Folder: APP_IPHONE_65/
- Size: 1242x2688 or 1284x2778
- Required: At least 1 screenshot
- Max: 10 screenshots

### iPhone 5.5" Display (iPhone 8 Plus, 7 Plus, etc.)
Folder: APP_IPHONE_55/
- Size: 1242x2208
- Required: At least 1 screenshot
- Max: 10 screenshots

### iPad Pro 12.9" Display (optional)
Folder: APP_IPAD_PRO_129/
- Size: 2048x2732
- Optional
- Max: 10 screenshots

## Format:
- PNG or JPEG
- RGB color space (no alpha channel)

## Naming:
- 01.png, 02.png, 03.png, etc.
- Screenshots appear in numerical order in App Store

## Tips:
- First screenshot is most important (main preview)
- Use high-quality images that showcase key features
- Text should be legible at thumbnail size
`;

      fs.writeFileSync(path.join(iosMetadataPath, 'SCREENSHOTS_README.md'), screenshotsReadme);

      // Copy App Store rating config (for age rating automation)
      const ratingConfigSource = path.join(this.fastlaneMetadataPath, 'app_store_rating_config.json');
      const ratingConfigDest = path.join(this.metadataPath, 'ios', 'app_store_rating_config.json');
      if (fs.existsSync(ratingConfigSource)) {
        fs.copyFileSync(ratingConfigSource, ratingConfigDest);
        logger.info('App Store rating config copied');
      }

      logger.succeedSpinner('iOS metadata files created');
      return iosMetadataPath;
    } catch (error) {
      logger.failSpinner('Failed to generate iOS metadata');
      throw error;
    }
  }

  /**
   * Generate all metadata
   */
  async generateAll(metadataConfig) {
    logger.section('Generating App Store Metadata');

    // Prepare variables for template replacement
    const variables = {
      CLIENT_NAME: metadataConfig.clientName,
      APP_DISPLAY_NAME: metadataConfig.appDisplayName,
      BUSINESS_TYPE: metadataConfig.businessType || 'business',
      ADMIN_EMAIL: metadataConfig.adminEmail,
      SUPPORT_URL: metadataConfig.supportUrl || '',
      MARKETING_URL: metadataConfig.marketingUrl || '',
      WEBSITE_URL: metadataConfig.websiteUrl || '',
      PRIVACY_URL: metadataConfig.privacyUrl || '',
      PRIVACY_POLICY_URL: metadataConfig.privacyUrl || '',
      VIDEO_URL: metadataConfig.videoUrl || '',
    };

    // Generate metadata for both platforms
    const androidPath = await this.generateAndroidMetadata(variables);
    const iosPath = await this.generateIosMetadata(variables);

    logger.blank();
    logger.success('✅ Metadata files generated successfully!');
    logger.blank();
    logger.info('Next steps:');
    logger.info('1. Add your app screenshots to the screenshots folders');
    logger.info('2. Add app icon and feature graphic (Android)');
    logger.info('3. Edit metadata text files if needed');
    logger.info('4. Run deployment to upload metadata to stores');
    logger.blank();
    logger.keyValue('Android metadata', androidPath);
    logger.keyValue('iOS metadata', iosPath);
    logger.blank();

    return {
      android: androidPath,
      ios: iosPath,
    };
  }

  /**
   * Validate that metadata exists for a client
   */
  validateMetadata() {
    const androidPath = path.join(this.metadataPath, 'android', this.locale);
    const iosPath = path.join(this.metadataPath, 'ios', this.locale);

    const androidExists = fs.existsSync(path.join(androidPath, 'title.txt'));
    const iosExists = fs.existsSync(path.join(iosPath, 'name.txt'));

    return {
      android: androidExists,
      ios: iosExists,
      complete: androidExists && iosExists,
    };
  }
}

module.exports = MetadataGenerator;
