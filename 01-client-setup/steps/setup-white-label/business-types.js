const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const { GENERAL_ASSETS_DIR } = require('./config');

let BUSINESS_TYPES = [];

function loadBusinessTypesFromAssets() {
  try {
    const animationsDir = path.join(GENERAL_ASSETS_DIR, 'animations');
    if (!fs.existsSync(animationsDir)) {
      return;
    }

    const businessTypeDirs = fs.readdirSync(animationsDir).filter((dir) => {
      const fullPath = path.join(animationsDir, dir);
      return fs.statSync(fullPath).isDirectory() && dir !== '.' && dir !== '..';
    });

    const discoveredTypes = businessTypeDirs.map((dir) => ({
      key: dir,
      label: dir.charAt(0).toUpperCase() + dir.slice(1),
    }));

    const existingKeys = BUSINESS_TYPES.map((typeItem) => typeItem.key);
    const newTypes = discoveredTypes.filter((typeItem) => !existingKeys.includes(typeItem.key));

    if (newTypes.length > 0) {
      BUSINESS_TYPES = [...BUSINESS_TYPES, ...newTypes];
      console.log(
        `Discovered ${newTypes.length} additional business types: ${newTypes.map((typeItem) => typeItem.key).join(', ')}`
      );
    }
  } catch (error) {
    console.warn('Could not load business types from assets directory:', error.message);
  }
}

async function selectBusinessType(configBusinessType) {
  if (BUSINESS_TYPES.length === 0) {
    console.log(`  No business types found in assets. Using config value: ${configBusinessType}`);
    return configBusinessType;
  }

  const isConfigTypeValid = BUSINESS_TYPES.some((t) => t.key === configBusinessType);

  if (!isConfigTypeValid) {
    console.log(`  Business type "${configBusinessType}" from config not found in assets.`);
    console.log(`  Available types: ${BUSINESS_TYPES.map((t) => t.key).join(', ')}`);
  }

  const { useConfigType } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useConfigType',
      message: `Usar business type do config (${configBusinessType})?`,
      default: isConfigTypeValid,
    },
  ]);

  if (useConfigType) {
    return configBusinessType;
  }

  const choices = BUSINESS_TYPES.map((t) => ({
    name: `${t.label} (${t.key})`,
    value: t.key,
  }));

  const { selectedType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedType',
      message: 'Qual business type deseja usar?',
      choices,
    },
  ]);

  return selectedType;
}

function getBusinessTypes() {
  return BUSINESS_TYPES;
}

module.exports = {
  loadBusinessTypesFromAssets,
  selectBusinessType,
  getBusinessTypes,
};
