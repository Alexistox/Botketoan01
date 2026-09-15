/**
 * Telegram chat action "typing" — hiện bubble đang nhập.
 * Action tự hết ~5s nên cần refresh định kỳ khi xử lý lâu (OCR).
 */

const TYPING_REFRESH_MS = 4000;

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

module.exports = {
  startTyping,
  sendTypingOnce
};
