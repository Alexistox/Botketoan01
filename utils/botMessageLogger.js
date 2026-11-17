/**
 * Ghi log tin nhắn bot gửi ra vào MessageLog (một lần / mỗi send*).
 * Bọc `_request` để bắt cả sendMessage và sendRichMessage.
 */

const MessageLog = require('../models/MessageLog');
const { logMessage } = require('./telegramUtils');

const LOG_PATHS =
  /^(sendMessage|sendRichMessage|sendPhoto|sendVideo|sendAnimation|sendDocument|sendVoice|sendAudio|sendSticker)$/i;

/**
 * @param {import('node-telegram-bot-api')} bot
 */
function installBotMessageLogger(bot) {
  if (!bot || bot.__messageLogWrapped) return bot;
  bot.__messageLogWrapped = true;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (typeof bot._request !== 'function') return bot;

  const originalRequest = bot._request.bind(bot);
  bot._request = async function wrappedRequest(path, options = {}) {
    const result = await originalRequest(path, options);
    try {
      const name = String(path || '').split('?')[0];
      if (
        LOG_PATHS.test(name) &&
        result &&
        typeof result === 'object' &&
        result.chat &&
        result.message_id != null
      ) {
        await logMessage(result, token, MessageLog, { forceBot: true });
      }
    } catch (err) {
      console.warn(
        '[botMessageLogger]',
        err && err.message ? err.message : err
      );
    }
    return result;
  };

  return bot;
}

module.exports = { installBotMessageLogger };
