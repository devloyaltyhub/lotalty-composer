/**
 * Centralized path configuration for loyalty-composer
 *
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH for all paths in the project.
 * All scripts MUST import paths from this module instead of defining them locally.
 *
 * Directory structure:
 *   loyaltyhub/
 *   ├── loyalty-composer/     <- This project (automation/CLI tools)
 *   ├── loyalty-app/          <- Flutter white-label app + clients configs
 *   │   ├── clients/          <- Client-specific configurations
 *   │   └── white_label_app/  <- Flutter app source
 *   ├── loyalty-credentials/  <- Certificates and provisioning profiles
 *   ├── loyalty-admin-main/   <- Admin dashboard
 *   └── loyalty-cloud-service/ <- Cloud functions
 */

const path = require('path');

// =============================================================================
// ROOT DIRECTORIES
// =============================================================================

// loyalty-composer root (this project)
const COMPOSE_ROOT = path.resolve(__dirname, '../..');

// Parent directory (loyaltyhub/)
const LOYALTYHUB_ROOT = path.resolve(COMPOSE_ROOT, '..');

// Sibling project roots
const LOYALTY_APP_ROOT = path.join(LOYALTYHUB_ROOT, 'loyalty-app');
const LOYALTY_CREDENTIALS_ROOT = path.join(LOYALTYHUB_ROOT, 'loyalty-credentials');
const LOYALTY_ADMIN_ROOT = path.join(LOYALTYHUB_ROOT, 'loyalty-admin-main');
const LOYALTY_CLOUD_SERVICE_ROOT = path.join(LOYALTYHUB_ROOT, 'loyalty-cloud-service');

// =============================================================================
// LOYALTY-COMPOSER DIRECTORIES
// =============================================================================

const SHARED_ASSETS_DIR = path.join(COMPOSE_ROOT, 'shared', 'shared_assets');
const TEMPLATES_DIR = path.join(COMPOSE_ROOT, 'shared', 'templates');
const LOGS_DIR = path.join(COMPOSE_ROOT, 'logs');
const FASTLANE_DIR = path.join(COMPOSE_ROOT, '02-build-deploy', 'fastlane');

// =============================================================================
// LOYALTY-APP DIRECTORIES (where clients and white_label_app live)
// =============================================================================

// IMPORTANT: clients/ is inside loyalty-app, NOT loyalty-composer
const CLIENTS_DIR = path.join(LOYALTY_APP_ROOT, 'clients');

// White label app paths
const WHITE_LABEL_APP_ROOT = path.join(LOYALTY_APP_ROOT, 'white_label_app');
const WHITE_LABEL_ASSETS_DIR = path.join(WHITE_LABEL_APP_ROOT, 'assets');
const WHITE_LABEL_CLIENT_ASSETS_DIR = path.join(WHITE_LABEL_ASSETS_DIR, 'client_specific_assets');
const WHITE_LABEL_METADATA_DIR = path.join(WHITE_LABEL_APP_ROOT, 'metadata');
const WHITE_LABEL_SCREENSHOTS_DIR = path.join(WHITE_LABEL_APP_ROOT, 'screenshots');

// Key files within white_label_app
const WHITE_LABEL_PUBSPEC = path.join(WHITE_LABEL_APP_ROOT, 'pubspec.yaml');
const WHITE_LABEL_CONFIG = path.join(WHITE_LABEL_APP_ROOT, 'config.json');

// =============================================================================
// LOYALTY-CREDENTIALS DIRECTORIES
// =============================================================================

const CREDENTIALS_CLIENTS_DIR = path.join(LOYALTY_CREDENTIALS_ROOT, 'clients');
const CREDENTIALS_CERTS_DIR = path.join(LOYALTY_CREDENTIALS_ROOT, 'certs');

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get path to a specific client's directory
 * @param {string} clientCode - The client code (e.g., 'demo', 'na-rede')
 * @returns {string} Absolute path to client directory
 */
function getClientDir(clientCode) {
  return path.join(CLIENTS_DIR, clientCode);
}

/**
 * Get path to a specific client's config.json
 * @param {string} clientCode - The client code
 * @returns {string} Absolute path to config.json
 */
function getClientConfigPath(clientCode) {
  return path.join(CLIENTS_DIR, clientCode, 'config.json');
}

/**
 * Get path to a specific client's credentials directory (in loyalty-credentials)
 * @param {string} clientCode - The client code
 * @returns {string} Absolute path to credentials directory
 */
function getClientCredentialsDir(clientCode) {
  return path.join(CREDENTIALS_CLIENTS_DIR, clientCode);
}

/**
 * Get path to a specific client's Android credentials
 * @param {string} clientCode - The client code
 * @returns {string} Absolute path to Android credentials directory
 */
function getClientAndroidCredentials(clientCode) {
  return path.join(CREDENTIALS_CLIENTS_DIR, clientCode, 'android');
}

/**
 * Get path to a specific client's iOS credentials
 * @param {string} clientCode - The client code
 * @returns {string} Absolute path to iOS credentials directory
 */
function getClientIosCredentials(clientCode) {
  return path.join(CREDENTIALS_CLIENTS_DIR, clientCode, 'ios');
}

module.exports = {
  // Roots
  COMPOSE_ROOT,
  LOYALTYHUB_ROOT,
  LOYALTY_APP_ROOT,
  LOYALTY_CREDENTIALS_ROOT,
  LOYALTY_ADMIN_ROOT,
  LOYALTY_CLOUD_SERVICE_ROOT,

  // Compose directories
  SHARED_ASSETS_DIR,
  TEMPLATES_DIR,
  LOGS_DIR,
  FASTLANE_DIR,

  // Client directories (in loyalty-app)
  CLIENTS_DIR,

  // White label app paths
  WHITE_LABEL_APP_ROOT,
  WHITE_LABEL_ASSETS_DIR,
  WHITE_LABEL_CLIENT_ASSETS_DIR,
  WHITE_LABEL_METADATA_DIR,
  WHITE_LABEL_SCREENSHOTS_DIR,
  WHITE_LABEL_PUBSPEC,
  WHITE_LABEL_CONFIG,

  // Credentials paths
  CREDENTIALS_CLIENTS_DIR,
  CREDENTIALS_CERTS_DIR,

  // Helper functions
  getClientDir,
  getClientConfigPath,
  getClientCredentialsDir,
  getClientAndroidCredentials,
  getClientIosCredentials,
};
