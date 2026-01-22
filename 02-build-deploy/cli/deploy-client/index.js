/**
 * Deploy Client modules - barrel export
 */

const ClientDeployer = require('./deployer');
const credentials = require('./credentials');
const androidDeploy = require('./android-deploy');
const iosDeploy = require('./ios-deploy');
const prompts = require('./prompts');
const pipelinePhases = require('./pipeline-phases');
const existingBuildFlows = require('./existing-build-flows');

module.exports = {
  ClientDeployer,
  ...credentials,
  ...androidDeploy,
  ...iosDeploy,
  ...prompts,
  ...pipelinePhases,
  ...existingBuildFlows,
};
