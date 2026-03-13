const TelegramBot = require('node-telegram-bot-api');
const logger = require('./logger');

class TelegramNotifier {
  constructor() {
    this.bot = null;
    this.chatId = null;
    this.enabled = false;

    this.initialize();
  }

  // Initialize Telegram bot
  initialize() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      logger.warn(
        'Telegram notifications disabled (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)'
      );
      return;
    }

    try {
      this.bot = new TelegramBot(token, { polling: false });
      this.chatId = chatId;
      this.enabled = true;
      logger.info('Telegram notifications enabled');
    } catch (error) {
      logger.warn(`Telegram initialization failed: ${error.message}`);
    }
  }

  // Send a message
  async send(message) {
    if (!this.enabled) {
      return;
    }

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.warn(`Failed to send Telegram notification: ${error.message}`);
    }
  }

  // Client creation started
  async clientCreationStarted(clientName, clientCode) {
    const message = `
🚀 *LoyaltyHub Automation*

📱 Creating new client...
*Name:* ${clientName}
*Code:* ${clientCode}
*Status:* 🔄 In Progress
    `.trim();

    await this.send(message);
  }

  // Firebase project created
  async firebaseProjectCreated(clientName, projectId) {
    const message = `
✅ *Firebase Project Created*

*Client:* ${clientName}
*Project ID:* \`${projectId}\`
*Services:* Auth, Firestore, Storage, Crashlytics
    `.trim();

    await this.send(message);
  }

  // Build started
  async buildStarted(clientName, platforms) {
    const platformList = platforms.join(', ');
    const message = `
🔨 *Build Started*

*Client:* ${clientName}
*Platforms:* ${platformList}
*Status:* Building...
    `.trim();

    await this.send(message);
  }

  // Build completed
  async buildCompleted(clientName, version, buildNumber, platforms) {
    const platformList = platforms.map((p) => `• ${p}: v${version}+${buildNumber}`).join('\n');
    const message = `
✅ *Build Completed*

*Client:* ${clientName}
*Version:* ${version}
*Build:* ${buildNumber}

*Platforms:*
${platformList}
    `.trim();

    await this.send(message);
  }

  // Deployment started
  async deploymentStarted(clientName, platforms) {
    const platformList = platforms.join(', ');
    const message = `
📤 *Deployment Started*

*Client:* ${clientName}
*Platforms:* ${platformList}
*Status:* Uploading to app stores...
    `.trim();

    await this.send(message);
  }

  // Deployment completed
  async deploymentCompleted(clientName, version, buildNumber, platforms, gitTag, duration) {
    const platformList = platforms
      .map((p) => {
        const store = p === 'android' ? 'Play Store (Internal)' : 'TestFlight';
        return `• ${p}: ${store}`;
      })
      .join('\n');

    const message = `
✅ *Deployment Complete*

*Client:* ${clientName}
*Version:* ${version}+${buildNumber}
*Git Tag:* \`${gitTag}\`

*Deployed to:*
${platformList}

⏱ *Duration:* ${duration}
    `.trim();

    await this.send(message);
  }

  // Admin credentials
  async adminCredentials(clientName, clientCode, email, password) {
    const message = `
🔐 *Admin Credentials Created*

*Client:* ${clientName}
*Code:* ${clientCode}

*Login Details:*
\`\`\`
Client Code: ${clientCode}
Email: ${email}
Password: ${password}
\`\`\`

⚠️ *Save these credentials securely!*
📲 Share with client to login to Admin App
🔐 Change password on first login
    `.trim();

    await this.send(message);
  }

  // Client creation completed
  // NOTE: This method is deprecated and no longer used in Phase 01
  // It was used when client creation included build & deploy
  // Now build & deploy is done separately in Phase 02
  async clientCreationCompleted(data) {
    const { clientName, clientCode, version, buildNumber, platforms, duration } = data;

    const platformList = platforms.join(', ');

    const message = `
🎉 *Client Created Successfully!*

*Client:* ${clientName} (${clientCode})
*Version:* ${version}+${buildNumber}
*Platforms:* ${platformList}

*Git Info:*
• Branch: \`main\`

⏱ *Total Time:* ${duration}

✅ All systems ready!
    `.trim();

    await this.send(message);
  }

  // Error notification
  async error(clientName, errorMessage, step) {
    const message = `
❌ *Automation Failed*

*Client:* ${clientName}
*Step:* ${step}

*Error:*
\`\`\`
${errorMessage}
\`\`\`

⚠️ Check logs for details
    `.trim();

    await this.send(message);
  }

  // Rollback started
  async rollbackStarted(clientName, fromVersion, toVersion) {
    const message = `
🔄 *Rollback Started*

*Client:* ${clientName}
*From:* ${fromVersion}
*To:* ${toVersion}
*Status:* Rolling back...
    `.trim();

    await this.send(message);
  }

  // Rollback completed
  async rollbackCompleted(clientName, version, gitTag) {
    const message = `
✅ *Rollback Completed*

*Client:* ${clientName}
*Version:* ${version}
*Git Tag:* \`${gitTag}\`

🔄 Apps redeployed successfully
    `.trim();

    await this.send(message);
  }

  // Update started
  async updateStarted(clientName, newVersion) {
    const message = `
🔄 *Update Started*

*Client:* ${clientName}
*New Version:* ${newVersion}
*Status:* Rebuilding...
    `.trim();

    await this.send(message);
  }

  // Update completed
  async updateCompleted(clientName, version, buildNumber, platforms) {
    const platformList = platforms.join(', ');
    const message = `
✅ *Update Completed*

*Client:* ${clientName}
*Version:* ${version}+${buildNumber}
*Platforms:* ${platformList}

🚀 New version deployed
    `.trim();

    await this.send(message);
  }
}

// Export singleton instance
module.exports = new TelegramNotifier();
