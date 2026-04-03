const BroadcastGroupSet = require('../models/BroadcastGroupSet');
const BroadcastSavedMessage = require('../models/BroadcastSavedMessage');

function commandSource(msg) {
  return (msg.text || msg.caption || '').trim();
}

function firstCommandToken(source) {
  const first = source.split(/\s+/).filter(Boolean)[0] || '';
  return first.split('@')[0];
}

function argsAfterCommand(source) {
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return '';
  return parts.slice(1).join(' ').trim();
}

function isCmCommandSource(source) {
  return firstCommandToken(source) === '/cm';
}

function isNumericChatId(s) {
  return /^-?\d+$/.test(String(s).trim());
}

async function removeEmptyGroupSets() {
  await BroadcastGroupSet.deleteMany({ chatIds: { $size: 0 } });
}

/**
 * @param {import('node-telegram-bot-api').TelegramBot} bot
 * @param {string[]} chatIdStrings
 * @returns {Promise<Record<string, string>>}
 */
async function buildChatTitleMap(bot, chatIdStrings) {
  const unique = [...new Set(chatIdStrings.map(String))];
  const map = {};
  await Promise.all(
    unique.map(async (id) => {
      try {
        const chat = await bot.getChat(id);
        const name =
          chat.title ||
          [chat.first_name, chat.last_name].filter(Boolean).join(' ') ||
          (chat.username ? `@${chat.username}` : null) ||
          '?';
        map[id] = name;
      } catch {
        map[id] = 'không lấy được tên';
      }
    })
  );
  return map;
}

const TELEGRAM_CHUNK = 4000;

/**
 * Chia chuỗi thành nhiều phần ≤ maxLen (ưu tiên cắt tại xuống dòng).
 */
function splitTelegramText(text, maxLen = TELEGRAM_CHUNK) {
  if (text.length <= maxLen) return [text];
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

async function sendTelegramChunks(bot, chatId, text) {
  const chunks = splitTelegramText(text);
  const total = chunks.length;
  for (let i = 0; i < total; i += 1) {
    const body = total > 1 ? `(${i + 1}/${total})\n${chunks[i]}` : chunks[i];
    await bot.sendMessage(chatId, body);
  }
}

/**
 * /cm — reply tin cần lưu, hoặc media kèm caption /cm <mã>
 */
const handleBroadcastCm = async (bot, msg) => {
  const source = commandSource(msg);
  const codeRaw = argsAfterCommand(source);
  if (!codeRaw) {
    await bot.sendMessage(
      msg.chat.id,
      'Thiếu mã tin. Dùng: /cm <mã> (reply tin cần lưu, hoặc gửi ảnh/GIF/video kèm caption /cm <mã>).'
    );
    return;
  }
  const code = codeRaw.toLowerCase();

  let fromChatId;
  let messageId;

  if (msg.reply_to_message) {
    fromChatId = msg.reply_to_message.chat.id.toString();
    messageId = msg.reply_to_message.message_id;
  } else {
    const hasMedia = !!(
      msg.photo ||
      msg.video ||
      msg.animation ||
      msg.document ||
      msg.audio ||
      msg.voice ||
      msg.video_note ||
      msg.sticker
    );
    const cap = msg.caption || '';
    if (hasMedia && isCmCommandSource(cap)) {
      fromChatId = msg.chat.id.toString();
      messageId = msg.message_id;
    } else {
      await bot.sendMessage(
        msg.chat.id,
        'Reply tin nhắn cần lưu hoặc gửi media kèm caption /cm <mã>.'
      );
      return;
    }
  }

  await BroadcastSavedMessage.findOneAndUpdate(
    { code },
    { fromChatId, messageId },
    { upsert: true, new: true }
  );
  await bot.sendMessage(msg.chat.id, `Đã lưu tin "${code}".`);
};

/**
 * /g <tag> — thêm nhóm hiện tại vào tập
 */
const handleBroadcastG = async (bot, msg) => {
  const source = commandSource(msg);
  const tag = argsAfterCommand(source).toLowerCase();
  if (!tag) {
    await bot.sendMessage(msg.chat.id, 'Thiếu mã nhóm. Dùng: /g <mã>');
    return;
  }
  if (msg.chat.type === 'private') {
    await bot.sendMessage(msg.chat.id, 'Lệnh /g chỉ dùng trong nhóm hoặc supergroup.');
    return;
  }
  const chatIdStr = msg.chat.id.toString();
  await BroadcastGroupSet.findOneAndUpdate(
    { tag },
    { $setOnInsert: { tag }, $addToSet: { chatIds: chatIdStr } },
    { upsert: true, new: true }
  );
  await bot.sendMessage(msg.chat.id, `Đã thêm nhóm này vào tập "${tag}".`);
};

/**
 * /glist
 */
const handleBroadcastGlist = async (bot, msg) => {
  const sets = await BroadcastGroupSet.find().sort({ tag: 1 }).lean();
  if (!sets.length) {
    await bot.sendMessage(msg.chat.id, 'Chưa có tập nhóm nào. Dùng /g <mã> trong nhóm để thêm.');
    return;
  }
  const allIds = sets.flatMap((s) => s.chatIds);
  const titleMap = await buildChatTitleMap(bot, allIds);

  const lines = sets.map((s) => {
    const rows = s.chatIds.map((id) => {
      const idStr = String(id);
      const title = titleMap[idStr] ?? 'không lấy được tên';
      return `  ${idStr} — ${title}`;
    });
    return [`• ${s.tag}: ${s.chatIds.length} nhóm`, ...rows].join('\n');
  });
  const text = lines.join('\n\n');
  await sendTelegramChunks(bot, msg.chat.id, text);
};

/**
 * /cmlist
 */
const handleBroadcastCmlist = async (bot, msg) => {
  const list = await BroadcastSavedMessage.find().sort({ code: 1 }).lean();
  if (!list.length) {
    await bot.sendMessage(msg.chat.id, 'Chưa có tin nào được lưu. Dùng /cm <mã> (reply hoặc caption media).');
    return;
  }
  const lines = list.map((row) => {
    const t = row.updatedAt || row.createdAt;
    const time = t ? new Date(t).toISOString() : '';
    return `• ${row.code}: chat ${row.fromChatId}, msg ${row.messageId}${time ? ` (${time})` : ''}`;
  });
  await sendTelegramChunks(bot, msg.chat.id, lines.join('\n'));
};

/**
 * Ưu tiên tập /g theo tag; không có thì coi là id nhóm (số).
 */
async function resolveBroadcastTargets(target) {
  const tag = target.toLowerCase();
  const set = await BroadcastGroupSet.findOne({ tag });
  if (set) {
    if (!set.chatIds.length) {
      return {
        ok: false,
        message: `Tập "${tag}" chưa có nhóm nào. Dùng /g ${tag} trong từng nhóm cần nhận tin.`
      };
    }
    return { ok: true, targets: [...set.chatIds] };
  }
  if (isNumericChatId(target)) {
    return { ok: true, targets: [target.trim()] };
  }
  return {
    ok: false,
    message: `Không tìm thấy tập "${tag}". Dùng /g ${tag} trong nhóm trước, hoặc gửi đúng id nhóm Telegram (thường âm, dạng -100...).`
  };
}

/**
 * /send <mã tin đã lưu> <mã nhóm hoặc id>
 * hoặc reply tin nhắn + /send <mã nhóm hoặc id> — gửi đúng tin được reply
 */
const handleBroadcastSend = async (bot, msg) => {
  const source = commandSource(msg);
  const parts = source.split(/\s+/).filter(Boolean);
  const cmd = parts[0].split('@')[0];
  if (cmd !== '/send' || parts.length < 2) {
    await bot.sendMessage(
      msg.chat.id,
      'Dùng: /send <mã tin đã lưu> <mã nhóm hoặc id>, hoặc reply tin nhắn và gửi /send <mã nhóm hoặc id>.'
    );
    return;
  }

  let fromChatId;
  let messageId;

  if (parts.length === 2) {
    if (!msg.reply_to_message) {
      await bot.sendMessage(
        msg.chat.id,
        'Reply tin cần gửi rồi gửi /send <mã nhóm hoặc id>, hoặc /send <mã tin> <mã nhóm hoặc id> (không reply).'
      );
      return;
    }
    fromChatId = msg.reply_to_message.chat.id.toString();
    messageId = msg.reply_to_message.message_id;
  } else {
    const msgCode = parts[1].toLowerCase();
    const saved = await BroadcastSavedMessage.findOne({ code: msgCode });
    if (!saved) {
      await bot.sendMessage(msg.chat.id, `Không tìm thấy tin "${msgCode}".`);
      return;
    }
    fromChatId = saved.fromChatId;
    messageId = saved.messageId;
  }

  const target =
    parts.length === 2 ? parts[1] : parts.slice(2).join(' ').trim();
  const resolved = await resolveBroadcastTargets(target);
  if (!resolved.ok) {
    await bot.sendMessage(msg.chat.id, resolved.message);
    return;
  }
  const targets = resolved.targets;

  let ok = 0;
  const errors = [];
  for (const tid of targets) {
    try {
      await bot.copyMessage(tid, fromChatId, messageId);
      ok += 1;
    } catch (e) {
      errors.push(`${tid}: ${e.message || e}`);
    }
  }

  let report = `Gửi xong: ${ok}/${targets.length} thành công.`;
  if (errors.length) {
    report += `\nLỗi:\n${errors.slice(0, 10).join('\n')}`;
    if (errors.length > 10) report += `\n... và ${errors.length - 10} lỗi khác`;
  }
  await bot.sendMessage(msg.chat.id, report);
};

/**
 * /dm <mã tin>
 */
const handleBroadcastDm = async (bot, msg) => {
  const source = commandSource(msg);
  const code = argsAfterCommand(source).toLowerCase();
  if (!code) {
    await bot.sendMessage(msg.chat.id, 'Dùng: /dm <mã tin>');
    return;
  }
  const res = await BroadcastSavedMessage.deleteOne({ code });
  if (res.deletedCount) {
    await bot.sendMessage(msg.chat.id, `Đã xóa tin "${code}".`);
  } else {
    await bot.sendMessage(msg.chat.id, `Không có tin "${code}".`);
  }
};

/**
 * /dg — xóa chat hiện tại khỏi mọi tập
 * /dg <id số> — xóa id đó khỏi mọi tập
 * /dg <tag> — xóa chat hiện tại khỏi tập tag
 */
const handleBroadcastDg = async (bot, msg) => {
  const source = commandSource(msg);
  const arg = argsAfterCommand(source);

  if (!arg) {
    const cid = msg.chat.id.toString();
    const r = await BroadcastGroupSet.updateMany({}, { $pull: { chatIds: cid } });
    await removeEmptyGroupSets();
    await bot.sendMessage(
      msg.chat.id,
      `Đã gỡ nhóm hiện tại khỏi mọi tập (matched ${r.matchedCount}).`
    );
    return;
  }

  if (isNumericChatId(arg)) {
    const idStr = arg.trim();
    const r = await BroadcastGroupSet.updateMany({}, { $pull: { chatIds: idStr } });
    await removeEmptyGroupSets();
    await bot.sendMessage(
      msg.chat.id,
      `Đã gỡ chat ${idStr} khỏi mọi tập (matched ${r.matchedCount}).`
    );
    return;
  }

  const tag = arg.toLowerCase();
  const cid = msg.chat.id.toString();
  const r = await BroadcastGroupSet.updateOne({ tag }, { $pull: { chatIds: cid } });
  await removeEmptyGroupSets();
  if (r.matchedCount) {
    await bot.sendMessage(msg.chat.id, `Đã gỡ nhóm hiện tại khỏi tập "${tag}".`);
  } else {
    await bot.sendMessage(msg.chat.id, `Không có tập "${tag}".`);
  }
};

module.exports = {
  isCmCommandSource,
  handleBroadcastCm,
  handleBroadcastG,
  handleBroadcastGlist,
  handleBroadcastCmlist,
  handleBroadcastSend,
  handleBroadcastDm,
  handleBroadcastDg
};
