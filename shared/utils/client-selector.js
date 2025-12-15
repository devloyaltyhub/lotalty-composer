const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const logger = require('./logger');
const {
  CLIENTS_DIR,
  LOYALTY_APP_ROOT,
  getClientDir,
  getClientConfigPath,
} = require('./paths');

/**
 * Shared utility for client selection operations
 * Prevents DRY violations across CLI scripts
 */
class ClientSelector {
  constructor() {
    this.repoPath = LOYALTY_APP_ROOT;
    this.clientsPath = CLIENTS_DIR;
  }

  /**
   * List all available clients with valid config.json
   * @returns {string[]} Array of client folder names
   */
  listClients() {
    if (!fs.existsSync(this.clientsPath)) {
      return [];
    }

    return fs.readdirSync(this.clientsPath).filter((name) => {
      const clientPath = path.join(this.clientsPath, name);
      const configPath = path.join(clientPath, 'config.json');

      // Must be a directory with a valid config.json
      return fs.statSync(clientPath).isDirectory() && fs.existsSync(configPath);
    });
  }

  /**
   * Load client configuration from config.json
   * @param {string} clientName - Client folder name
   * @returns {Object} Parsed config.json
   */
  loadClientConfig(clientName) {
    const configPath = path.join(this.clientsPath, clientName, 'config.json');

    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found for client: ${clientName}`);
    }

    try {
      const content = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse config for ${clientName}: ${error.message}`);
    }
  }

  /**
   * Get client configuration path
   * @param {string} clientName - Client folder name
   * @returns {string} Absolute path to config.json
   */
  getClientConfigPath(clientName) {
    return path.join(this.clientsPath, clientName, 'config.json');
  }

  /**
   * Get client directory path
   * @param {string} clientName - Client folder name
   * @returns {string} Absolute path to client directory
   */
  getClientDir(clientName) {
    return path.join(this.clientsPath, clientName);
  }

  /**
   * Validate client name (prevent path traversal)
   * @param {string} clientName - Client name to validate
   * @returns {boolean} True if valid
   */
  validateClientName(clientName) {
    if (!clientName || typeof clientName !== 'string') {
      return false;
    }

    // Sanitize using path.basename
    const sanitized = path.basename(clientName);

    // Check for path traversal attempts
    if (sanitized !== clientName) {
      return false;
    }

    // Reject if contains path separators or special characters
    if (clientName.includes('..') || clientName.includes('/') || clientName.includes('\\')) {
      return false;
    }

    return true;
  }

  /**
   * Check if client exists
   * @param {string} clientName - Client folder name
   * @returns {boolean} True if client exists
   */
  clientExists(clientName) {
    const clients = this.listClients();
    return clients.includes(clientName);
  }

  /**
   * Interactive client selection prompt
   * @param {Object} options - Options for the prompt
   * @param {string} options.message - Custom message for the prompt
   * @param {Function} options.format - Custom format function for choices
   * @returns {Promise<string>} Selected client folder name
   */
  async selectClient(options = {}) {
    const clients = this.listClients();

    if (clients.length === 0) {
      logger.error('No clients found. Create a client first with: npm run create-client');
      throw new Error('No clients available');
    }

    const defaultFormat = (name, config) => {
      return `${config.clientName} (${config.clientCode}) - ${name}`;
    };

    const formatChoice = options.format || defaultFormat;
    const message = options.message || 'Select a client:';

    const choices = clients.map((name) => {
      try {
        const config = this.loadClientConfig(name);
        return {
          name: formatChoice(name, config),
          value: name,
        };
      } catch (error) {
        // If config can't be loaded, show just the folder name
        logger.warn(`Failed to load config for ${name}: ${error.message}`);
        return {
          name: `${name} (config error)`,
          value: name,
        };
      }
    });

    const { clientName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'clientName',
        message,
        choices,
      },
    ]);

    return clientName;
  }

  /**
   * Select client from argument or interactive prompt
   * @param {string} argClient - Client from command line argument
   * @param {Object} options - Options for interactive selection
   * @returns {Promise<string>} Selected client folder name
   */
  async selectClientOrPrompt(argClient = null, options = {}) {
    // If argument provided, validate and use it
    if (argClient) {
      if (!this.validateClientName(argClient)) {
        logger.error(
          `Invalid client name: "${argClient}". Name cannot contain special characters or paths.`
        );
        throw new Error('Invalid client name');
      }

      if (this.clientExists(argClient)) {
        logger.info(`Client selected via argument: ${argClient}`);
        return argClient;
      }

      logger.warn(`Client "${argClient}" not found. Proceeding to interactive selection.`);
    }

    // Fall back to interactive selection
    return await this.selectClient(options);
  }
}

// Export singleton instance
module.exports = new ClientSelector();
