/**
 * Telegram chat action "typing" — hiện bubble đang nhập.
 * Action tự hết ~5s nên cần refresh định kỳ khi xử lý lâu (OCR).
 */

const TYPING_REFRESH_MS = 4000;
const DEFAULT_SEND_TYPING_DELAY_MS = 400;

async function sendTypingOnce(bot, chatId) {
  try {
    await bot.sendChatAction(chatId, 'typing');
  } catch (_) {
    /* Không làm hỏng luồng chính nếu action lỗi */
  }
}

/**
 * Bắt đầu typing và refresh mỗi ~4s.
 * @returns {() => void} stop — gọi khi xong xử lý
 */
function startTyping(bot, chatId) {
  let stopped = false;
  let timer = null;

  sendTypingOnce(bot, chatId);

  timer = setInterval(() => {
    if (stopped) return;
    sendTypingOnce(bot, chatId);
  }, TYPING_REFRESH_MS);

  return function stop() {
    if (stopped) return;
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/**
 * Bọc bot.sendMessage: trước mỗi tin hiện "đang nhập…" một nhịp ngắn.
 * Gọi một lần sau khi tạo bot.
 */
function enableTypingBeforeSend(bot, { delayMs = DEFAULT_SEND_TYPING_DELAY_MS } = {}) {
  if (!bot || typeof bot.sendMessage !== 'function') return bot;
  if (bot.__typingBeforeSendEnabled) return bot;

  const originalSendMessage = bot.sendMessage.bind(bot);

  bot.sendMessage = function sendMessageWithTyping(chatId, text, options) {
    return (async () => {
      await sendTypingOnce(bot, chatId);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return originalSendMessage(chatId, text, options);
    })();
  };

  bot.__typingBeforeSendEnabled = true;
  return bot;
}

module.exports = {
  startTyping,
  sendTypingOnce,
  enableTypingBeforeSend
};
