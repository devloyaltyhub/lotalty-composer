const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const logger = require("../../../shared/utils/logger");
const { CLIENTS_DIR } = require("../../../shared/utils/paths");
const AndroidCredentialsSetup = require("../../steps/setup-android-credentials");
const {
  generateAppCheckInstructions,
  registerAppCheckFingerprints,
} = require("../../steps/register-app-check");
const GitCredentialsManager = require("../../steps/git-credentials-manager");
const IOSCertificateSetup = require("../../steps/setup-ios-certificates");

async function generateAndroidKeystore(config) {
  logger.section("Generating Android Keystore");

  try {
    const androidSetup = new AndroidCredentialsSetup();
    const result = await androidSetup.setupCredentials(config.clientCode);

    if (!result.success) {
      if (result.skipped) {
        logger.warn(`Android keystore skipped: ${result.reason}`);
        return null;
      }
      throw new Error(result.error || "Failed to setup Android credentials");
    }

    logger.success("Android keystore generated successfully");
    logger.info(`  Debug SHA-256: ${result.debug.sha256}`);
    logger.info(`  Release SHA-256: ${result.release.sha256}`);

    return {
      androidSHA256Debug: result.debug.sha256,
      androidSHA256Release: result.release.sha256,
      keystoreResults: result,
    };
  } catch (error) {
    logger.error("Failed to generate Android keystore:", error.message);
    throw error;
  }
}

async function commitAndroidKeystores(config) {
  const credentialsManager = new GitCredentialsManager();
  await credentialsManager.commitAndroidKeystores(config.clientCode, config.clientName);
}

async function setupIOSCertificates(config) {
  const iosSetup = new IOSCertificateSetup();
  const result = await iosSetup.setupCertificates(config.clientCode, config.bundleId);
  return result;
}

async function generateAppCheckSetup(config) {
  logger.section("Registering App Check");

  try {
    logger.info("Registering SHA-256 fingerprints in Firebase...");
    const registrationResult = await registerAppCheckFingerprints(
      config.firebaseProjectId,
      config.bundleId,
      config.keystoreResults,
    );

    logger.success("SHA-256 fingerprints registered in Firebase");

    const instructionsPath = generateAppCheckInstructions(
      config.clientCode,
      config.firebaseProjectId,
      config.androidSHA256Debug,
      config.androidSHA256Release,
      config.bundleId,
      CLIENTS_DIR,
    );

    logger.success("App Check instructions generated");
    logger.info(`  Arquivo: ${instructionsPath}`);
    logger.info("  Detalhes das acoes manuais serao exibidos ao final da execucao");

    return { instructionsPath, registrationResult };
  } catch (error) {
    logger.error("Failed to setup App Check:", error.message);
    logger.warn("Continuing with manual setup instructions only...");

    try {
      const instructionsPath = generateAppCheckInstructions(
        config.clientCode,
        config.firebaseProjectId,
        config.androidSHA256Debug,
        config.androidSHA256Release,
        config.bundleId,
        CLIENTS_DIR,
      );

      logger.info(`  Manual instructions: ${instructionsPath}`);
      return { instructionsPath, registrationResult: null };
    } catch {
      throw error;
    }
  }
}

async function createShorebirdConfig(config) {
  logger.section("Creating Shorebird Configuration");

  const clientCode = config.clientCode;
  const clientShorebirdPath = path.join(config.clientFolder, "shorebird.yaml");
  const whiteLabelPath = path.resolve(__dirname, "../../../../loyalty-app/white_label_app");
  const whiteLabelShorebirdPath = path.join(whiteLabelPath, "shorebird.yaml");

  let shorebirdInstalled = false;
  try {
    execSync("which shorebird", { stdio: "ignore" });
    shorebirdInstalled = true;
  } catch {
    shorebirdInstalled = false;
  }

  if (!shorebirdInstalled) {
    logger.warn("Shorebird CLI nao instalado - criando placeholder");
    logger.info(
      'Instale com: curl --proto "=https" --tlsv1.2 https://raw.githubusercontent.com/shorebirdtech/install/main/install.sh -sSf | bash',
    );

    const yamlContent = `# Shorebird configuration for ${clientCode}
# Learn more at https://docs.shorebird.dev
# Run 'shorebird init' in white_label_app/ after setup to generate real app_id

app_id: placeholder-${clientCode}
auto_update: true
`;
    fs.writeFileSync(clientShorebirdPath, yamlContent, "utf8");
    logger.warn('Execute "cd white_label_app && shorebird init" apos setup para gerar app_id real');
    return;
  }

  logger.info("Executando shorebird init para gerar app_id real...");

  try {
    execSync("shorebird init --force", {
      cwd: whiteLabelPath,
      stdio: "inherit",
      env: { ...process.env, LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" },
    });

    if (fs.existsSync(whiteLabelShorebirdPath)) {
      fs.copyFileSync(whiteLabelShorebirdPath, clientShorebirdPath);
      logger.success(`shorebird.yaml gerado e copiado para: ${clientShorebirdPath}`);

      const content = fs.readFileSync(clientShorebirdPath, "utf8");
      if (content.includes("placeholder-")) {
        logger.warn("shorebird init gerou placeholder - verifique se esta logado (shorebird login)");
      } else {
        logger.success("Shorebird configurado com app_id real - OTA updates habilitados!");
      }
    } else {
      logger.error("shorebird.yaml nao foi gerado - verifique erros acima");
    }
  } catch (error) {
    logger.error(`Falha ao executar shorebird init: ${error.message}`);
    logger.info("Voce pode executar manualmente: cd white_label_app && shorebird init");

    const yamlContent = `# Shorebird configuration for ${clientCode}
# Learn more at https://docs.shorebird.dev
# shorebird init failed - run manually to generate real app_id

app_id: placeholder-${clientCode}
auto_update: true
`;
    fs.writeFileSync(clientShorebirdPath, yamlContent, "utf8");
  }
}

module.exports = {
  generateAndroidKeystore,
  commitAndroidKeystores,
  setupIOSCertificates,
  generateAppCheckSetup,
  createShorebirdConfig,
};
