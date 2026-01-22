/**
 * Push Notifications Setup - Instruction Templates
 *
 * Markdown templates for push notification setup documentation.
 */

/**
 * Generates APNs section when key was already created
 */
function buildApnsKeyCreatedSection(projectId, apnsKeyInfo) {
  return `
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
`;
}

/**
 * Generates APNs section when key needs to be created manually
 */
function buildApnsKeyManualSection(projectId) {
  return `
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
}

/**
 * Generates the full markdown content for push notifications setup
 */
function buildInstructionsContent(options) {
  const { clientCode, projectId, bundleId, pushEnabled, apnsKeyInfo } = options;

  const apnsStatus = apnsKeyInfo
    ? `✅ Key Created (ID: ${apnsKeyInfo.keyId})`
    : '⚠️ **PENDING** - Need to create and upload to Firebase';

  const apnsKeySection = apnsKeyInfo
    ? buildApnsKeyCreatedSection(projectId, apnsKeyInfo)
    : buildApnsKeyManualSection(projectId);

  const pushDisabledWarning = !pushEnabled
    ? `
> ⚠️ **Push Notifications are DISABLED** for this client.
> To enable, update the Remote Config feature flag in Firebase Console.

`
    : '';

  return `# Push Notifications Setup Instructions

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

${pushDisabledWarning}
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
print('FCM Token: ${'$'}token');
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
}

module.exports = {
  buildApnsKeyCreatedSection,
  buildApnsKeyManualSection,
  buildInstructionsContent,
};
