/**
 * Centralized path configuration for loyalty-compose
 *
 * This module provides consistent paths to various directories across the loyalty ecosystem.
 * loyalty-compose is a sibling directory to loyalty-app and loyalty-credentials.
 *
 * Directory structure:
 *   loyaltyhub/
 *   ├── loyalty-compose/     <- This project (automation/CLI tools)
 *   ├── loyalty-app/         <- Flutter white-label app
 *   ├── loyalty-credentials/ <- Credentials and certificates
 *   ├── loyalty-admin-main/  <- Admin dashboard
 *   └── loyalty-cloud-service/ <- Cloud functions
 */

const path = require('path');

// loyalty-compose root (this project)
const COMPOSE_ROOT = path.resolve(__dirname, '../..');

// Parent directory (loyaltyhub/)
const LOYALTYHUB_ROOT = path.resolve(COMPOSE_ROOT, '..');

// Sibling project roots
const LOYALTY_APP_ROOT = path.join(LOYALTYHUB_ROOT, 'loyalty-app');
const LOYALTY_CREDENTIALS_ROOT = path.join(LOYALTYHUB_ROOT, 'loyalty-credentials');
const LOYALTY_ADMIN_ROOT = path.join(LOYALTYHUB_ROOT, 'loyalty-admin-main');
const LOYALTY_CLOUD_SERVICE_ROOT = path.join(LOYALTYHUB_ROOT, 'loyalty-cloud-service');

// Key directories within loyalty-compose
const CLIENTS_DIR = path.join(COMPOSE_ROOT, 'clients');
const SHARED_ASSETS_DIR = path.join(COMPOSE_ROOT, 'shared', 'shared_assets');
const TEMPLATES_DIR = path.join(COMPOSE_ROOT, 'shared', 'templates');
const LOGS_DIR = path.join(COMPOSE_ROOT, 'logs');

// Key directories within loyalty-app
const WHITE_LABEL_APP_ROOT = path.join(LOYALTY_APP_ROOT, 'white_label_app');
const WHITE_LABEL_ASSETS_DIR = path.join(WHITE_LABEL_APP_ROOT, 'assets');
const WHITE_LABEL_METADATA_DIR = path.join(WHITE_LABEL_APP_ROOT, 'metadata');
const WHITE_LABEL_SCREENSHOTS_DIR = path.join(WHITE_LABEL_APP_ROOT, 'screenshots');

// Key files
const WHITE_LABEL_PUBSPEC = path.join(WHITE_LABEL_APP_ROOT, 'pubspec.yaml');
const WHITE_LABEL_CONFIG = path.join(WHITE_LABEL_APP_ROOT, 'config.json');

module.exports = {
  // Roots
  COMPOSE_ROOT,
  LOYALTYHUB_ROOT,
  LOYALTY_APP_ROOT,
  LOYALTY_CREDENTIALS_ROOT,
  LOYALTY_ADMIN_ROOT,
  LOYALTY_CLOUD_SERVICE_ROOT,

  // Compose directories
  CLIENTS_DIR,
  SHARED_ASSETS_DIR,
  TEMPLATES_DIR,
  LOGS_DIR,

  // White label app paths
  WHITE_LABEL_APP_ROOT,
  WHITE_LABEL_ASSETS_DIR,
  WHITE_LABEL_METADATA_DIR,
  WHITE_LABEL_SCREENSHOTS_DIR,
  WHITE_LABEL_PUBSPEC,
  WHITE_LABEL_CONFIG,
};
