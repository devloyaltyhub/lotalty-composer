/**
 * Plan System Constants
 * Single source of truth for subscription plans across the Loyalty Hub ecosystem.
 *
 * Synced with: loyalty-website/src/lib/constants.ts
 */

const PLAN_TYPES = {
  ESSENCIAL: 'essencial',
  PROFISSIONAL: 'profissional',
  ILIMITADO: 'ilimitado',
};

const PRICING = {
  essencial: {
    monthly: 79.9,
    annual: 862.02,
  },
  profissional: {
    monthly: 149.9,
    annual: 1618.92,
  },
  ilimitado: {
    monthly: 199.9,
    annual: 2158.92,
  },
  annualDiscount: 0.1,
  setupFee: 300.0,
  extraStoreFee: 50.0,
};

const PLAN_LIMITS = {
  essencial: {
    maxClients: 2000,
    maxProducts: -1,
    maxNotificationsPerDay: 1,
    maxStores: 1,
    reportLevel: 'basic',
    showBranding: true,
  },
  profissional: {
    maxClients: 5000,
    maxProducts: -1,
    maxNotificationsPerDay: 3,
    maxStores: 1,
    reportLevel: 'intermediate',
    showBranding: true,
  },
  ilimitado: {
    maxClients: -1,
    maxProducts: -1,
    maxNotificationsPerDay: -1,
    maxStores: -1,
    reportLevel: 'advanced',
    showBranding: false,
  },
};

const FEATURE_FLAGS_BY_PLAN = {
  essencial: {
    delivery: true,
    ecommerce: true,
    happyHour: false,
    campaigns: false,
    storeHours: true,
    pushNotifications: false,
    clarity: true,
    birthday: true,
    dietaryPreferences: false,
    aiAssistant: false,
    launchScreen: false,
    referralProgram: false,
    salesFunnel: false,
    clubLevels: false,
  },
  profissional: {
    delivery: true,
    ecommerce: true,
    happyHour: true,
    campaigns: true,
    storeHours: true,
    pushNotifications: true,
    clarity: true,
    birthday: true,
    dietaryPreferences: true,
    aiAssistant: true,
    launchScreen: false,
    referralProgram: false,
    salesFunnel: true,
    clubLevels: false,
  },
  ilimitado: {
    delivery: true,
    ecommerce: true,
    happyHour: true,
    campaigns: true,
    storeHours: true,
    pushNotifications: true,
    clarity: true,
    birthday: true,
    dietaryPreferences: true,
    aiAssistant: true,
    launchScreen: false,
    referralProgram: true,
    salesFunnel: true,
    clubLevels: true,
  },
};

const PLAN_DISPLAY_NAMES = {
  essencial: 'Essencial',
  profissional: 'Profissional',
  ilimitado: 'Ilimitado',
};

const PLAN_DESCRIPTIONS = {
  essencial: 'Ideal para pequenos negócios começando com fidelização',
  profissional: 'Recursos completos para negócios em crescimento',
  ilimitado: 'Sem limites, sem branding, múltiplas lojas',
};

const PLANS = [
  {
    id: PLAN_TYPES.ESSENCIAL,
    name: PLAN_DISPLAY_NAMES.essencial,
    description: PLAN_DESCRIPTIONS.essencial,
    pricing: PRICING.essencial,
    limits: PLAN_LIMITS.essencial,
    featureFlags: FEATURE_FLAGS_BY_PLAN.essencial,
  },
  {
    id: PLAN_TYPES.PROFISSIONAL,
    name: PLAN_DISPLAY_NAMES.profissional,
    description: PLAN_DESCRIPTIONS.profissional,
    pricing: PRICING.profissional,
    limits: PLAN_LIMITS.profissional,
    featureFlags: FEATURE_FLAGS_BY_PLAN.profissional,
  },
  {
    id: PLAN_TYPES.ILIMITADO,
    name: PLAN_DISPLAY_NAMES.ilimitado,
    description: PLAN_DESCRIPTIONS.ilimitado,
    pricing: PRICING.ilimitado,
    limits: PLAN_LIMITS.ilimitado,
    featureFlags: FEATURE_FLAGS_BY_PLAN.ilimitado,
  },
];

const DEFAULT_PLAN_FOR_MIGRATION = PLAN_TYPES.PROFISSIONAL;

function getPlanById(planId) {
  return PLANS.find((p) => p.id === planId) || null;
}

function getPlanLimits(planId) {
  return PLAN_LIMITS[planId] || null;
}

function getPlanFeatureFlags(planId) {
  return FEATURE_FLAGS_BY_PLAN[planId] || null;
}

function isValidPlanType(planType) {
  return Object.values(PLAN_TYPES).includes(planType);
}

function getPlanChoicesForPrompt() {
  return PLANS.map((plan) => ({
    name: `${plan.name} - R$${plan.pricing.monthly}/mês (${plan.description})`,
    value: plan.id,
  }));
}

module.exports = {
  PLAN_TYPES,
  PRICING,
  PLAN_LIMITS,
  FEATURE_FLAGS_BY_PLAN,
  PLAN_DISPLAY_NAMES,
  PLAN_DESCRIPTIONS,
  PLANS,
  DEFAULT_PLAN_FOR_MIGRATION,
  getPlanById,
  getPlanLimits,
  getPlanFeatureFlags,
  isValidPlanType,
  getPlanChoicesForPrompt,
};
