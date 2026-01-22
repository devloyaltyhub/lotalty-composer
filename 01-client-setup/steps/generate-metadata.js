#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const logger = require('../../shared/utils/logger');
const {
  replaceVariables,
  writeAndroidMetadata,
  writeAndroidExtras,
  writeIosMetadata,
  writeIosUrls,
  writeIosReviewInfo,
  writeIosExtras,
  copyRatingConfig,
} = require('./metadata-helpers');

class MetadataGenerator {
  constructor(clientFolder, locale = 'pt-BR') {
    this.clientFolder = clientFolder;
    this.metadataPath = path.join(clientFolder, 'metadata');
    this.templatesPath = path.join(__dirname, '../../shared/templates');
    this.fastlaneMetadataPath = path.join(__dirname, '../../02-build-deploy/fastlane/metadata');
    this.locale = locale;
  }

  replaceVariables(text, variables) {
    return replaceVariables(text, variables);
  }

  async generateAndroidMetadata(variables) {
    logger.startSpinner('Generating Android metadata files...');

    try {
      const templatePath = path.join(this.templatesPath, `android-template-${this.locale}.json`);
      const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

      const androidMetadataPath = path.join(this.metadataPath, 'android', this.locale);
      await fs.ensureDir(androidMetadataPath);
      await fs.ensureDir(path.join(androidMetadataPath, 'images', 'phoneScreenshots'));
      await fs.ensureDir(path.join(androidMetadataPath, 'images', 'tenInchScreenshots'));

      await writeAndroidMetadata(androidMetadataPath, template, variables);
      await writeAndroidExtras(androidMetadataPath);

      logger.succeedSpinner('Android metadata files created');
      return androidMetadataPath;
    } catch (error) {
      logger.failSpinner('Failed to generate Android metadata');
      throw error;
    }
  }

  async generateIosMetadata(variables) {
    logger.startSpinner('Generating iOS metadata files...');

    try {
      const templatePath = path.join(this.templatesPath, `ios-template-${this.locale}.json`);
      const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

      const iosMetadataPath = path.join(this.metadataPath, 'ios', this.locale);
      await fs.ensureDir(iosMetadataPath);
      await fs.ensureDir(path.join(iosMetadataPath, 'APP_IPHONE_65'));
      await fs.ensureDir(path.join(iosMetadataPath, 'APP_IPHONE_55'));
      await fs.ensureDir(path.join(iosMetadataPath, 'APP_IPAD_PRO_129'));

      const reviewInfoPath = path.join(this.metadataPath, 'ios', 'review_information');
      await fs.ensureDir(reviewInfoPath);

      await writeIosMetadata(iosMetadataPath, template, variables);
      writeIosUrls(iosMetadataPath, variables);
      writeIosReviewInfo(reviewInfoPath);
      writeIosExtras(path.join(this.metadataPath, 'ios'), iosMetadataPath);

      const ratingConfigSource = path.join(
        this.fastlaneMetadataPath,
        'app_store_rating_config.json'
      );
      const ratingConfigDest = path.join(this.metadataPath, 'ios', 'app_store_rating_config.json');
      copyRatingConfig(ratingConfigSource, ratingConfigDest);

      logger.succeedSpinner('iOS metadata files created');
      return iosMetadataPath;
    } catch (error) {
      logger.failSpinner('Failed to generate iOS metadata');
      throw error;
    }
  }

  async generateAll(metadataConfig) {
    logger.section('Generating App Store Metadata');

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

    const androidPath = await this.generateAndroidMetadata(variables);
    const iosPath = await this.generateIosMetadata(variables);

    logger.blank();
    logger.success('Metadata files generated successfully!');
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
