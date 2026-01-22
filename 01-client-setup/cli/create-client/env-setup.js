const path = require("path");
const { COMPOSE_ROOT } = require("../../../shared/utils/paths");

require("dotenv").config({ path: path.join(COMPOSE_ROOT, ".env") });

function resolveCredentialPath(envVar) {
  let value = process.env[envVar];
  if (!value) return;

  value = value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    return process.env[varName] || match;
  });

  if (!path.isAbsolute(value)) {
    value = path.resolve(COMPOSE_ROOT, value);
  }

  process.env[envVar] = value;
}

function initializeEnvironment() {
  resolveCredentialPath("MASTER_FIREBASE_SERVICE_ACCOUNT");
  resolveCredentialPath("GOOGLE_APPLICATION_CREDENTIALS");
  resolveCredentialPath("GOOGLE_PLAY_JSON_KEY");
  resolveCredentialPath("APP_STORE_CONNECT_API_KEY");
}

module.exports = {
  resolveCredentialPath,
  initializeEnvironment,
};
