#!/usr/bin/env node

/**
 * Standalone script to configure payment for an existing client.
 *
 * Usage:
 *   node setup-payment.js <clientCode>
 *
 * Requires .env with:
 *   MASTER_FIREBASE_SERVICE_ACCOUNT, MASTER_FIREBASE_PROJECT_ID
 *   And at least one gateway: ASAAS_API_KEY + ASAAS_PLATFORM_WALLET_ID
 *   Optional: OPENPIX_API_KEY + OPENPIX_PLATFORM_PIX_KEY
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const admin = require("firebase-admin");
const inquirer = require("inquirer");
const logger = require("../../shared/utils/logger");
const firebaseClient = require("../shared/firebase-manager");
const {
  buildPaymentConfig,
  collectPaymentInfo,
  writePaymentConfig,
} = require("../cli/create-client/payment-setup");

async function main() {
  const clientCode = process.argv[2];

  if (!clientCode) {
    logger.error("Uso: node setup-payment.js <clientCode>");
    logger.info("Exemplo: node setup-payment.js loyalty-demo");
    process.exit(1);
  }

  logger.section(`Payment Setup: ${clientCode}`);

  try {
    await firebaseClient.initializeMasterFirebase();

    const masterFirestore = await firebaseClient.getMasterFirestore();

    const clientDoc = await masterFirestore
      .collection("clients")
      .doc(clientCode)
      .get();

    if (!clientDoc.exists) {
      logger.error(`Cliente não encontrado: ${clientCode}`);
      process.exit(1);
    }

    const clientData = clientDoc.data();
    const firebaseOptions = clientData.firebase_options || {};
    const projectId = firebaseOptions.projectId;
    const serviceAccountPath = clientData.serviceAccountPath;

    if (!projectId) {
      logger.error("Firebase Project ID não encontrado no cliente");
      process.exit(1);
    }

    logger.info(`Projeto Firebase: ${projectId}`);

    // Initialize client Firebase
    await firebaseClient.initializeClientFirebase(
      clientCode,
      firebaseOptions,
      serviceAccountPath,
    );

    const clientApp = firebaseClient.apps.get(clientCode);
    if (!clientApp) {
      logger.error("Não foi possível inicializar Firebase do cliente");
      process.exit(1);
    }

    // Check if payment already configured
    const configDoc = await admin
      .firestore(clientApp)
      .collection("Store_Configs")
      .doc("config")
      .get();

    if (configDoc.exists && configDoc.data()?.payment?.enabled) {
      const { overwrite } = await inquirer.prompt([
        {
          type: "confirm",
          name: "overwrite",
          message:
            "Pagamento já configurado. Sobrescrever?",
          default: false,
        },
      ]);
      if (!overwrite) {
        logger.info("Cancelado");
        process.exit(0);
      }
    }

    const paymentInfo = await collectPaymentInfo();
    if (!paymentInfo) {
      logger.warn("Configuração cancelada (env vars ausentes)");
      process.exit(1);
    }

    const paymentConfig = buildPaymentConfig(paymentInfo);

    logger.startSpinner("Salvando configuração de pagamento...");
    await writePaymentConfig(clientApp, paymentConfig);
    logger.succeedSpinner("Configuração salva");

    const modeLabels = {
      full: "OpenPix (PIX) + Asaas (cartão + fallback)",
      "asaas-only": "Asaas (PIX + cartão)",
      "openpix-only": "OpenPix (PIX apenas)",
    };

    logger.success("Pagamento configurado para " + clientCode);
    logger.info(`  Modo: ${modeLabels[paymentInfo.mode]}`);
    logger.info(`  Split: ${paymentConfig.split.enabled ? "habilitado" : "desabilitado"}`);
    logger.info(
      `  Ambiente: ${paymentInfo.isProduction ? "produção" : "sandbox"}`,
    );
  } catch (error) {
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  } finally {
    firebaseClient.cleanup();
  }
}

main();
