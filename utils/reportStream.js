/**
 * Reveal báo cáo: khung (已入账/已下发/tổng/应已未) → full giao dịch.
 * delay mặc định 0 — edit ngay sau send (chỉ còn RTT Telegram).
 */

const { sendLongMarkdownMessage, splitTelegramText } = require('./telegramChunks');

const sleep = (ms) => {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
};

const isPrivateChatId = (chatId) => {
  const n = Number(chatId);
  return Number.isFinite(n) && n > 0;
};

/**
 * Khung: header 已入账/已下发 + tổng + 应/已/未 — bỏ dòng giao dịch.
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

/** [khung, full] */
function buildRevealStages(html) {
  const text = String(html || '').trim();
  if (!text) return [];
  const skeleton = buildReportSkeleton(text);
  if (!skeleton || skeleton === text) return [text];
  if (skeleton.length >= text.length - 8) return [text];
  return [skeleton, text];
}

async function sendDraftStage(bot, chatId, draftId, text, parseMode) {
  const form = {
    chat_id: chatId,
    draft_id: draftId,
    text: text || ''
  };
  if (parseMode) form.parse_mode = parseMode;
  await bot._request('sendMessageDraft', { form });
}

/**
 * @param {object} bot
 * @param {string|number} chatId
 * @param {string} html
 * @param {{ reply_markup?: object, reply_to_message_id?: number, parse_mode?: string, delayMs?: number }} [options]
 */
async function sendReportWithReveal(bot, chatId, html, options = {}) {
  const parse_mode = options.parse_mode || 'HTML';
  // 0 = edit ngay, không sleep — “quệt một phát”
  const delayMs = options.delayMs != null ? options.delayMs : 0;
  const reply_markup = options.reply_markup;
  const reply_to_message_id = options.reply_to_message_id;

  const sizeChunks = splitTelegramText(html, 3900);
  if (sizeChunks.length > 1) {
    await sendLongMarkdownMessage(bot, chatId, html, {
      parse_mode,
      reply_markup,
      reply_to_message_id
    });
    return { mode: 'chunked' };
  }

  const stages = buildRevealStages(html);
  if (stages.length <= 1) {
    await sendLongMarkdownMessage(bot, chatId, html, {
      parse_mode,
      reply_markup,
      reply_to_message_id
    });
    return { mode: 'instant' };
  }

  const privateChat = isPrivateChatId(chatId);
  const [skeleton, full] = stages;

  // ——— Private: draft khung → draft full → sendMessage chốt (delay 0) ———
  if (privateChat) {
    const draftId = (Date.now() % 2147483646) + 1;
    try {
      await sendDraftStage(bot, chatId, draftId, skeleton, parse_mode);
      await sleep(delayMs);
      await sendDraftStage(bot, chatId, draftId, full, parse_mode);
      await sendLongMarkdownMessage(bot, chatId, html, {
        parse_mode,
        reply_markup,
        reply_to_message_id
      });
      return { mode: 'draft', stages: 2 };
    } catch (err) {
      console.warn(
        '[reportStream] draft failed, fallback edit:',
        err && err.message ? err.message : err
      );
    }
  }

  // ——— Group: send khung → edit full ngay (không chờ) ———
  try {
    const firstOpts = {
      parse_mode,
      ...(reply_to_message_id != null && Number.isFinite(Number(reply_to_message_id))
        ? { reply_to_message_id: Number(reply_to_message_id) }
        : {})
    };
    const sent = await bot.sendMessage(chatId, skeleton, firstOpts);
    const messageId = sent && sent.message_id;
    if (messageId == null) {
      await sendLongMarkdownMessage(bot, chatId, html, {
        parse_mode,
        reply_markup,
        reply_to_message_id
      });
      return { mode: 'instant' };
    }

    // Edit full ngay lập tức (delay 0) — giao dịch “quệt” vào
    await sleep(delayMs);
    try {
      await bot.editMessageText(full, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode,
        ...(reply_markup ? { reply_markup } : {})
      });
    } catch (editErr) {
      console.warn(
        '[reportStream] edit failed, sending full:',
        editErr && editErr.message ? editErr.message : editErr
      );
      await sendLongMarkdownMessage(bot, chatId, html, {
        parse_mode,
        reply_markup,
        reply_to_message_id
      });
      return { mode: 'edit-fallback' };
    }

    return { mode: 'edit', stages: 2 };
  } catch (err) {
    console.warn(
      '[reportStream] reveal failed, plain send:',
      err && err.message ? err.message : err
    );
    await sendLongMarkdownMessage(bot, chatId, html, {
      parse_mode,
      reply_markup,
      reply_to_message_id
    });
    return { mode: 'fallback' };
  }
}

module.exports = {
  buildReportSkeleton,
  buildRevealStages,
  sendReportWithReveal
};
