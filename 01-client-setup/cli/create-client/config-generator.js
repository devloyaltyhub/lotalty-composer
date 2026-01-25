const fs = require("fs");
const path = require("path");
const logger = require("../../../shared/utils/logger");

function generateColorPalette(primaryColor) {
  const hex = primaryColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const lighten = (value) => Math.min(255, Math.floor(value + (255 - value) * 0.3));
  const primaryLight =
    `#${lighten(r).toString(16).padStart(2, "0")}${lighten(g).toString(16).padStart(2, "0")}${lighten(b).toString(16).padStart(2, "0")}`.toUpperCase();

  return {
    dark: "#000000",
    darkContrast: "#A8A8A8",
    light: "#FFFFFF",
    primary: primaryColor.toUpperCase(),
    primaryLight: primaryLight,
    warning: "#F57C00",
    error: "#EA4C46",
    backgroundPage: "#F5F5F5",
    dividerGrey: "#EAEAEA",
    buttonBorder: "#DEDEDE",
    searchBarBackground: "#FFFFFF1A",
    gradientDark: "#131313",
    gradientContrast: "#303030",
  };
}

function getCompanyHintFromBusinessType(businessType) {
  const hints = {
    coffee: "Cafe",
    beer: "Cervejaria",
    sportfood: "Club",
    restaurant: "Restaurante",
    retail: "Loja",
    gym: "Academia",
  };
  return hints[businessType] || "Club";
}

function generateLocalConfig(config) {
  return {
    clientCode: config.clientCode,
    clientName: config.clientName,
    bundleId: config.bundleId,
    appName: config.appName,
    loversName: config.loversName,
    companyHint: getCompanyHintFromBusinessType(config.businessType),
    businessType: config.businessType,
    planType: config.planType || "profissional",
    firebaseProjectId: config.firebaseProjectId,
    adminEmail: config.adminEmail,
    locale: config.locale || "pt-BR",
    storeUrls: {
      android: "",
      ios: "",
    },
    colors: generateColorPalette(config.primaryColor),
    firebaseOptions: config.firebaseOptions,
    remoteConfig: config.remoteConfig || {
      featureFlags: config.featureFlags || {},
      clarityProjectId: config.clarityProjectId || "",
      versionarte: {
        android: {
          version: { minimum: "1.0.0", latest: "0.0.1" },
          download_url: "",
          status: {
            active: true,
            message: { pt: "O Aplicativo esta em manutencao. Por favor, tente mais tarde." },
          },
        },
        iOS: {
          version: { minimum: "1.0.0", latest: "0.0.1" },
          download_url: "",
          status: {
            active: true,
            message: { pt: "O Aplicativo esta em manutencao. Por favor, tente mais tarde." },
          },
        },
      },
    },
    metadata: {
      websiteUrl: config.websiteUrl || "https://www.loyaltyhub.club",
      supportUrl: config.supportUrl || "https://www.loyaltyhub.club/contact",
      privacyUrl: config.privacyUrl || "https://www.loyaltyhub.club/legal#privacy",
      shortDescription: `Rewards Hub ${config.clientName}`,
      fullDescription: `Aplicativo Rewards Hub ${config.clientName}`,
      keywords: `fidelidade,loyalty,rewards,${config.clientCode}`,
    },
    createdAt: new Date().toISOString(),
    createdBy: "automation",
    version: "1.0.0",
    environment: "development",
  };
}

function saveLocalConfig(config) {
  logger.section("Saving Local Configuration");

  const configData = generateLocalConfig(config);
  const configPath = path.join(config.clientFolder, "config.json");
  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf8");

  logger.success(`Config saved: ${configPath}`);
  return configPath;
}

function createPackageRenameConfig(config) {
  logger.section("Creating package_rename_config.yaml");

  const bundleName = config.bundleId.split(".").slice(1).join("");

  const yamlContent = `package_rename_config:
  android:
    app_name: ${config.appName}
    package_name: ${config.bundleId}

  ios:
    app_name: ${config.appName}
    bundle_name: ${bundleName}
    package_name: ${config.bundleId}
`;

  const yamlPath = path.join(config.clientFolder, "package_rename_config.yaml");
  fs.writeFileSync(yamlPath, yamlContent, "utf8");

  logger.success(`package_rename_config.yaml created: ${yamlPath}`);
  return yamlPath;
}

module.exports = {
  generateColorPalette,
  getCompanyHintFromBusinessType,
  generateLocalConfig,
  saveLocalConfig,
  createPackageRenameConfig,
};
