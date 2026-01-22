const fs = require("fs");
const path = require("path");
const logger = require("../../../shared/utils/logger");

function copyBusinessTypeAssets(config) {
  logger.section("Copying Business Type Assets");

  const assetsDir = path.join(config.clientFolder, "assets");
  const clientSpecificDir = path.join(assetsDir, "client_specific_assets");

  if (!fs.existsSync(clientSpecificDir)) {
    fs.mkdirSync(clientSpecificDir, { recursive: true });
    logger.info(`Created directory: ${clientSpecificDir}`);
  }

  const sharedAssetsDir = path.join(__dirname, "../../../shared/shared_assets");
  const businessTypeImagesDir = path.join(sharedAssetsDir, "images", config.businessType);

  let copiedFromBusinessType = false;

  if (fs.existsSync(businessTypeImagesDir)) {
    const logoFile = path.join(businessTypeImagesDir, "logo.png");
    const transparentLogoFile = path.join(businessTypeImagesDir, "transparent-logo.png");

    if (fs.existsSync(logoFile)) {
      fs.copyFileSync(logoFile, path.join(clientSpecificDir, "logo.png"));
      logger.info("Copied logo.png from business type");
      copiedFromBusinessType = true;
    }

    if (fs.existsSync(transparentLogoFile)) {
      fs.copyFileSync(transparentLogoFile, path.join(clientSpecificDir, "transparent-logo.png"));
      logger.info("Copied transparent-logo.png from business type");
      copiedFromBusinessType = true;
    }
  }

  if (!copiedFromBusinessType) {
    logger.warn(`Business type ${config.businessType} doesn't have logo templates`);
    logger.info("Copying placeholders from demo client...");

    const demoAssetsDir = path.join(process.cwd(), "clients", "demo", "assets", "client_specific_assets");

    if (fs.existsSync(demoAssetsDir)) {
      const demoLogo = path.join(demoAssetsDir, "logo.png");
      const demoTransparentLogo = path.join(demoAssetsDir, "transparent-logo.png");

      if (fs.existsSync(demoLogo)) {
        fs.copyFileSync(demoLogo, path.join(clientSpecificDir, "logo.png"));
        logger.info("Copied placeholder logo.png from demo");
      }

      if (fs.existsSync(demoTransparentLogo)) {
        fs.copyFileSync(demoTransparentLogo, path.join(clientSpecificDir, "transparent-logo.png"));
        logger.info("Copied placeholder transparent-logo.png from demo");
      }
    } else {
      logger.error("Demo assets not found - please add logos manually");
      const placeholderPath = path.join(clientSpecificDir, "PLEASE_ADD_LOGOS_HERE.txt");
      fs.writeFileSync(
        placeholderPath,
        "Please add logo.png and transparent-logo.png to this directory.\n\nRequired files:\n- logo.png (app icon and branding)\n- transparent-logo.png (transparent background version)",
        "utf8",
      );
      logger.warn("Created placeholder reminder file");
    }
  }

  logger.success("Business type assets copied");
}

module.exports = {
  copyBusinessTypeAssets,
};
