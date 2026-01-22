const { createCliChecks } = require('./cli-checks');
const { createEnvironmentChecks } = require('./environment-checks');
const { createAccountChecks } = require('./account-checks');
const { createPlatformChecks } = require('./platform-checks');
const { createKeystoreChecks } = require('./keystore-checks');
const { createIosChecks } = require('./ios-checks');
const { createCredentialsRepoChecks } = require('./credentials-repo-checks');
const { createWhiteLabelChecks } = require('./white-label-checks');

module.exports = {
  createCliChecks,
  createEnvironmentChecks,
  createAccountChecks,
  createPlatformChecks,
  createKeystoreChecks,
  createIosChecks,
  createCredentialsRepoChecks,
  createWhiteLabelChecks,
};
