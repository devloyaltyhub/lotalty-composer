const chalk = require("chalk");
const logger = require("../../../shared/utils/logger");
const { displayPushNotificationsManualSteps } = require("../../steps/setup-push-notifications");

function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

function displayFinalSummary(config, duration) {
  logger.blank();
  logger.summaryBox({
    Client: `${config.clientName} (${config.clientCode})`,
    "Bundle ID": config.bundleId,
    "Firebase Project": config.firebaseProjectId,
    "Git Commit": config.commitHash,
    "Admin Email": config.adminEmail,
    "Android SHA-256": config.androidSHA256Debug
      ? config.androidSHA256Debug.substring(0, 40) + "..."
      : "N/A",
    "Config File": `clients/${config.folderName}/config.json`,
    "Total Time": duration,
  });

  logger.success("Phase 01: Client Setup completed successfully!");
  logger.blank();
  logger.info("Client configuration saved to main branch");
  logger.info("Firebase project and Firestore configured");
  logger.info("Admin user created and ready");
  logger.blank();
}

function displayManualActionsSection(config) {
  logger.blank();
  logger.blank();
  logger.section("=".repeat(80));
  logger.section("ATENÇÃO: AÇÕES MANUAIS NECESSÁRIAS");
  logger.section("=".repeat(80));
  logger.blank();

  displayAdminCredentials(config);
  displayAppCheckInstructions(config);
  displayPushNotificationsInstructions(config);

  logger.section("=".repeat(80));
  logger.blank();
}

function displayAdminCredentials(config) {
  if (!config.adminCredentials) return;

  logger.subSection("1. CREDENCIAIS DO ADMINISTRADOR (SALVE AGORA!)");
  logger.blank();
  logger.credentialsBox(
    config.clientCode,
    config.adminCredentials.email,
    config.adminCredentials.password,
  );
  logger.info(`Credenciais também salvas em: clients/${config.folderName}/admin-credentials.txt`);
  logger.blank();
  logger.warn("IMPORTANTE: Salve essas credenciais em um local seguro AGORA!");
  logger.blank();
  logger.blank();
}

function displayAppCheckInstructions(config) {
  logger.subSection("2. CONFIGURAÇÃO DO APP CHECK (2 cliques necessários)");
  logger.blank();
  logger.info("Abra o Firebase Console:");
  logger.log(
    `   ${chalk.cyan(`https://console.firebase.google.com/project/${config.firebaseProjectId}/appcheck`)}`,
  );
  logger.blank();
  logger.info("Passos:");
  logger.info("   a) Encontre seu app Android na lista");
  logger.info('   b) Clique em "Register" (Registrar) sob "Play Integrity"');
  logger.info('   c) Clique em "Register" (Registrar) sob "App Attest" para iOS (se aplicável)');
  logger.blank();
  logger.info("SHA-256 fingerprints já foram registrados automaticamente!");
  logger.info(
    `Instruções detalhadas: clients/${config.folderName}/APP_CHECK_SETUP_${config.clientCode}.md`,
  );
  logger.blank();
  logger.blank();
}

function displayPushNotificationsInstructions(config) {
  logger.subSection("3. PUSH NOTIFICATIONS - iOS (APNs)");
  logger.blank();
  displayPushNotificationsManualSteps(
    {
      clientCode: config.clientCode,
      projectId: config.firebaseProjectId,
      pushEnabled: config.featureFlags?.pushNotifications || false,
      apnsKeyInfo: config.apnsKeyInfo,
    },
    logger,
  );
  logger.blank();
  logger.blank();
}

module.exports = {
  formatDuration,
  displayFinalSummary,
  displayManualActionsSection,
  displayAdminCredentials,
  displayAppCheckInstructions,
  displayPushNotificationsInstructions,
};
