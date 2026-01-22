/**
 * Git Commit Message Generators
 *
 * Centralized commit message generation for consistency across all credential commits.
 */

/**
 * Generate commit message for Android keystores
 * @param {string} clientCode - Client code
 * @param {string} clientName - Client display name
 * @returns {string} Formatted commit message
 */
function androidKeystoreCommitMessage(clientCode, clientName) {
  return `Add Android keystores for ${clientName} (${clientCode})

- Generated debug keystore (android-debug-key)
- Generated release keystore (unique password)
- SHA-256 fingerprints for Firebase App Check

Client: ${clientName}
Code: ${clientCode}
Generated: ${new Date().toISOString()}`;
}

/**
 * Generate commit message for iOS profiles
 * @param {string} clientCode - Client code
 * @param {string} clientName - Client display name
 * @returns {string} Formatted commit message
 */
function iosProfilesCommitMessage(clientCode, clientName) {
  return `Add iOS provisioning profiles for ${clientName} (${clientCode})`;
}

/**
 * Generate initial repository commit message
 * @returns {string} Formatted commit message
 */
function initialCommitMessage() {
  return `Initial commit: loyalty-credentials repository structure

Created folder structure:
- shared/ - Shared credentials (Firebase, App Store API)
- shared/ios/certs/ - iOS certificates (via Match)
- profiles/ - iOS provisioning profiles (via Match)
- clients/ - Client-specific credentials

Generated: ${new Date().toISOString()}`;
}

/**
 * Escape commit message for shell execution
 * @param {string} message - Commit message to escape
 * @returns {string} Escaped message
 */
function escapeCommitMessage(message) {
  return message.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

module.exports = {
  androidKeystoreCommitMessage,
  iosProfilesCommitMessage,
  initialCommitMessage,
  escapeCommitMessage,
};
