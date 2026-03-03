/**
 * Gateway selection and Asaas subaccount creation flow.
 *
 * Used by payment-setup.js during client creation wizard
 * and by standalone setup-payment.js.
 */

const inquirer = require("inquirer");
const logger = require("../../../shared/utils/logger");
const {
  createAsaasSubaccount,
  getAsaasBaseUrl,
} = require("../../shared/asaas-subaccount");

/**
 * When both gateways are available, asks which ones to activate.
 * If only one gateway, returns directly without prompting.
 */
async function selectGateways({ hasOpenpix, hasAsaas, mode }) {
  if (mode !== "full") {
    return { useAsaas: hasAsaas, useOpenpix: hasOpenpix, mode };
  }

  const { selected } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "selected",
      message: "Quais gateways ativar para este cliente?",
      choices: [
        { name: "Asaas (PIX + cartão)", value: "asaas", checked: true },
        { name: "OpenPix (PIX)", value: "openpix", checked: true },
      ],
      validate: (v) =>
        v.length > 0 ? true : "Selecione pelo menos um gateway",
    },
  ]);

  const useAsaas = selected.includes("asaas");
  const useOpenpix = selected.includes("openpix");

  let effectiveMode = "full";
  if (useAsaas && !useOpenpix) effectiveMode = "asaas-only";
  if (useOpenpix && !useAsaas) effectiveMode = "openpix-only";

  return { useAsaas, useOpenpix, mode: effectiveMode };
}

/**
 * Collects real merchant data for creating an Asaas subaccount.
 * Pre-fills name and email from wizard config when available.
 *
 * Campos exigidos pela API Asaas (POST /v3/accounts):
 * - name, email, cpfCnpj, companyType, mobilePhone
 * - address, addressNumber, province, postalCode
 * - birthDate (PF) ou incomeValue
 */
async function collectAsaasSubaccountInfo(config) {
  logger.info("Dados do lojista para criar subconta Asaas:");

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Nome completo ou razão social:",
      default: config.clientName || undefined,
      validate: (v) => (v.trim().length > 0 ? true : "Obrigatório"),
    },
    {
      type: "input",
      name: "email",
      message: "Email:",
      default: config.adminEmail || undefined,
      validate: (v) => (v.includes("@") ? true : "Email inválido"),
    },
    {
      type: "input",
      name: "cpfCnpj",
      message: "CPF ou CNPJ (apenas números):",
      validate: (v) =>
        v.replace(/\D/g, "").length >= 11 ? true : "Mínimo 11 dígitos",
    },
    {
      type: "list",
      name: "companyType",
      message: "Tipo de empresa:",
      choices: [
        { name: "MEI — Microempreendedor Individual", value: "MEI" },
        { name: "LTDA — Sociedade Limitada", value: "LIMITED" },
        { name: "Individual — Pessoa Física", value: "INDIVIDUAL" },
        { name: "Associação", value: "ASSOCIATION" },
      ],
      default: "MEI",
    },
    {
      type: "input",
      name: "birthDate",
      message: "Data de nascimento do responsável (YYYY-MM-DD):",
      validate: (v) =>
        /^\d{4}-\d{2}-\d{2}$/.test(v) ? true : "Formato: YYYY-MM-DD",
    },
    {
      type: "input",
      name: "mobilePhone",
      message: "Celular com DDD (ex: 47999001234):",
      validate: (v) =>
        v.replace(/\D/g, "").length >= 10 ? true : "Mínimo 10 dígitos",
    },
    {
      type: "input",
      name: "address",
      message: "Endereço (rua/avenida):",
      validate: (v) => (v.trim().length > 0 ? true : "Obrigatório"),
    },
    {
      type: "input",
      name: "addressNumber",
      message: "Número:",
      validate: (v) => (v.trim().length > 0 ? true : "Obrigatório"),
    },
    {
      type: "input",
      name: "province",
      message: "Bairro:",
      validate: (v) => (v.trim().length > 0 ? true : "Obrigatório"),
    },
    {
      type: "input",
      name: "postalCode",
      message: "CEP (apenas números):",
      validate: (v) =>
        v.replace(/\D/g, "").length === 8 ? true : "CEP deve ter 8 dígitos",
    },
  ]);

  return {
    name: answers.name.trim(),
    email: answers.email.trim(),
    cpfCnpj: answers.cpfCnpj.replace(/\D/g, ""),
    birthDate: answers.birthDate,
    companyType: answers.companyType,
    mobilePhone: answers.mobilePhone.replace(/\D/g, ""),
    address: answers.address.trim(),
    addressNumber: answers.addressNumber.trim(),
    province: answers.province.trim(),
    postalCode: answers.postalCode.replace(/\D/g, ""),
    incomeValue: 5000,
  };
}

/**
 * Creates an Asaas subaccount for the merchant and returns the walletId.
 * On failure, offers retry or skip (no manual wallet ID option).
 */
async function createAsaasWallet(config) {
  const subaccountData = await collectAsaasSubaccountInfo(config);

  logger.info(`  API: ${getAsaasBaseUrl()}`);
  logger.startSpinner("Criando subconta Asaas...");

  try {
    const result = await createAsaasSubaccount(subaccountData);
    logger.succeedSpinner("Subconta Asaas criada!");
    logger.info(`  Wallet ID: ${result.walletId}`);
    logger.info(`  ID: ${result.id}`);
    return result.walletId;
  } catch (error) {
    logger.failSpinner("Falha ao criar subconta Asaas");
    logger.error(`  Erro: ${error.message}`);

    const { fallback } = await inquirer.prompt([
      {
        type: "list",
        name: "fallback",
        message: "O que deseja fazer?",
        choices: [
          { name: "Corrigir dados e tentar novamente", value: "retry" },
          { name: "Pular configuração Asaas", value: "skip" },
        ],
      },
    ]);

    if (fallback === "retry") return createAsaasWallet(config);
    return null;
  }
}

module.exports = {
  selectGateways,
  collectAsaasSubaccountInfo,
  createAsaasWallet,
};
