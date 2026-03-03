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
const {
  createAsaasSubaccount,
  buildSandboxTestData,
  getAsaasBaseUrl,
} = require("../shared/asaas-subaccount");

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
  logger.info(`Base URL: ${getAsaasBaseUrl()}`);

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
    const result = await createAsaasSubaccount(data);
    logger.succeedSpinner("Subconta criada!");

    console.log("");
    logger.success("Dados da subconta:");
    logger.info(`  ID:        ${result.id || "N/A"}`);
    logger.info(`  walletId:  ${result.walletId || "N/A"}`);
    logger.info(
      `  API Key:   ${result.apiKey ? result.apiKey.slice(0, 20) + "..." : "N/A"}`,
    );
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
