const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * App Check Instructions Generator
 *
 * Generates markdown instructions for manual App Check setup steps.
 */

/**
 * Build the markdown content for App Check setup instructions
 */
function buildInstructionsContent(clientCode, projectId, debugSHA, releaseSHA, packageName) {
  return `# App Check Setup Instructions

## Client: ${clientCode}
## Firebase Project: ${projectId}

---

## ✅ Automatic Setup Completed

- ✅ Android Keystores generated (debug + release)
- ✅ SHA-256 fingerprints extracted
- ✅ **SHA-256 fingerprints registered in Firebase**
- ✅ Keystores saved to loyalty-credentials repository

**Debug SHA-256:** \`${debugSHA}\`
**Release SHA-256:** \`${releaseSHA}\`

---

## 🔧 Manual Steps Required (2 clicks!)

### 1. Enable App Check for Android

1. Open Firebase Console > App Check:
   **Direct link:** https://console.firebase.google.com/project/${projectId}/appcheck

2. Find your Android app (${packageName})

3. Click **"Register"** under **Play Integrity**

4. Confirm registration ✅

---

### 2. Enable App Check for iOS (if applicable)

1. Open App Check in Firebase Console:
   **Direct link:** https://console.firebase.google.com/project/${projectId}/appcheck

2. Find your iOS app

3. Click **"Register"** under **App Attest**

4. Confirm registration ✅

---

### 3. (Optional) Enable App Check Enforcement

**⚠️ Warning:** Only enable AFTER testing in debug mode!

1. In Firebase Console > App Check, select each service:
   - ☐ Cloud Firestore
   - ☐ Cloud Storage
   - ☐ Realtime Database (if using)
   - ☐ Cloud Functions (if using)

2. Click **"Enforce"** for services you want to protect

---

## 🧪 Testing App Check

### Debug Mode (Development)
App Check uses debug tokens automatically in development:

1. Build app in **debug mode**
2. Check logs for: \`"App Check debug token: ..."\`
3. Verify tokens in: https://console.firebase.google.com/project/${projectId}/appcheck/apps

### Release Mode (Production)
1. Build app with **release keystore**
2. App Check will use Play Integrity (Android) / App Attest (iOS)
3. Monitor metrics: https://console.firebase.google.com/project/${projectId}/appcheck

---

## 📁 Keystore Information

**Location:** \`loyalty-credentials/clients/${clientCode}/android/\`

**Files:**
- \`keystore-debug.jks\` - For development builds
- \`keystore-release.jks\` - For production builds
- \`keystore.properties\` - Configuration file

**⚠️ SECURITY:**
- Never commit keystores to version control
- Keep release keystore password secure
- Backup keystores in secure location

---

## 🐛 Troubleshooting

### SHA-256 Registration Issues?
✅ **Already handled automatically** - SHA-256s were registered during setup

### App Check Not Working?
1. Verify app is built with correct keystore (debug or release)
2. Check Firebase Console > App Check > Metrics for activity
3. Review app logs for App Check errors
4. Ensure Play Integrity is registered (Step 1 above)

### Play Integrity API Errors?
- App must be published to Play Console (internal testing minimum)
- SHA-256 must match signing keystore
- Play Integrity can take hours to activate after first registration
- Verify package name matches Firebase project

### iOS App Attest Issues?
- Apple Team ID must be correct in Firebase
- App must be signed with valid provisioning profile
- App Attest only works on physical devices (not simulator)

---

## 📚 Additional Resources

- [Firebase App Check Documentation](https://firebase.google.com/docs/app-check)
- [Play Integrity API](https://developer.android.com/google/play/integrity)
- [iOS App Attest](https://developer.apple.com/documentation/devicecheck/establishing_your_app_s_integrity)

---

**Generated:** ${new Date().toISOString()}
**Automation:** LoyaltyHub Client Setup v1.0
`;
}

/**
 * Generates instructions file for manual App Check setup
 */
function generateAppCheckInstructions(
  clientCode,
  projectId,
  sha256Debug,
  sha256Release,
  packageName,
  outputDir
) {
  const instructionsPath = path.join(outputDir, `APP_CHECK_SETUP_${clientCode}.md`);

  const debugSHA = typeof sha256Debug === 'string' && !sha256Release ? sha256Debug : sha256Debug;
  const releaseSHA = sha256Release || sha256Debug;

  const content = buildInstructionsContent(clientCode, projectId, debugSHA, releaseSHA, packageName);

  fs.writeFileSync(instructionsPath, content);
  console.log(chalk.green(`\n   ✅ Instructions saved to: ${instructionsPath}`));

  return instructionsPath;
}

module.exports = {
  generateAppCheckInstructions,
  buildInstructionsContent,
};
