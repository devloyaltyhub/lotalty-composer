const path = require('path');
const { COMPOSE_ROOT } = require('../../shared/utils/paths');

const automationRoot = COMPOSE_ROOT;

function resolveCredentialPath(envVar) {
  let value = process.env[envVar];
  if (!value) {
    return;
  }

  value = value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    return process.env[varName] || match;
  });

  if (!path.isAbsolute(value)) {
    value = path.resolve(automationRoot, value);
  }

  process.env[envVar] = value;
}

function resolveAllCredentials() {
  resolveCredentialPath('GOOGLE_PLAY_JSON_KEY');
  resolveCredentialPath('APP_STORE_CONNECT_API_KEY');
  resolveCredentialPath('MASTER_FIREBASE_SERVICE_ACCOUNT');
  resolveCredentialPath('GOOGLE_APPLICATION_CREDENTIALS');
}

module.exports = {
  resolveCredentialPath,
  resolveAllCredentials,
};
