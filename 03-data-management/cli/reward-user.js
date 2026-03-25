#!/usr/bin/env node

/**
 * CLI para premiar usuários com ClubCoins por contribuições
 * Credita ClubCoins + envia push notification personalizada
 *
 * Uso: npm run reward-user [client-name]
 */

const path = require('path');
const inquirer = require('inquirer');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const logger = require('../../shared/utils/logger');
const clientSelector = require('../../shared/utils/client-selector');
const firebaseClient = require('../../01-client-setup/shared/firebase-manager');
const { searchUser } = require('../shared/user-search');
const admin = require('firebase-admin');

const REWARD_REASONS = [
  { name: 'Bug report válido', value: 'bug_report', default: 200, emoji: '🐛' },
  { name: 'Sugestão aceita', value: 'suggestion', default: 150, emoji: '💡' },
  { name: 'Feedback útil', value: 'feedback', default: 100, emoji: '📝' },
  { name: 'Teste beta', value: 'beta_test', default: 250, emoji: '🧪' },
  { name: 'Outro (personalizado)', value: 'custom', default: 100, emoji: '🎁' },
];

const PUSH_MESSAGES = {
  bug_report: {
    title: 'Obrigado por reportar! 🐛',
    body: (amount) =>
      `Você reportou um bug válido e ganhou ${amount} ClubCoins de presente! Valorizamos muito sua ajuda.`,
  },
  suggestion: {
    title: 'Sua sugestão foi aceita! 💡',
    body: (amount) =>
      `Sua sugestão foi implementada e você ganhou ${amount} ClubCoins! Obrigado por ajudar a melhorar o app.`,
  },
  feedback: {
    title: 'Obrigado pelo feedback! 📝',
    body: (amount) =>
      `Seu feedback foi muito útil e você ganhou ${amount} ClubCoins! Continue nos ajudando.`,
  },
  beta_test: {
    title: 'Obrigado por testar! 🧪',
    body: (amount) =>
      `Sua participação no teste beta rendeu ${amount} ClubCoins! Testadores como você fazem a diferença.`,
  },
  custom: {
    title: 'Presente especial! 🎁',
    body: (amount) =>
      `Você ganhou ${amount} ClubCoins! Obrigado pela sua contribuição.`,
  },
};

const CLOUD_API_URL =
  'https://loyalty-cloud.vercel.app/api/send-generic-notification';

async function creditClubCoins(firestore, userId, amount, reason) {
  const scoreId = `bonus_${reason}_${userId}_${Date.now()}`;
  const batch = firestore.batch();

  batch.set(firestore.collection('Clients_Score').doc(scoreId), {
    id: scoreId,
    userId,
    scorePoints: amount,
    scoreType: 'bonus',
    sourceConsumptionId: null,
    baseScorePoints: null,
    multiplier: null,
    createdAt: admin.firestore.Timestamp.now(),
  });

  batch.update(firestore.collection('Users').doc(userId), {
    'club.totalClubCoins': admin.firestore.FieldValue.increment(amount),
  });

  await batch.commit();
  return scoreId;
}

async function sendPushNotification(projectId, userId, fcmToken, amount, reason) {
  const apiKey = process.env.API_SECRET_KEY;
  if (!apiKey) {
    logger.warn('API_SECRET_KEY não configurada. Push não será enviada.');
    return null;
  }

  if (!fcmToken) {
    logger.warn('Usuário sem FCM token. Push não será enviada.');
    return null;
  }

  const message = PUSH_MESSAGES[reason];

  const response = await fetch(CLOUD_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      fcmToken,
      projectId,
      userId,
      title: message.title,
      body: message.body(amount),
      type: 'bonus',
    }),
  });

  return response.json();
}

async function selectUser(firestore) {
  const { searchQuery } = await inquirer.prompt([
    {
      type: 'input',
      name: 'searchQuery',
      message: 'Buscar usuário (nome, CPF, email ou ID):',
      validate: (v) => (v.trim().length > 0 ? true : 'Obrigatório'),
    },
  ]);

  logger.startSpinner('Buscando usuário...');
  const users = await searchUser(firestore, searchQuery.trim());
  logger.stopSpinner();

  if (users.length === 0) {
    logger.error('Nenhum usuário encontrado.');
    process.exit(1);
  }

  if (users.length === 1) {
    return users[0];
  }

  const { userId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'userId',
      message: 'Selecione o usuário:',
      choices: users.map((u) => ({
        name: `${u.name} (${u.cpf || 'sem CPF'}) - ${u.club?.totalClubCoins || 0} ClubCoins`,
        value: u.id,
      })),
    },
  ]);

  return users.find((u) => u.id === userId);
}

async function run() {
  try {
    logger.section('Premiar Usuário');

    const clientName = await clientSelector.selectClientOrPrompt(
      process.argv[2],
      { message: 'Selecione o cliente:' }
    );

    const config = clientSelector.loadClientConfig(clientName);
    const { firebaseProjectId, clientName: displayName } = config;

    logger.info(`Cliente: ${displayName} (${firebaseProjectId})`);

    const credentialsPath = path.join(
      __dirname,
      '../../credentials',
      `${clientName}.json`
    );

    await firebaseClient.initializeClientFirebase(
      clientName,
      { projectId: firebaseProjectId },
      credentialsPath
    );

    const firestore = firebaseClient.getClientFirestore(clientName);
    const selectedUser = await selectUser(firestore);

    logger.info(`Usuário: ${selectedUser.name}`);
    logger.keyValue('ID', selectedUser.id);
    logger.keyValue('Saldo atual', `${selectedUser.club?.totalClubCoins || 0} ClubCoins`);

    const { reason } = await inquirer.prompt([
      {
        type: 'list',
        name: 'reason',
        message: 'Motivo da premiação:',
        choices: REWARD_REASONS.map((r) => ({
          name: `${r.emoji} ${r.name} (${r.default} ClubCoins)`,
          value: r.value,
        })),
      },
    ]);

    const selectedReason = REWARD_REASONS.find((r) => r.value === reason);

    const { amount } = await inquirer.prompt([
      {
        type: 'number',
        name: 'amount',
        message: 'ClubCoins a creditar:',
        default: selectedReason.default,
        validate: (v) => (v > 0 ? true : 'Deve ser maior que 0'),
      },
    ]);

    const { sendPush } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'sendPush',
        message: 'Enviar push notification?',
        default: true,
      },
    ]);

    console.log('');
    logger.keyValue('Usuário', selectedUser.name);
    logger.keyValue('Motivo', `${selectedReason.emoji} ${selectedReason.name}`);
    logger.keyValue('ClubCoins', `+${amount}`);
    logger.keyValue('Novo saldo', `${(selectedUser.club?.totalClubCoins || 0) + amount}`);
    logger.keyValue('Push', sendPush ? 'Sim' : 'Não');
    console.log('');

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Confirmar premiação?',
        default: false,
      },
    ]);

    if (!confirm) {
      logger.warn('Operação cancelada.');
      process.exit(0);
    }

    logger.startSpinner('Creditando ClubCoins...');
    const scoreId = await creditClubCoins(firestore, selectedUser.id, amount, reason);
    logger.succeedSpinner(`+${amount} ClubCoins creditados!`);
    logger.keyValue('Score ID', scoreId);

    if (sendPush) {
      logger.startSpinner('Enviando push notification...');
      const pushResult = await sendPushNotification(
        firebaseProjectId,
        selectedUser.id,
        selectedUser.fcmToken,
        amount,
        reason
      );

      if (pushResult?.success && pushResult?.data?.pushSent) {
        logger.succeedSpinner('Push enviada com sucesso!');
      } else if (pushResult) {
        logger.failSpinner(
          `Push salva, mas envio falhou: ${pushResult?.data?.pushError || 'token inválido'}`
        );
      } else {
        logger.failSpinner('Push não enviada (sem API key ou FCM token).');
      }
    }

    console.log('');
    logger.success(
      `${selectedUser.name} premiado(a) com ${amount} ClubCoins por: ${selectedReason.name}`
    );

    process.exit(0);
  } catch (error) {
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  } finally {
    firebaseClient.cleanup();
  }
}

run();
