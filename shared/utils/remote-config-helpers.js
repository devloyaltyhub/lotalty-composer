/**
 * Remote Config Helper Functions
 * Utilities for processing Firebase Remote Config templates
 */

/**
 * Feature flag placeholder mappings
 * Maps template placeholders to featureFlags property names
 */
const FEATURE_FLAG_MAPPINGS = [
  { placeholder: "{{DELIVERY}}", key: "delivery" },
  { placeholder: "{{ECOMMERCE}}", key: "ecommerce" },
  { placeholder: "{{HAPPY_HOUR}}", key: "happyHour" },
  { placeholder: "{{CAMPAIGNS}}", key: "campaigns" },
  { placeholder: "{{STORE_HOURS}}", key: "storeHours" },
  { placeholder: "{{PUSH_NOTIFICATIONS}}", key: "pushNotifications" },
  { placeholder: "{{SUGGESTION_BOX}}", key: "suggestionBox" },
  { placeholder: "{{CLARITY}}", key: "clarity" },
  { placeholder: "{{OUR_STORY}}", key: "ourStory" },
  { placeholder: "{{EVENTS}}", key: "events" },
  { placeholder: "{{TEAM}}", key: "team" },
  { placeholder: "{{BIRTHDAY}}", key: "birthday" },
  { placeholder: "{{PAYMENTS}}", key: "payments" },
];

/**
 * Replace all feature flag placeholders in a template string
 * @param {string} templateStr - JSON string of the template
 * @param {Object} featureFlags - Feature flags object
 * @returns {string} - Template string with replaced values
 */
function replaceFeatureFlags(templateStr, featureFlags) {
  let result = templateStr;

  for (const { placeholder, key } of FEATURE_FLAG_MAPPINGS) {
    result = result.replace(placeholder, featureFlags[key] ? "true" : "false");
  }

  return result;
}

/**
 * Replace variables in the Remote Config template
 * @param {Object} template - The template object
 * @param {Object} config - Configuration with featureFlags, clarityProjectId, planType, planLimits
 * @returns {Object} - Processed template object
 */
function replaceTemplateVariables(template, config) {
  const { featureFlags, clarityProjectId, planType, planLimits } = config;

  let templateStr = JSON.stringify(template, null, 2);

  templateStr = replaceFeatureFlags(templateStr, featureFlags);

  templateStr = templateStr.replace("{{CLARITY_PROJECT_ID}}", clarityProjectId);

  templateStr = templateStr.replace("{{PLAN_TYPE}}", planType || "profissional");

  const limitsStr = planLimits ? JSON.stringify(planLimits).replace(/"/g, '\\"') : '{}';
  templateStr = templateStr.replace("{{PLAN_LIMITS}}", limitsStr);

  return JSON.parse(templateStr);
}

/**
 * Get default versionarte configuration
 * @returns {Object} - Default versionarte config for Android and iOS
 */
function getDefaultVersionarte() {
  const platformConfig = {
    version: {
      minimum: "1.0.0",
      latest: "0.0.1",
    },
    download_url: "",
    status: {
      active: true,
      message: {
        pt: "O Aplicativo esta em manutencao. Por favor, tente mais tarde.",
      },
    },
  };

  return {
    android: { ...platformConfig },
    ios: { ...platformConfig },
  };
}

/**
 * Sleep utility for retries
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  FEATURE_FLAG_MAPPINGS,
  replaceFeatureFlags,
  replaceTemplateVariables,
  getDefaultVersionarte,
  sleep,
};
