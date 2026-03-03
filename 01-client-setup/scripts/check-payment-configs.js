#!/usr/bin/env node

/**
 * Verifica a configuração de pagamento de todos os clientes.
 *
 * Usage:
 *   node check-payment-configs.js            # Todos os clientes ativos
 *   node check-payment-configs.js <client>   # Cliente específico
 *
 * Requires .env with:
 *   MASTER_FIREBASE_SERVICE_ACCOUNT, MASTER_FIREBASE_PROJECT_ID
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const admin = require("firebase-admin");
const logger = require("../../shared/utils/logger");
const firebaseClient = require("../shared/firebase-manager");

function formatCurrency(cents) {
  return `R$ ${(cents / 100).toFixed(2)}`;
}

function printPaymentConfig(clientCode, payment) {
  logger.section(clientCode);

  if (!payment || !payment.enabled) {
    logger.warn("  Pagamento: DESABILITADO ou não configurado");
    return;
  }

  const env = payment.isProduction ? "PRODUÇÃO" : "SANDBOX";
  logger.info(`  Ambiente: ${env}`);
  logger.info(`  Callback: ${payment.callbackBaseUrl || "não definido"}`);

  // Gateways
  logger.info("  Gateways:");
  const gateways = payment.gateways || {};
  for (const [name, creds] of Object.entries(gateways)) {
    const hasKey = creds?.apiKey ? "✅ apiKey" : "❌ sem apiKey";
    logger.info(`    ${name}: ${hasKey}`);
  }

  // Routing
  const routing = payment.routing || {};
  logger.info("  Routing:");
  logger.info(`    PIX:      ${routing.pix || "não definido"}`);
  logger.info(`    Cartão:   ${routing.card || "não definido"}`);
  logger.info(`    Fallback: ${routing.fallback || "não definido"} (${routing.enableFallback ? "ativo" : "inativo"})`);

  // Split
  const split = payment.split;
  if (!split || !split.enabled) {
    logger.warn("  Split: DESABILITADO");
    return;
  }

  logger.info("  Split: HABILITADO");

  // Recipients per gateway
  const recipients = split.recipients || {};
  logger.info("  Recipients:");
  for (const [gateway, r] of Object.entries(recipients)) {
    logger.info(`    ${gateway}:`);
    logger.info(`      platform:  ${r?.platformRecipientId || "❌ vazio"}`);
    logger.info(`      partner:   ${r?.partnerRecipientId || "❌ vazio"}`);
  }

  // Fees
  const feeTypes = ["delivery", "events", "ecommerce", "subscription"];
  logger.info("  Taxas:");
  for (const type of feeTypes) {
    const fee = split[type];
    if (fee) {
      logger.info(
        `    ${type}: ${formatCurrency(fee.fixedFeeCents || 0)} fixo + ${fee.feePercentage || 0}%`,
      );
    }
  }
}

async function main() {
  const targetClient = process.argv[2];

  logger.section("Verificação de Configuração de Pagamento");

  try {
    await firebaseClient.initializeMasterFirebase();

    let clients;
    if (targetClient) {
      const clientData = await firebaseClient.getClientFromMaster(targetClient);
      if (!clientData) {
        logger.error(`Cliente não encontrado: ${targetClient}`);
        process.exit(1);
      }
      clients = [{ clientCode: targetClient, ...clientData }];
    } else {
      clients = await firebaseClient.getAllClients(false);
    }

    if (clients.length === 0) {
      logger.warn("Nenhum cliente encontrado");
      process.exit(0);
    }

    logger.info(`Clientes encontrados: ${clients.length}\n`);

    for (const client of clients) {
      const { clientCode, firebase_options, serviceAccountPath } = client;

      try {
        await firebaseClient.initializeClientFirebase(
          clientCode,
          firebase_options || {},
          serviceAccountPath,
        );

        const clientApp = firebaseClient.apps.get(clientCode);
        const firestore = admin.firestore(clientApp);
        const configDoc = await firestore
          .collection("Store_Configs")
          .doc("config")
          .get();

        if (!configDoc.exists) {
          logger.section(clientCode);
          logger.warn("  Store_Configs/config não existe");
          continue;
        }

        const data = configDoc.data();
        printPaymentConfig(clientCode, data?.payment);
      } catch (err) {
        logger.section(clientCode);
        logger.error(`  Erro ao ler config: ${err.message}`);
      }

      console.log("");
    }
  } catch (error) {
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  } finally {
    firebaseClient.cleanup();
  }
}

main();
