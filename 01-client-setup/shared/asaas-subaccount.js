/**
 * Módulo reutilizável para criação de subcontas Asaas.
 *
 * Contém apenas lógica de negócio (sem prompts CLI).
 * Usado pelo wizard de criação de cliente e pelo script standalone.
 */

const SANDBOX_URL = "https://api-sandbox.asaas.com";
const PRODUCTION_URL = "https://www.asaas.com";

function isAsaasProduction() {
  return process.env.ASAAS_PRODUCTION === "true";
}

function getAsaasBaseUrl() {
  return isAsaasProduction() ? PRODUCTION_URL : SANDBOX_URL;
}

/**
 * Cria uma subconta Asaas via POST /v3/accounts.
 * @param {Object} data - Dados da subconta (name, email, cpfCnpj, etc.)
 * @returns {Promise<{id: string, walletId: string, apiKey: string, name: string}>}
 */
async function createAsaasSubaccount(data) {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não definida no .env");
  }

  const baseUrl = getAsaasBaseUrl();
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
    throw new Error(
      `Resposta inválida (${response.status}): ${text.slice(0, 200)}`,
    );
  }

  if (!response.ok) {
    const errors =
      body.errors?.map((e) => e.description).join(", ") ||
      JSON.stringify(body);
    throw new Error(`Asaas API error (${response.status}): ${errors}`);
  }

  return body;
}

/**
 * Gera CPF válido aleatório (para sandbox).
 */
function generateRandomCpf() {
  const rand = (n) => Math.floor(Math.random() * n);
  const digits = Array.from({ length: 9 }, () => rand(10));
  const calcDigit = (slice) => {
    const sum = slice.reduce(
      (s, d, i) => s + d * (slice.length + 1 - i),
      0,
    );
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  digits.push(calcDigit(digits));
  digits.push(calcDigit(digits));
  return digits.join("");
}

/**
 * Gera dados fictícios para teste em sandbox.
 * @param {string} [name] - Nome opcional (usa timestamp se não fornecido)
 * @param {string} [email] - Email opcional
 */
function buildSandboxTestData(name, email) {
  const timestamp = Date.now().toString().slice(-6);
  return {
    name: name || `Lojista Teste ${timestamp}`,
    email: email || `teste${timestamp}@loyaltyhub.dev`,
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

module.exports = {
  getAsaasBaseUrl,
  isAsaasProduction,
  createAsaasSubaccount,
  generateRandomCpf,
  buildSandboxTestData,
};
