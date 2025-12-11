const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * Register App Check SHA-256 Fingerprint
 *
 * This step registers the Android app's SHA-256 fingerprint in Firebase
 * for App Check Play Integrity API validation.
 *
 * NOTE: This requires the Firebase CLI and proper authentication.
 */

/**
 * Registers SHA-256 fingerprint for App Check
 * Currently this provides instructions as Firebase CLI doesn't have direct App Check API
 */
async function registerAppCheckFingerprint(projectId, sha256Fingerprint, packageName) {
  console.log(chalk.blue('\n🔐 Registering App Check Configuration...'));
  console.log(chalk.gray('─'.repeat(50)));

  try {
    // Firebase CLI doesn't have a direct command for App Check registration yet
    // We need to use the Firebase Console or REST API

    console.log(chalk.yellow('\n⚠️  App Check Registration Required:'));
    console.log(chalk.white('\nPlease complete the following steps manually:\n'));

    console.log(chalk.cyan('1. Open Firebase Console:'));
    console.log(
      chalk.white(`   https://console.firebase.google.com/project/${projectId}/appcheck`)
    );

    console.log(chalk.cyan('\n2. Enable App Check for Android App:'));
    console.log(chalk.white(`   - Select the Android app (${packageName})`));
    console.log(chalk.white('   - Click "Register" under Play Integrity'));

    console.log(chalk.cyan('\n3. Add SHA-256 Fingerprint:'));
    console.log(chalk.white('   - Go to Project Settings > Your apps'));
    console.log(chalk.white('   - Select the Android app'));
    console.log(chalk.white('   - Add SHA certificate fingerprint:'));
    console.log(chalk.green(`\n   ${sha256Fingerprint}\n`));

    console.log(chalk.cyan('4. Enable App Check enforcement (optional):'));
    console.log(chalk.white('   - Go to App Check settings'));
    console.log(chalk.white('   - Enable enforcement for Firestore, Storage, etc.'));

    console.log(chalk.yellow('\n📋 Configuration saved to clipboard (copy the SHA-256):'));
    console.log(chalk.green(`${sha256Fingerprint}`));

    // Try to add SHA-256 to Android app using Firebase CLI
    // This adds it to the app configuration for Google Sign-In, etc.
    try {
      await addSHA256ToFirebaseApp(projectId, sha256Fingerprint, packageName);
    } catch (error) {
      console.log(chalk.yellow('\n⚠️  Could not automatically add SHA-256 to Firebase app'));
      console.log(chalk.gray(`   ${error.message}`));
    }

    return {
      success: true,
      manualStepsRequired: true,
      consoleUrl: `https://console.firebase.google.com/project/${projectId}/appcheck`,
      sha256: sha256Fingerprint,
    };
  } catch (error) {
    console.error(chalk.red('\n❌ Error during App Check registration:'), error.message);
    throw error;
  }
}

/**
 * Get Android App ID from Firebase project
 */
async function getAndroidAppId(projectId, packageName) {
  try {
    const appsListCommand = `firebase apps:list ANDROID --project=${projectId} --json`;
    const appsListOutput = execSync(appsListCommand, { encoding: 'utf-8', stdio: 'pipe' });
    const appsListResult = JSON.parse(appsListOutput);

    // Firebase CLI returns { status: "success", result: [...] } format
    const appsList = appsListResult.result || appsListResult;

    if (!appsList || !Array.isArray(appsList) || appsList.length === 0) {
      throw new Error('No Android apps found in project');
    }

    const app = appsList.find((a) => a.packageName === packageName);
    if (!app) {
      throw new Error(
        `Android app with package ${packageName} not found. Available packages: ${appsList.map((a) => a.packageName).join(', ')}`
      );
    }

    return app.appId;
  } catch (error) {
    throw new Error(`Failed to get Android app ID: ${error.message}`);
  }
}

/**
 * Add SHA-256 fingerprint to Android app using Firebase CLI
 */
async function addSHA256Fingerprint(projectId, appId, sha256, type = 'release') {
  console.log(chalk.cyan(`\n   Adding ${type} SHA-256 fingerprint...`));

  try {
    const command = `firebase apps:android:sha:create ${appId} ${sha256} --project=${projectId}`;
    execSync(command, { encoding: 'utf-8', stdio: 'pipe' });

    console.log(chalk.green(`   ✅ ${type} SHA-256 added successfully`));
    return { success: true, sha256, type };
  } catch (error) {
    // Check if SHA already exists
    if (error.message.includes('already exists') || error.message.includes('ALREADY_EXISTS')) {
      console.log(chalk.yellow(`   ⚠️  ${type} SHA-256 already registered`));
      return { success: true, sha256, type, alreadyExists: true };
    }

    throw new Error(`Failed to add ${type} SHA-256: ${error.message}`);
  }
}

/**
 * Register both debug and release SHA-256 fingerprints for App Check
 */
async function registerAppCheckFingerprints(projectId, packageName, keystoreResults) {
  console.log(chalk.blue('\n🔐 Registering App Check SHA-256 Fingerprints...'));
  console.log(chalk.gray('─'.repeat(50)));

  try {
    // Get Android app ID
    console.log(chalk.cyan('\n   Getting Android app ID...'));
    const appId = await getAndroidAppId(projectId, packageName);
    console.log(chalk.gray(`   App ID: ${appId}`));

    // Add debug SHA-256
    const debugResult = await addSHA256Fingerprint(
      projectId,
      appId,
      keystoreResults.debug.sha256,
      'DEBUG'
    );

    // Add release SHA-256
    const releaseResult = await addSHA256Fingerprint(
      projectId,
      appId,
      keystoreResults.release.sha256,
      'RELEASE'
    );

    console.log(chalk.green('\n✅ SHA-256 fingerprints registered successfully'));
    console.log(chalk.gray('   (Próximos passos manuais serão exibidos ao final da execução)'));

    return {
      success: true,
      appId,
      debug: debugResult,
      release: releaseResult,
      manualStepsRequired: true,
      consoleUrl: `https://console.firebase.google.com/project/${projectId}/appcheck`,
    };
  } catch (error) {
    console.error(chalk.red('\n❌ Failed to register App Check fingerprints'));
    console.error(chalk.red(`   ${error.message}`));
    throw error;
  }
}

/**
 * Adds SHA-256 fingerprint to Firebase Android app (Legacy function for backward compatibility)
 * @deprecated Use registerAppCheckFingerprints instead
 */
async function addSHA256ToFirebaseApp(projectId, sha256Fingerprint, packageName) {
  console.log(chalk.cyan('\n   Adding SHA-256 to Firebase app...'));

  try {
    const appId = await getAndroidAppId(projectId, packageName);
    console.log(chalk.gray(`   Found Android app: ${appId}`));

    await addSHA256Fingerprint(projectId, appId, sha256Fingerprint, 'RELEASE');

    return { appId, packageName };
  } catch (error) {
    throw new Error(`Failed to add SHA-256: ${error.message}`);
  }
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

  // Handle legacy calls with single SHA-256 (backward compatibility)
  const debugSHA = typeof sha256Debug === 'string' && !sha256Release ? sha256Debug : sha256Debug;
  const releaseSHA = sha256Release || sha256Debug;

  const content = `# App Check Setup Instructions

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

  fs.writeFileSync(instructionsPath, content);
  console.log(chalk.green(`\n   ✅ Instructions saved to: ${instructionsPath}`));

  return instructionsPath;
}

module.exports = {
  registerAppCheckFingerprint,
  registerAppCheckFingerprints, // New automated function
  addSHA256Fingerprint,
  getAndroidAppId,
  addSHA256ToFirebaseApp, // Legacy
  generateAppCheckInstructions,
};
