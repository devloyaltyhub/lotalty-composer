const inquirer = require("inquirer");
const {
  validateClientCode,
  validateEmail,
  validateBundleId,
  validateHexColor,
} = require("../../shared/input-validator");
const { BusinessTypeRepository } = require("../../shared/business-type-manager");
const logger = require("../../../shared/utils/logger");
const { getPlanChoicesForPrompt, getPlanFeatureFlags, PLAN_TYPES } = require("../../../shared/constants/plans");

const FEATURE_FLAGS_CHOICES = [
  { name: "Delivery", value: "delivery", checked: false },
  { name: "E-commerce", value: "ecommerce", checked: true },
  { name: "Happy Hour", value: "happyHour", checked: true },
  { name: "Campaigns", value: "campaigns", checked: true },
  { name: "Store Hours", value: "storeHours", checked: true },
  { name: "Push Notifications", value: "pushNotifications", checked: true },
  { name: "Suggestion Box", value: "suggestionBox", checked: true },
  { name: "Clarity Analytics", value: "clarity", checked: true },
  { name: "Our Story", value: "ourStory", checked: true },
  { name: "Events", value: "events", checked: true },
  { name: "Team", value: "team", checked: true },
  { name: "Birthday Bonus", value: "birthday", checked: false },
  { name: "Payments (PIX)", value: "payments", checked: false },
];

function convertFeatureFlagsToObject(featureFlagsArray) {
  return {
    delivery: featureFlagsArray.includes("delivery"),
    ecommerce: featureFlagsArray.includes("ecommerce"),
    happyHour: featureFlagsArray.includes("happyHour"),
    campaigns: featureFlagsArray.includes("campaigns"),
    storeHours: featureFlagsArray.includes("storeHours"),
    pushNotifications: featureFlagsArray.includes("pushNotifications"),
    suggestionBox: featureFlagsArray.includes("suggestionBox"),
    clarity: featureFlagsArray.includes("clarity"),
    ourStory: featureFlagsArray.includes("ourStory"),
    events: featureFlagsArray.includes("events"),
    team: featureFlagsArray.includes("team"),
    birthday: featureFlagsArray.includes("birthday"),
    payments: featureFlagsArray.includes("payments"),
  };
}

function generateFirebaseProjectId(clientCode) {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${clientCode}-lhc-${randomSuffix}`;
}

function validateFirebaseProjectIdLength(projectId) {
  if (projectId.length > 30) {
    return {
      valid: false,
      error: `Firebase Project ID is too long (${projectId.length} chars, max 30). Please use a shorter client code (max ${30 - 9} characters).`,
    };
  }
  return { valid: true };
}

async function collectClientInfo(firebaseClient) {
  logger.section("Client Information");

  const availableBusinessTypes = BusinessTypeRepository.getExistingTypes();

  if (availableBusinessTypes.length === 0) {
    logger.error("No business types found! Please create at least one business type first.");
    logger.info("Run: npm run create-business-type");
    process.exit(1);
  }

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "clientCode",
      message: 'Client Code (e.g., "na-rede", "acme-corp"):',
      validate: (input) => {
        try {
          validateClientCode(input);
          return true;
        } catch (error) {
          return error.message;
        }
      },
    },
    {
      type: "input",
      name: "clientName",
      message: 'Client Display Name (e.g., "Na Rede"):',
      validate: (input) => {
        if (!input.trim()) return "Client name is required";
        if (input.trim().length < 4)
          return "Client name must be at least 4 characters (Google Cloud Platform requirement)";
        return true;
      },
    },
    {
      type: "input",
      name: "bundleId",
      message: "Bundle ID (complete with your client name):",
      default: "lv.club.loyaltyhub.",
      validate: (input) => {
        try {
          validateBundleId(input);
          return true;
        } catch (error) {
          return error.message;
        }
      },
    },
    {
      type: "input",
      name: "appName",
      message: "App Display Name:",
      validate: (input) => input.trim().length > 0 || "App name is required",
    },
    {
      type: "input",
      name: "loversName",
      message: 'Nome dos "lovers" da loja (ex: "Na Redeiros", "Biriteiros", "Cafeinados"):',
      validate: (input) => input.trim().length > 0 || "Lovers name is required",
    },
    {
      type: "input",
      name: "adminEmail",
      message: "Admin Email:",
      default: (prevAnswers) => {
        const normalizedCode = prevAnswers.clientCode
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "");
        return `${normalizedCode}@loyaltyhub.club`;
      },
      validate: (input) => {
        try {
          validateEmail(input);
          return true;
        } catch (error) {
          return error.message;
        }
      },
    },
    {
      type: "list",
      name: "businessType",
      message: "Business Type:",
      choices: availableBusinessTypes.map((type) => ({
        name: `${type.label} (${type.key})`,
        value: type.key,
      })),
    },
    {
      type: "list",
      name: "planType",
      message: "Subscription Plan:",
      choices: getPlanChoicesForPrompt(),
      default: PLAN_TYPES.PROFISSIONAL,
    },
    {
      type: "input",
      name: "primaryColor",
      message: 'Primary Brand Color (hex, e.g., "#FF5733"):',
      default: "#FF5733",
      validate: (input) => {
        try {
          validateHexColor(input);
          return true;
        } catch (error) {
          return error.message;
        }
      },
    },
    {
      type: "confirm",
      name: "customizeFeatures",
      message: "Customize feature flags? (No = use plan defaults)",
      default: false,
    },
    {
      type: "checkbox",
      name: "featureFlagsCustom",
      message: "Select features to enable for this client:",
      choices: (prevAnswers) => {
        const planFlags = getPlanFeatureFlags(prevAnswers.planType);
        return FEATURE_FLAGS_CHOICES.map((choice) => ({
          ...choice,
          checked: planFlags ? planFlags[choice.value] : choice.checked,
        }));
      },
      when: (prevAnswers) => prevAnswers.customizeFeatures,
    },
    {
      type: "input",
      name: "clarityProjectId",
      message: "Microsoft Clarity Project ID (required):",
      validate: (input) => {
        if (!input.trim()) return "Clarity Project ID is required";
        return true;
      },
    },
    {
      type: "input",
      name: "tinifyApiKey",
      message: "TinyPNG API Key (for image compression, optional):",
      default: "",
    },
  ]);

  if (answers.customizeFeatures && answers.featureFlagsCustom) {
    answers.featureFlags = convertFeatureFlagsToObject(answers.featureFlagsCustom);
  } else {
    answers.featureFlags = getPlanFeatureFlags(answers.planType);
  }
  answers.websiteUrl = "https://www.loyaltyhub.club";
  answers.supportUrl = "https://www.loyaltyhub.club/contact";
  answers.privacyUrl = "https://www.loyaltyhub.club/legal#privacy";
  answers.folderName = answers.clientCode;
  answers.firebaseProjectId = generateFirebaseProjectId(answers.clientCode);

  const validation = validateFirebaseProjectIdLength(answers.firebaseProjectId);
  if (!validation.valid) {
    logger.error(validation.error);
    logger.error(`Generated ID: ${answers.firebaseProjectId}`);
    process.exit(1);
  }

  const exists = await firebaseClient.clientExists(answers.clientCode);
  if (exists) {
    logger.error(`Client code ${answers.clientCode} already exists!`);
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: "Client already exists. Continue anyway?",
        default: false,
      },
    ]);

    if (!overwrite) {
      process.exit(1);
    }
  }

  return answers;
}

async function confirmCreation(config) {
  const { PLAN_DISPLAY_NAMES } = require("../../../shared/constants/plans");

  logger.blank();
  logger.subSection("Review Configuration");
  logger.keyValue("Client Name", config.clientName);
  logger.keyValue("Client Code", config.clientCode);
  logger.keyValue("Bundle ID", config.bundleId);
  logger.keyValue("Firebase Project", config.firebaseProjectId);
  logger.keyValue("Admin Email", config.adminEmail);
  logger.keyValue("Subscription Plan", PLAN_DISPLAY_NAMES[config.planType] || config.planType);
  logger.blank();

  const { confirmed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmed",
      message: "Create this client?",
      default: true,
    },
  ]);

  if (!confirmed) {
    logger.warn("Client creation cancelled");
    process.exit(0);
  }
}

module.exports = {
  collectClientInfo,
  confirmCreation,
  convertFeatureFlagsToObject,
  generateFirebaseProjectId,
  validateFirebaseProjectIdLength,
  FEATURE_FLAGS_CHOICES,
};
