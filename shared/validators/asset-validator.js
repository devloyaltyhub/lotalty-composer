#!/usr/bin/env node

const {
  validateAssets,
  validateGlobalAssets,
  validateBusinessTypeAssets,
  getExistingBusinessTypes,
  copyMissingAssets,
  verifyFileIntegrity,
  ASSET_REQUIREMENTS,
} = require('./asset-validator/index');
const { main } = require('./asset-validator/cli');

module.exports = {
  validateAssets,
  validateGlobalAssets,
  validateBusinessTypeAssets,
  getExistingBusinessTypes,
  copyMissingAssets,
  verifyFileIntegrity,
  ASSET_REQUIREMENTS,
};

if (require.main === module) {
  main();
}
