const fs = require('fs');
const path = require('path');
const { SHARED_ASSETS_DIR } = require('../../../shared/utils/paths');
const { Logger } = require('./logger');

const COMPOSE_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SETUP_SCRIPT_PATH = path.join(
  COMPOSE_ROOT,
  'loyalty-composer',
  '01-client-setup',
  'steps',
  'setup-white-label.js'
);

class BusinessTypeRepository {
  static getExistingTypes() {
    const typesFromAssets = this._getTypesFromAssets();
    if (typesFromAssets.length > 0) {
      return typesFromAssets;
    }

    return this._getTypesFromSetupScript();
  }

  static _getTypesFromAssets() {
    try {
      const animationsDir = path.join(SHARED_ASSETS_DIR, 'animations');
      if (!fs.existsSync(animationsDir)) {
        return [];
      }

      return fs
        .readdirSync(animationsDir)
        .filter((item) => {
          const fullPath = path.join(animationsDir, item);
          const stats = fs.statSync(fullPath);
          return stats.isDirectory() && !item.startsWith('.');
        })
        .map((key) => ({
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
        }));
    } catch (error) {
      Logger.warning(`Could not read business types from assets: ${error.message}`);
      return [];
    }
  }

  static _getTypesFromSetupScript() {
    try {
      const setupContent = fs.readFileSync(SETUP_SCRIPT_PATH, 'utf8');
      const match = setupContent.match(/let BUSINESS_TYPES = \[([\s\S]*?)\];/);

      if (match) {
        const businessTypesStr = match[1];
        const types = [];
        const typeMatches = businessTypesStr.matchAll(
          /{\s*key:\s*"([^"]+)",\s*label:\s*"([^"]+)"\s*}/g
        );

        for (const typeMatch of typeMatches) {
          types.push({
            key: typeMatch[1],
            label: typeMatch[2],
          });
        }
        return types;
      }
    } catch (error) {
      Logger.warning('Could not read existing business types from setup script');
    }

    return [
      { key: 'coffee', label: 'Cafeteria' },
      { key: 'beer', label: 'Cervejaria' },
    ];
  }
}

module.exports = { BusinessTypeRepository };
