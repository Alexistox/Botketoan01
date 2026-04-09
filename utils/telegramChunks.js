/**
 * Chia tin nhắn Telegram (giới hạn 4096 ký tự) và gửi Markdown an toàn.
 */

/** Độ dài tối đa mỗi phần nội dung (còn chừa prefix phần và biên Markdown). */
const DEFAULT_CHUNK_BODY = 3900;

/**
 * Chia chuỗi thành nhiều phần ≤ maxLen (ưu tiên cắt tại xuống dòng).
 * @param {string} text
 * @param {number} [maxLen=DEFAULT_CHUNK_BODY]
 * @returns {string[]}
 */
function splitTelegramText(text, maxLen = DEFAULT_CHUNK_BODY) {
  if (!text || text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    const slice = remaining.slice(0, maxLen);
    let breakPos = maxLen;
    const lastNl = slice.lastIndexOf('\n');
    if (lastNl > maxLen * 0.12) breakPos = lastNl + 1;
    let part = remaining.slice(0, breakPos);
    if (part.length === 0) {
      part = remaining.slice(0, maxLen);
      breakPos = maxLen;
    }
    chunks.push(part.replace(/\s+$/, ''));
    remaining = remaining.slice(breakPos).replace(/^\s+/, '');
  }
  return chunks;
}

function isMarkdownParseError(err) {
  const desc = err?.response?.body?.description || err?.message || '';
  return /parse entities|can't parse|Bad Request/i.test(String(desc));
}

/**
 * @param {import('node-telegram-bot-api').TelegramBot} bot
 * @param {number|string} chatId
 * @param {string} body
 * @param {{ parse_mode?: string, reply_markup?: object, reply_to_message_id?: number }} opts
 */
async function sendOneMessage(bot, chatId, body, opts) {
  const { parse_mode, reply_markup, reply_to_message_id } = opts;
  const threadOpts =
    reply_to_message_id != null && Number.isFinite(Number(reply_to_message_id))
      ? { reply_to_message_id: Number(reply_to_message_id) }
      : {};
  try {
    await bot.sendMessage(chatId, body, {
      ...(parse_mode && { parse_mode }),
      ...(reply_markup && { reply_markup }),
      ...threadOpts
    });
  } catch (err) {
    if (parse_mode && isMarkdownParseError(err)) {
      await bot.sendMessage(chatId, body, threadOpts);
      return;
    }
    throw err;
  }
}

/**
 * Gửi báo cáo Markdown; nếu dài thì chia nhiều tin. Chỉ chunk đầu nhận reply_markup.
 * @param {import('node-telegram-bot-api').TelegramBot} bot
 * @param {number|string} chatId
 * @param {string} text
 * @param {{ reply_markup?: object, parse_mode?: string, reply_to_message_id?: number }} [options]
 */
async function sendLongMarkdownMessage(bot, chatId, text, options = {}) {
  const parse_mode = options.parse_mode || 'Markdown';
  const reply_markup = options.reply_markup;
  const reply_to_message_id = options.reply_to_message_id;
  const chunks = splitTelegramText(text, DEFAULT_CHUNK_BODY);
  const total = chunks.length;
  for (let i = 0; i < total; i += 1) {
    const body = total > 1 ? `(${i + 1}/${total})\n${chunks[i]}` : chunks[i];
    const markup = i === 0 ? reply_markup : undefined;
    const threadId = i === 0 ? reply_to_message_id : undefined;
    await sendOneMessage(bot, chatId, body, {
      parse_mode,
      reply_markup: markup,
      reply_to_message_id: threadId
    });
  }
}

module.exports = {
  splitTelegramText,
  sendLongMarkdownMessage,
  DEFAULT_CHUNK_BODY
};
