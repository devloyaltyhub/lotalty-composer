#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const logger = require('../../shared/utils/logger');
const {
  METADATA_LIMITS,
  DEFAULT_CHANGELOG,
  ANDROID_IMAGES_README,
  IOS_SCREENSHOTS_README,
  IOS_REVIEW_INFO,
  DEFAULT_URLS,
} = require('./metadata-templates');

/**
 * Replace template variables in text
 */
function replaceVariables(text, variables) {
  let result = text;
  Object.keys(variables).forEach((key) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, variables[key] || '');
  });
  return result;
}

/**
 * Validate and truncate text with optional warning
 */
function validateAndTruncate(text, maxLength, fieldName, platform) {
  if (text.length > maxLength) {
    logger.warn(`${platform} ${fieldName} too long (${text.length}/${maxLength} chars). Truncating...`);
  }
  return text.substring(0, maxLength);
}

/**
 * Write Android metadata files
 */
async function writeAndroidMetadata(metadataPath, template, variables) {
  const limits = METADATA_LIMITS.android;

  const title = replaceVariables(template.title, variables);
  const shortDescription = replaceVariables(template.short_description, variables);
  const fullDescription = replaceVariables(template.full_description, variables);

  fs.writeFileSync(
    path.join(metadataPath, 'title.txt'),
    validateAndTruncate(title, limits.title, 'title', 'Android')
  );

  fs.writeFileSync(
    path.join(metadataPath, 'short_description.txt'),
    validateAndTruncate(shortDescription, limits.shortDescription, 'short description', 'Android')
  );

  fs.writeFileSync(
    path.join(metadataPath, 'full_description.txt'),
    validateAndTruncate(fullDescription, limits.fullDescription, 'full description', 'Android')
  );

  if (variables.VIDEO_URL) {
    fs.writeFileSync(path.join(metadataPath, 'video.txt'), variables.VIDEO_URL);
  }
}

/**
 * Write Android changelog and images README
 */
async function writeAndroidExtras(metadataPath) {
  await fs.ensureDir(path.join(metadataPath, 'changelogs'));
  fs.writeFileSync(path.join(metadataPath, 'changelogs', 'default.txt'), DEFAULT_CHANGELOG);
  fs.writeFileSync(path.join(metadataPath, 'images', 'README.md'), ANDROID_IMAGES_README);
}

/**
 * Write iOS metadata files
 */
async function writeIosMetadata(metadataPath, template, variables) {
  const limits = METADATA_LIMITS.ios;

  const name = replaceVariables(template.name, variables);
  const subtitle = replaceVariables(template.subtitle, variables);
  const promotionalText = replaceVariables(template.promotional_text, variables);
  const description = replaceVariables(template.description, variables);
  const keywords = replaceVariables(template.keywords, variables);

  fs.writeFileSync(
    path.join(metadataPath, 'name.txt'),
    validateAndTruncate(name, limits.name, 'name', 'iOS')
  );

  fs.writeFileSync(
    path.join(metadataPath, 'subtitle.txt'),
    validateAndTruncate(subtitle, limits.subtitle, 'subtitle', 'iOS')
  );

  fs.writeFileSync(
    path.join(metadataPath, 'promotional_text.txt'),
    validateAndTruncate(promotionalText, limits.promotionalText, 'promotional text', 'iOS')
  );

  fs.writeFileSync(
    path.join(metadataPath, 'description.txt'),
    validateAndTruncate(description, limits.description, 'description', 'iOS')
  );

  fs.writeFileSync(
    path.join(metadataPath, 'keywords.txt'),
    validateAndTruncate(keywords, limits.keywords, 'keywords', 'iOS')
  );
}

/**
 * Write iOS URL files
 */
function writeIosUrls(metadataPath, variables) {
  fs.writeFileSync(
    path.join(metadataPath, 'support_url.txt'),
    variables.SUPPORT_URL || DEFAULT_URLS.support
  );
  fs.writeFileSync(
    path.join(metadataPath, 'marketing_url.txt'),
    variables.MARKETING_URL || DEFAULT_URLS.marketing
  );
  fs.writeFileSync(
    path.join(metadataPath, 'privacy_url.txt'),
    variables.PRIVACY_URL || DEFAULT_URLS.privacy
  );
  fs.writeFileSync(path.join(metadataPath, 'release_notes.txt'), 'Initial release');
}

/**
 * Write iOS review information files
 */
function writeIosReviewInfo(reviewInfoPath) {
  fs.writeFileSync(path.join(reviewInfoPath, 'demo_user.txt'), IOS_REVIEW_INFO.demoUser);
  fs.writeFileSync(path.join(reviewInfoPath, 'demo_password.txt'), IOS_REVIEW_INFO.demoPassword);
  fs.writeFileSync(path.join(reviewInfoPath, 'notes.txt'), IOS_REVIEW_INFO.notes);
  fs.writeFileSync(path.join(reviewInfoPath, 'first_name.txt'), IOS_REVIEW_INFO.firstName);
  fs.writeFileSync(path.join(reviewInfoPath, 'last_name.txt'), IOS_REVIEW_INFO.lastName);
  fs.writeFileSync(path.join(reviewInfoPath, 'phone_number.txt'), IOS_REVIEW_INFO.phoneNumber);
  fs.writeFileSync(path.join(reviewInfoPath, 'email_address.txt'), IOS_REVIEW_INFO.emailAddress);
}

/**
 * Write iOS extras (copyright, screenshots README)
 */
function writeIosExtras(iosBasePath, localePath) {
  const startYear = 2025;
  const currentYear = new Date().getFullYear();
  const copyright = currentYear > startYear ? `${startYear}-${currentYear} LoyaltyHub` : `${startYear} LoyaltyHub`;
  fs.writeFileSync(path.join(iosBasePath, 'copyright.txt'), copyright);
  fs.writeFileSync(path.join(localePath, 'SCREENSHOTS_README.md'), IOS_SCREENSHOTS_README);
}

/**
 * Copy App Store rating config if exists
 */
function copyRatingConfig(sourcePath, destPath) {
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    logger.info('App Store rating config copied');
    return true;
  }
  return false;
}

module.exports = {
  replaceVariables,
  validateAndTruncate,
  writeAndroidMetadata,
  writeAndroidExtras,
  writeIosMetadata,
  writeIosUrls,
  writeIosReviewInfo,
  writeIosExtras,
  copyRatingConfig,
};
