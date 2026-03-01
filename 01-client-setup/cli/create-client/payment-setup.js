const admin = require("firebase-admin");
const inquirer = require("inquirer");
const logger = require("../../../shared/utils/logger");

const CALLBACK_BASE_URL =
  process.env.LOYALTY_CALLBACK_URL ||
  "https://loyalty-cloud-service.vercel.app";

/**
 * Builds the Firestore payment config document from collected data.
 */
function buildPaymentConfig({
  openpixApiKey,
  asaasApiKey,
  merchantPixKey,
  asaasWalletId,
  platformPixKey,
  platformWalletId,
  isProduction,
}) {
  return {
    enabled: true,
    isProduction,
    callbackBaseUrl: CALLBACK_BASE_URL,
    gateways: {
      openpix: {
        apiKey: openpixApiKey,
        secretKey: "",
      },
      asaas: {
        apiKey: asaasApiKey,
        secretKey: "",
      },
    },
    routing: {
      pix: "openpix",
      card: "asaas",
      fallback: "asaas",
      enableFallback: true,
    },
    split: {
      enabled: true,
      recipients: {
        openpix: {
          platformRecipientId: platformPixKey,
          merchantRecipientId: merchantPixKey,
        },
        asaas: {
          platformRecipientId: platformWalletId,
          merchantRecipientId: asaasWalletId,
        },
      },
      delivery: { fixedFeeCents: 99, feePercentage: 5 },
      events: { fixedFeeCents: 99, feePercentage: 3 },
      ecommerce: { fixedFeeCents: 99, feePercentage: 5 },
      subscription: { fixedFeeCents: 0, feePercentage: 0 },
    },
  };
}

/**
 * Collects payment configuration from CLI prompts.
 */
async function collectPaymentInfo() {
  const openpixApiKey = process.env.OPENPIX_API_KEY;
  const asaasApiKey = process.env.ASAAS_API_KEY;
  const platformPixKey = process.env.OPENPIX_PLATFORM_PIX_KEY;
  const platformWalletId = process.env.ASAAS_PLATFORM_WALLET_ID;

  if (!openpixApiKey || !asaasApiKey) {
    logger.warn(
      "OPENPIX_API_KEY ou ASAAS_API_KEY não definidas no .env. " +
        "Defina-as e tente novamente.",
    );
    return null;
  }

  if (!platformPixKey || !platformWalletId) {
    logger.warn(
      "OPENPIX_PLATFORM_PIX_KEY ou ASAAS_PLATFORM_WALLET_ID não definidas. " +
        "Defina-as no .env.",
    );
    return null;
  }

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "merchantPixKey",
      message: "Chave PIX do lojista (para recebimentos OpenPix):",
      validate: (v) =>
        v.trim().length > 0 ? true : "Informe a chave PIX do lojista",
    },
    {
      type: "input",
      name: "asaasWalletId",
      message: "Wallet ID Asaas do lojista (subconta):",
      validate: (v) =>
        v.trim().length > 0 ? true : "Informe o wallet ID Asaas",
    },
    {
      type: "confirm",
      name: "isProduction",
      message: "Usar ambiente de produção?",
      default: false,
    },
  ]);

  return {
    openpixApiKey,
    asaasApiKey,
    merchantPixKey: answers.merchantPixKey.trim(),
    asaasWalletId: answers.asaasWalletId.trim(),
    platformPixKey,
    platformWalletId,
    isProduction: answers.isProduction,
  };
}

/**
 * Writes payment configuration to Store_Configs in Firestore.
 */
async function writePaymentConfig(clientApp, paymentConfig) {
  const firestore = admin.firestore(clientApp);
  const configRef = firestore.collection("Store_Configs").doc("config");
  const doc = await configRef.get();

  if (doc.exists) {
    await configRef.update({ payment: paymentConfig });
  } else {
    await configRef.set({ payment: paymentConfig }, { merge: true });
  }
}

/**
 * Main setup function called from the wizard.
 * Only runs if ecommerce or payments feature flag is enabled.
 */
async function setupPaymentConfig(config, firebaseClient) {
  logger.section("Payment Configuration Setup");

  const hasPayments =
    config.featureFlags?.payments || config.featureFlags?.ecommerce;

  if (!hasPayments) {
    logger.info("Pagamento desabilitado (sem ecommerce/payments flag)");
    return null;
  }

  const { shouldSetup } = await inquirer.prompt([
    {
      type: "confirm",
      name: "shouldSetup",
      message: "Configurar pagamento agora?",
      default: true,
    },
  ]);

  if (!shouldSetup) {
    logger.info("Configuração de pagamento ignorada");
    return null;
  }

  const paymentInfo = await collectPaymentInfo();
  if (!paymentInfo) return null;

  const paymentConfig = buildPaymentConfig(paymentInfo);

  const clientApp = firebaseClient.apps.get(config.clientCode);
  if (!clientApp) {
    logger.error("Firebase app não inicializado para este cliente");
    return null;
  }

  logger.startSpinner("Salvando configuração de pagamento...");
  try {
    await writePaymentConfig(clientApp, paymentConfig);
    logger.succeedSpinner("Configuração de pagamento salva no Firestore");
  } catch (error) {
    logger.failSpinner(`Erro ao salvar config: ${error.message}`);
    return null;
  }

  logger.success("Pagamento configurado:");
  logger.info(`  PIX: OpenPix (fallback: Asaas)`);
  logger.info(`  Cartão: Asaas`);
  logger.info(`  Split: habilitado`);
  logger.info(`  Ambiente: ${paymentInfo.isProduction ? "produção" : "sandbox"}`);

  return paymentConfig;
}

module.exports = {
  setupPaymentConfig,
  buildPaymentConfig,
  writePaymentConfig,
  collectPaymentInfo,
};
