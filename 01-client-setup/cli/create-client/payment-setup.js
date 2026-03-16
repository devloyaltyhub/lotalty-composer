const admin = require("firebase-admin");
const inquirer = require("inquirer");
const logger = require("../../../shared/utils/logger");
const { isAsaasProduction } = require("../../shared/asaas-subaccount");
const {
  selectGateways,
  createAsaasWallet,
} = require("./payment-gateway-setup");

const CALLBACK_BASE_URL =
  process.env.LOYALTY_CALLBACK_URL ||
  "https://loyalty-cloud.vercel.app";

/**
 * Detects which gateways are available based on env vars.
 */
function detectAvailableGateways() {
  const hasOpenpix = !!process.env.OPENPIX_API_KEY;
  const hasAsaas = !!process.env.ASAAS_API_KEY;

  if (hasOpenpix && hasAsaas) return { hasOpenpix, hasAsaas, mode: "full" };
  if (hasAsaas) return { hasOpenpix, hasAsaas, mode: "asaas-only" };
  if (hasOpenpix) return { hasOpenpix, hasAsaas, mode: "openpix-only" };
  return { hasOpenpix, hasAsaas, mode: "none" };
}

/**
 * Builds the Firestore payment config document from collected data.
 */
function buildPaymentConfig(info) {
  const { mode } = info;

  const gateways = {};
  const recipients = {};

  if (info.openpixApiKey) {
    gateways.openpix = { apiKey: info.openpixApiKey, secretKey: "" };
    if (info.platformPixKey && info.merchantPixKey) {
      recipients.openpix = {
        platformRecipientId: info.platformPixKey,
        partnerRecipientId: info.merchantPixKey,
      };
    }
  }

  if (info.asaasApiKey) {
    gateways.asaas = { apiKey: info.asaasApiKey, secretKey: "" };
    if (info.platformWalletId && info.asaasWalletId) {
      recipients.asaas = {
        platformRecipientId: info.platformWalletId,
        partnerRecipientId: info.asaasWalletId,
      };
    }
  }

  let routing;
  if (mode === "full") {
    routing = {
      pix: "openpix",
      card: "asaas",
      fallback: "asaas",
      enableFallback: true,
    };
  } else if (mode === "asaas-only") {
    routing = {
      pix: "asaas",
      card: "asaas",
      fallback: null,
      enableFallback: false,
    };
  } else {
    routing = {
      pix: "openpix",
      card: null,
      fallback: null,
      enableFallback: false,
    };
  }

  return {
    enabled: true,
    isProduction: info.isProduction,
    callbackBaseUrl: CALLBACK_BASE_URL,
    gateways,
    routing,
    split: {
      enabled: Object.keys(recipients).length > 0,
      recipients,
      delivery: { fixedFeeCents: 99, feePercentage: 5 },
      events: { fixedFeeCents: 99, feePercentage: 3 },
      ecommerce: { fixedFeeCents: 99, feePercentage: 5 },
      subscription: { fixedFeeCents: 0, feePercentage: 0 },
    },
  };
}

/**
 * Collects payment configuration from CLI prompts.
 * @param {Object} [config={}] - Wizard config (clientName, adminEmail) for defaults
 */
async function collectPaymentInfo(config = {}) {
  const detected = detectAvailableGateways();

  if (detected.mode === "none") {
    logger.warn(
      "Nenhuma API key de gateway encontrada no .env. " +
        "Defina ASAAS_API_KEY e/ou OPENPIX_API_KEY.",
    );
    return null;
  }

  const modeLabels = {
    full: "OpenPix (PIX) + Asaas (cartão + fallback PIX)",
    "asaas-only": "Asaas (PIX + cartão)",
    "openpix-only": "OpenPix (PIX apenas, sem cartão)",
  };
  logger.info(`Gateways disponíveis: ${modeLabels[detected.mode]}`);

  const { useAsaas, useOpenpix, mode } = await selectGateways(detected);

  const openpixApiKey = process.env.OPENPIX_API_KEY;
  const asaasApiKey = process.env.ASAAS_API_KEY;
  const platformPixKey = process.env.OPENPIX_PLATFORM_PIX_KEY;
  const platformWalletId = process.env.ASAAS_PLATFORM_WALLET_ID;

  if (useAsaas && !platformWalletId) {
    logger.warn("ASAAS_PLATFORM_WALLET_ID não definida no .env.");
    return null;
  }
  if (useOpenpix && !platformPixKey) {
    logger.warn("OPENPIX_PLATFORM_PIX_KEY não definida no .env.");
    return null;
  }

  let asaasWalletId = null;
  if (useAsaas) {
    asaasWalletId = await createAsaasWallet(config);
    if (!asaasWalletId) {
      logger.warn("Asaas não configurado (subconta não criada).");
    }
  }

  let merchantPixKey = null;
  if (useOpenpix) {
    const { pixKey } = await inquirer.prompt([
      {
        type: "input",
        name: "pixKey",
        message: "Chave PIX do lojista (para recebimentos OpenPix):",
        validate: (v) =>
          v.trim().length > 0 ? true : "Informe a chave PIX do lojista",
      },
    ]);
    merchantPixKey = pixKey.trim();
  }

  const isProduction = isAsaasProduction();
  logger.info(`  Ambiente: ${isProduction ? "produção" : "sandbox"}`);

  return {
    mode,
    openpixApiKey: useOpenpix ? openpixApiKey : null,
    asaasApiKey: useAsaas ? asaasApiKey : null,
    merchantPixKey,
    asaasWalletId,
    platformPixKey: useOpenpix ? platformPixKey : null,
    platformWalletId: useAsaas ? platformWalletId : null,
    isProduction,
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

  const hasPayments = config.featureFlags?.ecommerce;

  if (!hasPayments) {
    logger.info("Pagamento desabilitado (sem ecommerce flag)");
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

  const paymentInfo = await collectPaymentInfo(config);
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

  const modeLabels = {
    full: "OpenPix (PIX) + Asaas (cartão)",
    "asaas-only": "Asaas (PIX + cartão)",
    "openpix-only": "OpenPix (PIX apenas)",
  };

  logger.success("Pagamento configurado:");
  logger.info(`  Modo: ${modeLabels[paymentInfo.mode]}`);
  logger.info(
    `  Split: ${paymentConfig.split.enabled ? "habilitado" : "desabilitado"}`,
  );
  logger.info(
    `  Ambiente: ${paymentInfo.isProduction ? "produção" : "sandbox"}`,
  );

  return paymentConfig;
}

module.exports = {
  setupPaymentConfig,
  buildPaymentConfig,
  writePaymentConfig,
  collectPaymentInfo,
  detectAvailableGateways,
};
