/**
 * Client Loader
 *
 * Loads client configuration from white_label_app/config.json.
 */

const fs = require('fs');
const { WHITE_LABEL_CONFIG } = require('../../../shared/utils/paths');

/**
 * Load client config from white_label_app/config.json
 * @returns {{ clientCode: string, clientName: string, bundleId: string } | null}
 */
function loadConfiguredClient() {
  if (!fs.existsSync(WHITE_LABEL_CONFIG)) {
    return null;
  }

  try {
    const config = JSON.parse(fs.readFileSync(WHITE_LABEL_CONFIG, 'utf8'));
    return {
      clientCode: config.clientCode,
      clientName: config.clientName,
      bundleId: config.bundleId,
    };
  } catch {
    return null;
  }
}

module.exports = { loadConfiguredClient };
