const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const APNsKeyCreator = require('./create-apns-key');

/**
 * Push Notifications Setup Helper
 *
 * This module provides utilities for configuring push notifications
 * for both iOS (APNs) and Android (FCM).
 *
 * APNs key CREATION is automated via Apple Developer Portal API (Spaceship).
 * APNs key UPLOAD to Firebase CANNOT be automated - Firebase has no API for this.
 * See: https://github.com/firebase/firebase-admin-node/issues/2204
 */

/**
 * Generates instructions file for Push Notifications setup
 * @param {Object} options Configuration options
 * @param {string} options.clientCode Client identifier
 * @param {string} options.projectId Firebase project ID
 * @param {string} options.bundleId App bundle ID
 * @param {string} options.outputDir Output directory for instructions file
 * @param {boolean} options.pushEnabled Whether push notifications feature flag is enabled
 * @param {Object} options.apnsKeyInfo APNs key info (keyId, teamId, keyFile) if created
 * @returns {string} Path to the generated instructions file
 */
function generatePushNotificationsInstructions(options) {
  const { clientCode, projectId, bundleId, outputDir, pushEnabled, apnsKeyInfo } = options;

  const instructionsPath = path.join(outputDir, clientCode, `PUSH_NOTIFICATIONS_SETUP_${clientCode}.md`);

  // Determine APNs status based on whether key was created
  const apnsStatus = apnsKeyInfo
    ? `✅ Key Created (ID: ${apnsKeyInfo.keyId})`
    : '⚠️ **PENDING** - Need to create and upload to Firebase';

  const apnsKeySection = apnsKeyInfo
    ? `
## ✅ APNs Key Status: CREATED

| Field | Value |
|-------|-------|
| **Key ID** | \`${apnsKeyInfo.keyId}\` |
| **Team ID** | \`${apnsKeyInfo.teamId}\` |
| **Key File** | \`${apnsKeyInfo.keyFile}\` |

> 💡 The APNs key was automatically created. You only need to upload it to Firebase.

---

## 🍎 iOS Setup - UPLOAD TO FIREBASE (Manual)

### Why Manual Upload?
Firebase does **not provide an API** to upload APNs keys programmatically.
This is a known limitation: https://github.com/firebase/firebase-admin-node/issues/2204

### Upload to Firebase

1. Open Firebase Console:
   **https://console.firebase.google.com/project/${projectId}/settings/cloudmessaging**

2. Scroll to **Apple app configuration**

3. Click **Upload** under "APNs Authentication Key"

4. Fill in the details:
   - **APNs Authentication Key**: Select \`${apnsKeyInfo.keyFile}\`
   - **Key ID**: \`${apnsKeyInfo.keyId}\`
   - **Team ID**: \`${apnsKeyInfo.teamId}\`

5. Click **Upload**

6. Verify: You should see a green checkmark ✅
`
    : `
## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| iOS Entitlements | ✅ Configured | \`aps-environment: production\` in Runner.entitlements |
| Android FCM | ✅ Automatic | Configured via google-services.json |
| APNs Key (.p8) | ⚠️ **MANUAL** | Needs to be created and uploaded to Firebase |

---

## 🍎 iOS Setup (APNs) - MANUAL REQUIRED

### Why Manual?
Firebase does **not provide an API** to upload APNs keys programmatically.
This is a known limitation: https://github.com/firebase/firebase-admin-node/issues/2204

### Step 1: Generate APNs Key (One-time per Apple Developer Account)

> 💡 **Good news**: A single .p8 key works for ALL apps in your Apple Developer account!

1. Go to [Apple Developer - Keys](https://developer.apple.com/account/resources/authkeys/list)

2. Click the **"+"** button to create a new key

3. Configure the key:
   - **Key Name**: \`LoyaltyHub Push Key\` (or any descriptive name)
   - **Enable**: ☑️ Apple Push Notifications service (APNs)

4. Click **Continue** → **Register**

5. **IMPORTANT**: Download the key file immediately!
   - File format: \`AuthKey_XXXXXXXX.p8\`
   - You can only download it **ONCE**
   - Save it securely (e.g., \`loyalty-credentials/shared/apns/\`)

6. Note the **Key ID** (visible in the filename and on the key details page)

### Step 2: Get Your Team ID

1. Go to [Apple Developer - Membership](https://developer.apple.com/account/#/membership)
2. Copy the **Team ID** (10-character alphanumeric string)

### Step 3: Upload to Firebase

1. Open Firebase Console:
   **https://console.firebase.google.com/project/${projectId}/settings/cloudmessaging**

2. Scroll to **Apple app configuration**

3. Click **Upload** under "APNs Authentication Key"

4. Fill in the details:
   - **APNs Authentication Key**: Select your \`.p8\` file
   - **Key ID**: The ID from Step 1 (e.g., \`XXXXXXXX\`)
   - **Team ID**: From Step 2 (e.g., \`ABCDE12345\`)

5. Click **Upload**

6. Verify: You should see a green checkmark ✅
`;

  const content = `# Push Notifications Setup Instructions

## Client: ${clientCode}
## Firebase Project: ${projectId}
## Bundle ID: ${bundleId}
## Feature Flag: ${pushEnabled ? '✅ Enabled' : '❌ Disabled'}
## APNs Key: ${apnsStatus}

---

## Overview

Push notifications require configuration for both platforms:
- **iOS**: APNs (Apple Push Notification service) authentication key (.p8)
- **Android**: FCM (Firebase Cloud Messaging) - automatically configured

${!pushEnabled ? `
> ⚠️ **Push Notifications are DISABLED** for this client.
> To enable, update the Remote Config feature flag in Firebase Console.

` : ''}
${apnsKeySection}

---

## 🤖 Android Setup (FCM) - AUTOMATIC

Android push notifications via FCM are **automatically configured** when:
- ✅ Firebase project is created
- ✅ \`google-services.json\` is generated
- ✅ Flutter app includes \`firebase_messaging\` package

**No additional setup required for Android!**

---

## 🧪 Testing Push Notifications

### Using Firebase Console

1. Go to: https://console.firebase.google.com/project/${projectId}/messaging

2. Click **"Create your first campaign"** → **"Firebase Notification messages"**

3. Configure test notification:
   - **Title**: Test Notification
   - **Text**: Hello from ${clientCode}!

4. Select target:
   - **Topic**: \`all\` (or a specific topic)
   - **Or**: Use a specific FCM token from app logs

5. Click **Send test message**

### Using Flutter App

\`\`\`dart
// In your app, you can request the FCM token:
final token = await FirebaseMessaging.instance.getToken();
print('FCM Token: \$token');
\`\`\`

---

## 🔧 Troubleshooting

### iOS: Push notifications not arriving?

1. **Check APNs key is uploaded**
   - Firebase Console → Project Settings → Cloud Messaging
   - Should show green checkmark under APNs Authentication Key

2. **Verify Bundle ID matches**
   - Firebase iOS app bundle ID: \`${bundleId}\`
   - Must match exactly with provisioning profile

3. **Check entitlements**
   - Xcode → Target → Signing & Capabilities
   - Should have "Push Notifications" capability

4. **Physical device required**
   - Push notifications don't work on iOS Simulator!

### Android: Push notifications not arriving?

1. **Check google-services.json is current**
   - Re-download from Firebase Console if needed

2. **Verify package name matches**
   - Firebase Android app package: \`${bundleId}\`

3. **Check notification channel (Android 8+)**
   - App must create notification channels

---

## 📁 File Storage

\`\`\`
loyalty-credentials/
├── shared/
│   └── apns/
│       └── AuthKey_${apnsKeyInfo?.keyId || 'XXXXXXXX'}.p8  # Shared across all clients
└── clients/
    └── ${clientCode}/
        └── android/
            └── keystore-*.jks
\`\`\`

---

## 📚 References

- [Firebase Cloud Messaging Setup (iOS)](https://firebase.google.com/docs/cloud-messaging/ios/client)
- [FlutterFire FCM APNs Integration](https://firebase.flutter.dev/docs/messaging/apple-integration/)
- [Apple Developer - APNs Keys](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/establishing_a_token-based_connection_to_apns)

---

**Generated:** ${new Date().toISOString()}
**Automation:** LoyaltyHub Client Setup v1.0
`;

  // Ensure directory exists
  const dirPath = path.dirname(instructionsPath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(instructionsPath, content);
  console.log(chalk.green(`   ✅ Push Notifications instructions saved to: ${instructionsPath}`));

  return instructionsPath;
}

/**
 * Checks if APNs key file exists in the credentials repository
 * @param {string} credentialsPath Path to loyalty-credentials repository
 * @returns {Object} Result with exists flag and key info if found
 */
function checkAPNsKeyExists(credentialsPath) {
  const apnsDir = path.join(credentialsPath, 'shared', 'apns');

  if (!fs.existsSync(apnsDir)) {
    return { exists: false, reason: 'APNs directory not found' };
  }

  // Look for .p8 files
  const files = fs.readdirSync(apnsDir);
  const p8Files = files.filter((f) => f.endsWith('.p8'));

  if (p8Files.length === 0) {
    return { exists: false, reason: 'No .p8 files found in APNs directory' };
  }

  // Extract Key ID from filename (AuthKey_XXXXXXXX.p8)
  const keyFile = p8Files[0];
  const keyIdMatch = keyFile.match(/AuthKey_([A-Z0-9]+)\.p8/);
  const keyId = keyIdMatch ? keyIdMatch[1] : null;

  return {
    exists: true,
    keyFile: path.join(apnsDir, keyFile),
    keyId,
    allKeys: p8Files,
  };
}

/**
 * Generates console output for push notifications manual steps
 * @param {Object} options Configuration options
 * @param {string} options.clientCode Client identifier
 * @param {string} options.projectId Firebase project ID
 * @param {boolean} options.pushEnabled Whether push notifications are enabled
 * @param {Object} options.apnsKeyInfo APNs key info if available
 * @param {Object} logger Logger instance
 */
function displayPushNotificationsManualSteps(options, logger) {
  const { clientCode, projectId, pushEnabled, apnsKeyInfo } = options;

  if (!pushEnabled) {
    logger.info('   ℹ️  Push Notifications: DESABILITADO (feature flag = false)');
    logger.info('   Para habilitar, atualize o Remote Config no Firebase Console');
    return;
  }

  // If APNs key was created, show simplified upload instructions
  if (apnsKeyInfo) {
    logger.info('✅ APNs Key: CRIADA AUTOMATICAMENTE');
    logger.blank();
    logger.info('📋 Dados para upload no Firebase:');
    logger.info(`   • Key ID: ${chalk.green(apnsKeyInfo.keyId)}`);
    logger.info(`   • Team ID: ${chalk.green(apnsKeyInfo.teamId)}`);
    logger.info(`   • Arquivo: ${chalk.cyan(apnsKeyInfo.keyFile)}`);
    logger.blank();
    logger.info('🔗 Faça upload em:');
    logger.log(
      `   ${chalk.cyan(`https://console.firebase.google.com/project/${projectId}/settings/cloudmessaging`)}`
    );
    logger.blank();
    logger.info('📋 Passos:');
    logger.info('   a) Acesse o link acima');
    logger.info('   b) Role até "Apple app configuration"');
    logger.info('   c) Clique em "Upload" em "APNs Authentication Key"');
    logger.info('   d) Selecione o arquivo .p8 e preencha Key ID e Team ID');
    logger.info('   e) Clique em "Upload"');
  } else {
    // No key created - show full instructions
    logger.info('🔗 Firebase Console - Cloud Messaging:');
    logger.log(
      `   ${chalk.cyan(`https://console.firebase.google.com/project/${projectId}/settings/cloudmessaging`)}`
    );
    logger.blank();
    logger.info('📋 Passos para iOS (APNs):');
    logger.info('   a) Crie uma chave APNs no Apple Developer (se ainda não tiver):');
    logger.log(`      ${chalk.cyan('https://developer.apple.com/account/resources/authkeys/list')}`);
    logger.info('   b) Faça upload da chave .p8 no Firebase Console (link acima)');
    logger.info('   c) Informe o Key ID e Team ID');
  }

  logger.blank();
  logger.info('✅ Android (FCM): Configurado automaticamente!');
  logger.blank();
  logger.info(
    `📄 Instruções detalhadas: clients/${clientCode}/PUSH_NOTIFICATIONS_SETUP_${clientCode}.md`
  );
}

module.exports = {
  generatePushNotificationsInstructions,
  checkAPNsKeyExists,
  displayPushNotificationsManualSteps,
  APNsKeyCreator,
};
