#!/usr/bin/env node

/**
 * CLI para enviar push notifications broadcast
 * Envia para todos os usuários de um cliente via FCM topic
 *
 * Uso: npm run send-push [client-name]
 */

const path = require('path');
const inquirer = require('inquirer');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const logger = require('../../shared/utils/logger');
const clientSelector = require('../../shared/utils/client-selector');

const API_URL =
  'https://loyalty-cloud-service.vercel.app/api/send-broadcast-notification';

async function run() {
  try {
    logger.section('Enviar Push Notification');

    const apiKey = process.env.API_SECRET_KEY;
    if (!apiKey) {
      logger.error(
        'API_SECRET_KEY não configurada no .env. Adicione a chave do loyalty-cloud-service.'
      );
      process.exit(1);
    }

    const clientName = await clientSelector.selectClientOrPrompt(
      process.argv[2],
      { message: 'Selecione o cliente para enviar a push:' }
    );

    const config = clientSelector.loadClientConfig(clientName);
    const { firebaseProjectId, clientName: displayName } = config;

    logger.info(`Cliente: ${displayName} (${firebaseProjectId})`);

    const { title, body, topic } = await inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: 'Título da notificação:',
        validate: (v) =>
          v.trim().length > 0 ? true : 'Título é obrigatório',
      },
      {
        type: 'input',
        name: 'body',
        message: 'Corpo da notificação:',
        validate: (v) => (v.trim().length > 0 ? true : 'Corpo é obrigatório'),
      },
      {
        type: 'list',
        name: 'topic',
        message: 'Tópico FCM:',
        choices: [
          {
            name: 'happy_hours (todos os usuários ativos)',
            value: 'happy_hours',
          },
          {
            name: 'broadcast (requer app atualizado)',
            value: 'broadcast',
          },
        ],
        default: 'happy_hours',
      },
    ]);

    console.log('');
    logger.keyValue('Cliente', displayName);
    logger.keyValue('Project ID', firebaseProjectId);
    logger.keyValue('Título', title);
    logger.keyValue('Corpo', body);
    logger.keyValue('Tópico', topic);
    console.log('');

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Enviar push notification para TODOS os usuários?',
        default: false,
      },
    ]);

    if (!confirm) {
      logger.warn('Envio cancelado pelo usuário.');
      process.exit(0);
    }

    logger.info('Enviando push notification...');

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        projectId: firebaseProjectId,
        topic,
        title: title.trim(),
        body: body.trim(),
      }),
    });

    const result = await response.json();

    if (result.success && result.data?.pushSent) {
      logger.success('Push notification enviada com sucesso!');
      logger.keyValue('Message ID', result.data.firebaseMessageId);
      logger.keyValue('Tempo', result.data.responseTime);
    } else if (result.success) {
      logger.warn('Notificação salva, mas push falhou.');
      logger.keyValue('Erro', result.data?.pushError || 'Desconhecido');
    } else {
      logger.error(`Falha ao enviar: ${result.error || result.message}`);
      if (result.errors) {
        result.errors.forEach((e) => logger.error(`  - ${e}`));
      }
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  }
}

run();
