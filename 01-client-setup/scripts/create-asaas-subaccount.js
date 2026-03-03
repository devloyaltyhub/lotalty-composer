#!/usr/bin/env node

/**
 * Cria uma subconta Asaas (sandbox ou produção) e retorna o walletId.
 *
 * Usage:
 *   node create-asaas-subaccount.js                # interativo
 *   node create-asaas-subaccount.js --sandbox-test # cria subconta de teste automaticamente
 *
 * Requires .env with: ASAAS_API_KEY
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const inquirer = require("inquirer");
const logger = require("../../shared/utils/logger");

const SANDBOX_URL = "https://api-sandbox.asaas.com";
const PRODUCTION_URL = "https://www.asaas.com";

function getBaseUrl() {
  const key = process.env.ASAAS_API_KEY || "";
  // Sandbox keys typically start with $aact_YTU... or contain "sandbox" pattern
  // Production keys are different. We detect based on key format.
  // But safer: let user choose or detect from env
  const isProduction = process.env.ASAAS_PRODUCTION === "true";
  return isProduction ? PRODUCTION_URL : SANDBOX_URL;
}

async function createSubaccount(data) {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não definida no .env");
  }

  const baseUrl = getBaseUrl();
  logger.info(`Base URL: ${baseUrl}`);

  const response = await fetch(`${baseUrl}/v3/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify(data),
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida (${response.status}): ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const errors = body.errors?.map((e) => e.description).join(", ") || JSON.stringify(body);
    throw new Error(`Asaas API error (${response.status}): ${errors}`);
  }

  return body;
}

function generateRandomCpf() {
  const rand = (n) => Math.floor(Math.random() * n);
  const digits = Array.from({ length: 9 }, () => rand(10));
  const calcDigit = (slice) => {
    const sum = slice.reduce((s, d, i) => s + d * (slice.length + 1 - i), 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  digits.push(calcDigit(digits));
  digits.push(calcDigit(digits));
  return digits.join("");
}

function buildSandboxTestData() {
  const timestamp = Date.now().toString().slice(-6);
  return {
    name: `Lojista Teste ${timestamp}`,
    email: `teste${timestamp}@loyaltyhub.dev`,
    cpfCnpj: generateRandomCpf(),
    birthDate: "1990-01-15",
    companyType: "MEI",
    mobilePhone: "47999000001",
    address: "Rua Teste",
    addressNumber: "100",
    province: "Centro",
    postalCode: "89010001",
    incomeValue: 5000,
  };
}

async function collectSubaccountInfo() {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Nome do lojista/empresa:",
      validate: (v) => (v.trim().length > 0 ? true : "Obrigatório"),
    },
    {
      type: "input",
      name: "email",
      message: "Email:",
      validate: (v) => (v.includes("@") ? true : "Email inválido"),
    },
    {
      type: "input",
      name: "cpfCnpj",
      message: "CPF ou CNPJ (apenas números):",
      validate: (v) =>
        v.replace(/\D/g, "").length >= 11 ? true : "CPF/CNPJ inválido",
    },
    {
      type: "input",
      name: "birthDate",
      message: "Data de nascimento (YYYY-MM-DD):",
      default: "1990-01-01",
    },
    {
      type: "list",
      name: "companyType",
      message: "Tipo de empresa:",
      choices: ["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"],
      default: "MEI",
    },
    {
      type: "input",
      name: "mobilePhone",
      message: "Celular (com DDD):",
      validate: (v) =>
        v.replace(/\D/g, "").length >= 10 ? true : "Celular inválido",
    },
    {
      type: "input",
      name: "address",
      message: "Endereço:",
    },
    {
      type: "input",
      name: "addressNumber",
      message: "Número:",
    },
    {
      type: "input",
      name: "province",
      message: "Bairro:",
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
    ...answers,
    cpfCnpj: answers.cpfCnpj.replace(/\D/g, ""),
    mobilePhone: answers.mobilePhone.replace(/\D/g, ""),
    postalCode: answers.postalCode.replace(/\D/g, ""),
    incomeValue: 5000,
  };
}

async function main() {
  const isSandboxTest = process.argv.includes("--sandbox-test");

  logger.section("Criar Subconta Asaas");

  try {
    let data;
    if (isSandboxTest) {
      data = buildSandboxTestData();
      logger.info("Modo: sandbox test (dados fictícios)");
      logger.info(`  Nome: ${data.name}`);
      logger.info(`  Email: ${data.email}`);
      logger.info(`  CPF: ${data.cpfCnpj}`);
    } else {
      data = await collectSubaccountInfo();
    }

    logger.startSpinner("Criando subconta no Asaas...");
    const result = await createSubaccount(data);
    logger.succeedSpinner("Subconta criada!");

    console.log("");
    logger.success("Dados da subconta:");
    logger.info(`  ID:        ${result.id || "N/A"}`);
    logger.info(`  walletId:  ${result.walletId || "N/A"}`);
    logger.info(`  API Key:   ${result.apiKey ? result.apiKey.slice(0, 20) + "..." : "N/A"}`);
    logger.info(`  Nome:      ${result.name || data.name}`);
    console.log("");
    logger.warn(
      "IMPORTANTE: Guarde o walletId acima! Use-o no setup-payment.js como wallet do lojista.",
    );
    logger.info(
      `  Comando: node 01-client-setup/scripts/setup-payment.js <clientCode>`,
    );
  } catch (error) {
    logger.failSpinner?.("Falha");
    logger.error(`Erro: ${error.message}`);
    process.exit(1);
  }
}

main();
