/**
 * Gửi báo cáo: luôn sendMessage full ngay (không draft, không editMessageText).
 */

const { sendLongMarkdownMessage, splitTelegramText } = require('./telegramChunks');

/**
 * Khung skeleton — giữ export để tương thích / test cũ.
 */
function buildReportSkeleton(html) {
  const lines = String(html || '').split('\n');
  const out = [];
  let skippingTxns = false;

  const isListHeader = (line) =>
    /<b>已入账<\/b>/.test(line) ||
    /<b>已下发<\/b>/.test(line) ||
    /^已入账/.test(line.trim()) ||
    (/^已下发/.test(line.trim()) && !/应下发|未下发|已下发\s*:/.test(line));

  const isSummaryLine = (line) =>
    /总入款|总出款|费率|汇率|应下发|未下发|卡额度|入款费率|出款费率|例如/.test(line) ||
    /^已下发\s*:/.test(line.trim());

  for (const line of lines) {
    if (isListHeader(line)) {
      out.push(line);
      skippingTxns = true;
      continue;
    }
    if (skippingTxns) {
      if (!line.trim()) {
        out.push(line);
        continue;
      }
      if (isSummaryLine(line) || isListHeader(line)) {
        skippingTxns = isListHeader(line);
        out.push(line);
        continue;
      }
      continue;
    }
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** [khung, full] — giữ export; reveal hiện không dùng. */
function buildRevealStages(html) {
  const text = String(html || '').trim();
  if (!text) return [];
  const skeleton = buildReportSkeleton(text);
  if (!skeleton || skeleton === text) return [text];
  if (skeleton.length >= text.length - 8) return [text];
  return [skeleton, text];
}

/**
 * Gửi báo cáo full ngay bằng sendMessage (chia chunk nếu dài).
 * @param {object} bot
 * @param {string|number} chatId
 * @param {string} html
 * @param {{ reply_markup?: object, reply_to_message_id?: number, parse_mode?: string, delayMs?: number }} [options]
 */
async function sendReportWithReveal(bot, chatId, html, options = {}) {
  const parse_mode = options.parse_mode || 'HTML';
  const reply_markup = options.reply_markup;
  const reply_to_message_id = options.reply_to_message_id;

  await sendLongMarkdownMessage(bot, chatId, html, {
    parse_mode,
    reply_markup,
    reply_to_message_id
  });

  const chunks = splitTelegramText(html || '', 3900);
  return { mode: chunks.length > 1 ? 'chunked' : 'instant' };
}

module.exports = {
  buildReportSkeleton,
  buildRevealStages,
  sendReportWithReveal
};
