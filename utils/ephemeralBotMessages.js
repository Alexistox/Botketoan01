/**
 * Tin riêng / lỗi tạm:
 * - Ưu tiên Telegram native ephemeral (ephemeral_message_parameters) trong nhóm
 * - Fallback: gửi công khai + xóa khi user gửi tin mới (DIY cũ)
 * - Private chat: gửi bình thường (đã riêng tư)
 *
 * /t và /v không dùng helper này — kết quả vẫn gửi công khai trong nhóm.
 */

const pendingByChat = new Map();

const chatKey = (chatId) => String(chatId);

const isPrivateChatId = (chatId) => {
  const n = Number(chatId);
  return Number.isFinite(n) && n > 0;
};

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
 * Xóa mọi tin fallback DIY đã đăng ký cho chat (gọi khi có tin nhắn từ người dùng không phải bot).
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

const isEphemeralUnsupportedError = (err) => {
  const msg = String(err && (err.message || err.description || err) || '');
  // Telegram thường trả 400 khi client/API chưa hỗ trợ field mới
  return (
    /ephemeral/i.test(msg) ||
    /unknown method/i.test(msg) ||
    /no such method/i.test(msg) ||
    /unexpected keyword/i.test(msg) ||
    (/Bad Request/i.test(msg) && /parameter/i.test(msg))
  );
};

/**
 * Toast ngắn trên callback (không spam tin vào nhóm).
 */
const answerToast = async (bot, callbackQueryId, text, showAlert = false) => {
  try {
    await bot.answerCallbackQuery(callbackQueryId, {
      text: String(text || '').slice(0, 190),
      show_alert: !!showAlert
    });
  } catch (_) {
    /* callback hết hạn */
  }
};

/**
 * Xóa ephemeral native (nếu API hỗ trợ).
 */
const deleteNativeEphemeral = async (bot, chatId, userId, ephemeralMessageId) => {
  const id = normalizeMessageId(ephemeralMessageId);
  if (id == null || userId == null) return false;
  try {
    await bot._request('deleteEphemeralMessage', {
      form: {
        chat_id: chatId,
        receiver_user_id: Number(userId),
        ephemeral_message_id: id
      }
    });
    return true;
  } catch (_) {
    try {
      await bot.deleteMessage(chatId, id);
      return true;
    } catch (__) {
      return false;
    }
  }
};

/**
 * Gửi tin chỉ user đích thấy trong nhóm (native ephemeral), hoặc fallback DIY.
 *
 * @param {object} bot
 * @param {object} opts
 * @param {number|string} opts.chatId
 * @param {number|string} [opts.userId] - bắt buộc trong nhóm để native ephemeral
 * @param {string} opts.text
 * @param {object} [opts.options] - parse_mode, reply_markup, …
 * @param {string} [opts.callbackQueryId]
 * @param {boolean} [opts.replaceCallbackQueryMessage]
 */
const sendPrivateNotice = async (bot, opts) => {
  const {
    chatId,
    userId,
    text,
    options = {},
    callbackQueryId,
    replaceCallbackQueryMessage = false
  } = opts;

  const rest = { ...options };
  // Strip helper-only keys if callers stuffed them into options
  delete rest.receiverUserId;
  delete rest.userId;

  const privateChat = isPrivateChatId(chatId);
  const ephParams = {};
  if (callbackQueryId) {
    ephParams.callback_query_id = String(callbackQueryId);
    if (userId != null) ephParams.receiver_user_id = Number(userId);
    if (replaceCallbackQueryMessage) ephParams.replace_callback_query_message = true;
  } else if (!privateChat && userId != null) {
    ephParams.receiver_user_id = Number(userId);
  }

  const tryNative = Object.keys(ephParams).length > 0;

  if (tryNative) {
    try {
      const sent = await bot.sendMessage(chatId, text, {
        ...rest,
        ephemeral_message_parameters: JSON.stringify(ephParams)
      });
      return { sent, native: true, fallback: false };
    } catch (err) {
      if (!isEphemeralUnsupportedError(err)) {
        // Một số lỗi mạng/khác — thử fallback; lỗi quyền parse vẫn fallback
        console.warn('Native ephemeral failed, falling back:', err.message || err);
      } else {
        console.warn('Native ephemeral unsupported, falling back:', err.message || err);
      }
    }
  }

  const sent = await bot.sendMessage(chatId, text, rest);
  if (sent && sent.message_id != null && !privateChat) {
    registerEphemeralBotError(chatId, sent.message_id);
  }
  return { sent, native: false, fallback: true };
};

/**
 * Tương thích API cũ (OCR): options có thể chứa userId / receiverUserId.
 */
const sendAndRegisterEphemeralError = async (bot, chatId, text, options = {}) => {
  const userId = options.receiverUserId != null ? options.receiverUserId : options.userId;
  const rest = { ...options };
  delete rest.receiverUserId;
  delete rest.userId;
  const { sent } = await sendPrivateNotice(bot, {
    chatId,
    userId,
    text,
    options: rest
  });
  return sent;
};

/** Thông báo thiếu quyền operator — ephemeral, không spam nhóm. */
const notifyNoOperator = async (bot, chatId, userId) => {
  await sendPrivateNotice(bot, {
    chatId,
    userId,
    text: '⛔ 需要操作员权限'
  });
};

module.exports = {
  registerEphemeralBotError,
  deleteRegisteredEphemeralErrors,
  sendAndRegisterEphemeralError,
  sendPrivateNotice,
  answerToast,
  notifyNoOperator,
  deleteNativeEphemeral
};
