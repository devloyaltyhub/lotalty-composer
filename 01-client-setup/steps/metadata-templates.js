#!/usr/bin/env node

/**
 * Template strings and constants for metadata generation
 */

const METADATA_LIMITS = {
  android: {
    title: 30,
    shortDescription: 80,
    fullDescription: 4000,
  },
  ios: {
    name: 30,
    subtitle: 30,
    promotionalText: 170,
    keywords: 100,
    description: 4000,
  },
};

const DEFAULT_CHANGELOG = `Novidades desta versao:
- Melhorias de performance e estabilidade
- Correcoes de bugs`;

const ANDROID_IMAGES_README = `# Android Images

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

const IOS_SCREENSHOTS_README = `# iOS Screenshots

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

const IOS_REVIEW_INFO = {
  demoUser: 'contato@loyaltyhub.club',
  demoPassword: '123456',
  notes:
    'Use as credenciais acima para fazer login no app e testar todas as funcionalidades.\n\nO app é um Club de Rewards que permite aos usuarios acumular pontos em compras e resgatar recompensas.',
  firstName: 'Leonardo',
  lastName: 'Marinho',
  phoneNumber: '+55 11 99999-9999',
  emailAddress: 'contato@loyaltyhub.club',
};

const DEFAULT_URLS = {
  support: 'https://loyaltyhub.club/suporte',
  marketing: 'https://loyaltyhub.club',
  privacy: 'https://loyaltyhub.club/privacidade',
};

module.exports = {
  METADATA_LIMITS,
  DEFAULT_CHANGELOG,
  ANDROID_IMAGES_README,
  IOS_SCREENSHOTS_README,
  IOS_REVIEW_INFO,
  DEFAULT_URLS,
};
