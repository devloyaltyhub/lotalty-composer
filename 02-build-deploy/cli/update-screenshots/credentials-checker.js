/**
 * Credentials Checker
 *
 * Functions to check Google Play and App Store credentials availability.
 */

const fs = require('fs');

/**
 * Check if Google Play credentials are configured
 * @returns {{ configured: boolean, reason?: string, path?: string }}
 */
function checkGooglePlayCredentials() {
  const keyPath = process.env.GOOGLE_PLAY_JSON_KEY;
  if (!keyPath) {
    return { configured: false, reason: 'GOOGLE_PLAY_JSON_KEY nao definido no .env' };
  }
  if (!fs.existsSync(keyPath)) {
    return { configured: false, reason: `Arquivo nao encontrado: ${keyPath}` };
  }
  return { configured: true, path: keyPath };
}

/**
 * Check if App Store credentials are configured
 * @returns {{ configured: boolean, reason?: string }}
 */
function checkAppStoreCredentials() {
  if (!process.env.APP_STORE_CONNECT_API_KEY_ID) {
    return { configured: false, reason: 'APP_STORE_CONNECT_API_KEY_ID nao definido no .env' };
  }
  if (!process.env.APP_STORE_CONNECT_API_ISSUER_ID) {
    return { configured: false, reason: 'APP_STORE_CONNECT_API_ISSUER_ID nao definido no .env' };
  }
  const keyPath = process.env.APP_STORE_CONNECT_API_KEY;
  if (keyPath && !fs.existsSync(keyPath)) {
    return { configured: false, reason: `Arquivo .p8 nao encontrado: ${keyPath}` };
  }
  return { configured: true };
}

module.exports = {
  checkGooglePlayCredentials,
  checkAppStoreCredentials,
};
