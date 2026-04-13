/**
 * Tin lỗi tạm từ bot (nhận diện ảnh/pic): đăng ký message_id để xóa khi có tin user mới trong cùng chat.
 * Chỉ lưu trong bộ nhớ (mất khi restart process).
 */

const pendingByChat = new Map();

const chatKey = (chatId) => String(chatId);

const normalizeMessageId = (messageId) => {
  if (messageId == null || messageId === '') return null;
  const id = typeof messageId === 'number' ? messageId : parseInt(String(messageId), 10);
  return Number.isFinite(id) ? id : null;
};

const registerEphemeralBotError = (chatId, messageId) => {
  const id = normalizeMessageId(messageId);
  if (id == null) return;
  const key = chatKey(chatId);
  if (!pendingByChat.has(key)) pendingByChat.set(key, new Set());
  pendingByChat.get(key).add(id);
};

/**
 * Xóa mọi tin lỗi đã đăng ký cho chat (gọi khi có tin nhắn từ người dùng không phải bot).
 */
const deleteRegisteredEphemeralErrors = async (bot, chatId) => {
  const key = chatKey(chatId);
  const set = pendingByChat.get(key);
  if (!set || set.size === 0) return;
  const ids = [...set];
  pendingByChat.delete(key);
  await Promise.all(
    ids.map((mid) =>
      bot.deleteMessage(chatId, mid).catch(() => {
        /* quyền / tin quá cũ */
      })
    )
  );
};

const sendAndRegisterEphemeralError = async (bot, chatId, text, options = {}) => {
  const sent = await bot.sendMessage(chatId, text, options);
  if (sent && sent.message_id != null) {
    registerEphemeralBotError(chatId, sent.message_id);
  }
  return sent;
};

module.exports = {
  registerEphemeralBotError,
  deleteRegisteredEphemeralErrors,
  sendAndRegisterEphemeralError
};
