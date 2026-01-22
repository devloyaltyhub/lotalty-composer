const logger = require("../../../shared/utils/logger");
const GitBranchManager = require("../../steps/create-git-branch");
const MetadataGenerator = require("../../steps/generate-metadata");

async function commitClientConfig(config) {
  logger.section("Saving Client Configuration to Git");

  const gitManager = new GitBranchManager();
  const result = await gitManager.commitClientToMain(config.folderName);

  logger.success("Client configuration committed to main");
  return result.commitHash;
}

async function generateMetadata(config) {
  const locale = config.locale || "pt-BR";
  const generator = new MetadataGenerator(config.clientFolder, locale);

  await generator.generateAll({
    clientName: config.clientName,
    appDisplayName: config.appName,
    businessType: config.businessType,
    adminEmail: config.adminEmail,
    supportUrl: config.supportUrl || "",
    marketingUrl: config.websiteUrl || "",
    websiteUrl: config.websiteUrl || "",
    privacyUrl: config.privacyUrl || "",
  });

  logger.success("App store metadata generated");
}

module.exports = {
  commitClientConfig,
  generateMetadata,
};
