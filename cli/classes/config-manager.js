const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const CONFIG_FILE = path.join(__dirname, '..', '..', '.loyalty-cli-config.json');

class ConfigManager {
  constructor() {
    this.config = this.loadConfig();
    this.lastError = null;
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.lastError = error;
      console.warn(
        chalk.yellow(`Could not load CLI config (${error.code || error.message}), using defaults`)
      );
    }
    return {
      lastClient: null,
      favoriteWorkflows: [],
    };
  }

  saveConfig() {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
      this.lastError = null;
      return true;
    } catch (error) {
      this.lastError = error;
      console.warn(chalk.yellow(`Could not save CLI config: ${error.message}`));
      return false;
    }
  }

  isHealthy() {
    return this.lastError === null;
  }

  setLastClient(clientName) {
    this.config.lastClient = clientName;
    this.saveConfig();
  }

  getLastClient() {
    return this.config.lastClient;
  }
}

module.exports = ConfigManager;
