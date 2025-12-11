const fs = require('fs');
const path = require('path');
const { validateHexColor } = require('../../shared/input-validator');

// Constants
const HEX_COLOR_WITH_ALPHA = 8;
const HEX_COLOR_WITHOUT_ALPHA = 6;
const HEX_ALPHA_START_INDEX = 6;
const HEX_RGB_END_INDEX = 6;

/**
 * Convert hex color to Dart Color format
 * @param {string} hex - Hex color (e.g., "#5D32B3" or "#FFFFFF1A")
 * @returns {string} - Dart color format (e.g., "0xFF5D32B3" or "0x1AFFFFFF")
 */
function hexToDartColor(hex) {
  const validatedHex = validateHexColor(hex, 'hex color');
  hex = validatedHex.replace('#', '');

  if (hex.length === HEX_COLOR_WITH_ALPHA) {
    const alpha = hex.substring(HEX_ALPHA_START_INDEX, HEX_COLOR_WITH_ALPHA);
    const rgbValue = hex.substring(0, HEX_RGB_END_INDEX);
    return `0x${alpha.toUpperCase()}${rgbValue.toUpperCase()}`;
  }

  if (hex.length === HEX_COLOR_WITHOUT_ALPHA) {
    return `0xFF${hex.toUpperCase()}`;
  }

  throw new Error(`Invalid hex color format: ${hex}`);
}

function replaceColorPlaceholders(content, colors) {
  let updatedContent = content;

  if (colors) {
    for (const [colorName, colorValue] of Object.entries(colors)) {
      const dartColor = hexToDartColor(colorValue);
      const placeholder = new RegExp(`\\{\\{colors\\.${colorName}\\}\\}`, 'g');
      updatedContent = updatedContent.replace(placeholder, dartColor);
    }
  }

  return updatedContent;
}

function replaceBasicPlaceholders(content, clientConfig) {
  let updatedContent = content;

  updatedContent = updatedContent.replace(/\{\{clientCode\}\}/g, clientConfig.clientCode);
  updatedContent = updatedContent.replace(/\{\{companyHint\}\}/g, clientConfig.companyHint);
  updatedContent = updatedContent.replace(/\{\{appName\}\}/g, clientConfig.appName);
  updatedContent = updatedContent.replace(
    /\{\{storeUrls\.android\}\}/g,
    clientConfig.storeUrls.android
  );
  updatedContent = updatedContent.replace(/\{\{storeUrls\.ios\}\}/g, clientConfig.storeUrls.ios);
  updatedContent = updatedContent.replace(/\{\{businessType\}\}/g, clientConfig.businessType);

  return updatedContent;
}

/**
 * Load and process template file
 * @param {string} templateName - Name of template file
 * @param {object} clientConfig - Client configuration object
 * @param {string} templatesDir - Templates directory path
 * @returns {string} - Processed template content
 */
function generateFromTemplate(templateName, clientConfig, templatesDir) {
  const templatePath = path.join(templatesDir, templateName);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  let content = fs.readFileSync(templatePath, 'utf8');

  content = replaceBasicPlaceholders(content, clientConfig);
  content = replaceColorPlaceholders(content, clientConfig.colors);

  return content;
}

function writeUserConfigsFile(clientConfig, targetRoot, templatesDir) {
  const userConfigsContent = generateFromTemplate(
    'user_configs.dart.template',
    clientConfig,
    templatesDir
  );
  const userConfigsPath = path.join(targetRoot, 'lib/src/utils/user_configs.dart');
  fs.mkdirSync(path.dirname(userConfigsPath), { recursive: true });
  fs.writeFileSync(userConfigsPath, userConfigsContent, 'utf8');
  console.log(`  ✅ Generated: lib/src/utils/user_configs.dart`);
}

function writeThemeConstantsFile(clientConfig, targetRoot, templatesDir) {
  const themeConstantsContent = generateFromTemplate(
    'theme_constants.dart.template',
    clientConfig,
    templatesDir
  );
  const themeConstantsPath = path.join(targetRoot, 'lib/src/ui/core/theme_constants.dart');
  fs.mkdirSync(path.dirname(themeConstantsPath), { recursive: true });
  fs.writeFileSync(themeConstantsPath, themeConstantsContent, 'utf8');
  console.log(`  ✅ Generated: lib/src/ui/core/theme_constants.dart`);
}

/**
 * Generate Dart configuration files from templates
 * @param {object} clientConfig - Client configuration object
 * @param {string} targetRoot - Target root directory
 * @param {string} templatesDir - Templates directory path
 */
function generateDartFiles(clientConfig, targetRoot, templatesDir) {
  console.log('🎨 Generating Dart configuration files from templates...');

  try {
    writeUserConfigsFile(clientConfig, targetRoot, templatesDir);
    writeThemeConstantsFile(clientConfig, targetRoot, templatesDir);

    console.log('✅ Dart configuration files generated successfully!');
  } catch (error) {
    console.error('❌ Error generating Dart files:', error.message);
    throw error;
  }
}

/**
 * Load client configuration from config.json
 * @param {string} clientName - Client name
 * @param {string} clientsDir - Clients directory path
 * @returns {object} - Client configuration object
 */
function loadClientConfig(clientName, clientsDir) {
  const configPath = path.join(clientsDir, clientName, 'config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse config.json for ${clientName}: ${error.message}`);
  }
}

module.exports = {
  hexToDartColor,
  generateFromTemplate,
  generateDartFiles,
  loadClientConfig,
};
