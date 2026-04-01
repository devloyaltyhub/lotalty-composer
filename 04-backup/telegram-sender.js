/**
 * Minimal TelegramSender for backup notifications.
 * Extracted from @loyaltyhub/reports to keep composer self-contained.
 */
class TelegramSender {
  constructor({ botToken, chatId }) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  isConfigured() {
    return Boolean(this.botToken && this.chatId);
  }

  async sendMessage(message) {
    if (!this.botToken || !this.chatId) {
      console.log('[TelegramSender] Not configured - message not sent');
      return false;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: message,
            parse_mode: 'Markdown',
          }),
        }
      );

      if (response.ok) {
        return true;
      }

      console.error('[TelegramSender] Send failed:', await response.text());
      return false;
    } catch (error) {
      console.error('[TelegramSender] Error:', error);
      return false;
    }
  }
}

module.exports = { TelegramSender };
