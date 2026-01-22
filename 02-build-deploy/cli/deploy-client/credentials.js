/**
 * Credentials validation module for deploy-client
 */

const fs = require('fs');

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

function hasGooglePlayConfigured() {
  const keyPath = process.env.GOOGLE_PLAY_JSON_KEY;
  return keyPath && fs.existsSync(require('path').resolve(keyPath));
}

function hasAppStoreConfigured() {
  return process.env.APP_STORE_CONNECT_API_KEY_ID && process.env.APP_STORE_CONNECT_API_ISSUER_ID;
}

module.exports = {
  checkGooglePlayCredentials,
  checkAppStoreCredentials,
  hasGooglePlayConfigured,
  hasAppStoreConfigured,
};
