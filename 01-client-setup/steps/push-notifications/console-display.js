/**
 * Push Notifications Setup - Console Display
 *
 * Functions for displaying push notification setup information in the console.
 */

const chalk = require('chalk');

/**
 * Displays APNs key created instructions in console
 */
function displayApnsKeyCreatedInstructions(projectId, apnsKeyInfo, logger) {
  logger.info('✅ APNs Key: CRIADA AUTOMATICAMENTE');
  logger.blank();
  logger.info('📋 Dados para upload no Firebase:');
  logger.info(`   • Key ID: ${chalk.green(apnsKeyInfo.keyId)}`);
  logger.info(`   • Team ID: ${chalk.green(apnsKeyInfo.teamId)}`);
  logger.info(`   • Arquivo: ${chalk.cyan(apnsKeyInfo.keyFile)}`);
  logger.blank();
  logger.info('🔗 Faça upload em:');
  logger.log(
    `   ${chalk.cyan(`https://console.firebase.google.com/project/${projectId}/settings/cloudmessaging`)}`
  );
  logger.blank();
  logger.info('📋 Passos:');
  logger.info('   a) Acesse o link acima');
  logger.info('   b) Role até "Apple app configuration"');
  logger.info('   c) Clique em "Upload" em "APNs Authentication Key"');
  logger.info('   d) Selecione o arquivo .p8 e preencha Key ID e Team ID');
  logger.info('   e) Clique em "Upload"');
}

/**
 * Displays manual APNs key creation instructions in console
 */
function displayManualApnsInstructions(projectId, logger) {
  logger.info('🔗 Firebase Console - Cloud Messaging:');
  logger.log(
    `   ${chalk.cyan(`https://console.firebase.google.com/project/${projectId}/settings/cloudmessaging`)}`
  );
  logger.blank();
  logger.info('📋 Passos para iOS (APNs):');
  logger.info('   a) Crie uma chave APNs no Apple Developer (se ainda não tiver):');
  logger.log(`      ${chalk.cyan('https://developer.apple.com/account/resources/authkeys/list')}`);
  logger.info('   b) Faça upload da chave .p8 no Firebase Console (link acima)');
  logger.info('   c) Informe o Key ID e Team ID');
}

/**
 * Generates console output for push notifications manual steps
 * @param {Object} options Configuration options
 * @param {string} options.clientCode Client identifier
 * @param {string} options.projectId Firebase project ID
 * @param {boolean} options.pushEnabled Whether push notifications are enabled
 * @param {Object} options.apnsKeyInfo APNs key info if available
 * @param {Object} logger Logger instance
 */
function displayPushNotificationsManualSteps(options, logger) {
  const { clientCode, projectId, pushEnabled, apnsKeyInfo } = options;

  if (!pushEnabled) {
    logger.info('   ℹ️  Push Notifications: DESABILITADO (feature flag = false)');
    logger.info('   Para habilitar, atualize o Remote Config no Firebase Console');
    return;
  }

  if (apnsKeyInfo) {
    displayApnsKeyCreatedInstructions(projectId, apnsKeyInfo, logger);
  } else {
    displayManualApnsInstructions(projectId, logger);
  }

  logger.blank();
  logger.info('✅ Android (FCM): Configurado automaticamente!');
  logger.blank();
  logger.info(
    `📄 Instruções detalhadas: clients/${clientCode}/PUSH_NOTIFICATIONS_SETUP_${clientCode}.md`
  );
}

module.exports = {
  displayApnsKeyCreatedInstructions,
  displayManualApnsInstructions,
  displayPushNotificationsManualSteps,
};
