const BroadcastGroupSet = require('../models/BroadcastGroupSet');
const BroadcastSavedMessage = require('../models/BroadcastSavedMessage');
const { splitTelegramText } = require('../utils/telegramChunks');

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
        map[id] = '无法获取名称';
      }
    })
  );
  return map;
}

const TELEGRAM_CHUNK = 4000;

async function sendTelegramChunks(bot, chatId, text) {
  const chunks = splitTelegramText(text, TELEGRAM_CHUNK);
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
      '缺少消息代码。用法：/cm <代码>（回复要保存的消息，或发送图片/GIF/视频并在说明中写 /cm <代码>）。'
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
        '请回复要保存的消息，或发送媒体并在说明中写 /cm <代码>。'
      );
      return;
    }
  }

  await BroadcastSavedMessage.findOneAndUpdate(
    { code },
    { fromChatId, messageId },
    { upsert: true, new: true }
  );
  await bot.sendMessage(msg.chat.id, `已保存消息 "${code}"。`);
};

/**
 * /g <tag> — thêm nhóm hiện tại vào tập
 */
const handleBroadcastG = async (bot, msg) => {
  const source = commandSource(msg);
  const tag = argsAfterCommand(source).toLowerCase();
  if (!tag) {
    await bot.sendMessage(msg.chat.id, '缺少群组代码。用法：/g <代码>');
    return;
  }
  if (msg.chat.type === 'private') {
    await bot.sendMessage(msg.chat.id, '命令 /g 只能在群组或超级群组中使用。');
    return;
  }
  const chatIdStr = msg.chat.id.toString();
  await BroadcastGroupSet.findOneAndUpdate(
    { tag },
    { $setOnInsert: { tag }, $addToSet: { chatIds: chatIdStr } },
    { upsert: true, new: true }
  );
  await bot.sendMessage(msg.chat.id, `已将本群加入集合 "${tag}"。`);
};

/**
 * /glist
 */
const handleBroadcastGlist = async (bot, msg) => {
  const sets = await BroadcastGroupSet.find().sort({ tag: 1 }).lean();
  if (!sets.length) {
    await bot.sendMessage(msg.chat.id, '暂无群组集合。请在群组中使用 /g <代码> 添加。');
    return;
  }
  const allIds = sets.flatMap((s) => s.chatIds);
  const titleMap = await buildChatTitleMap(bot, allIds);

  const lines = sets.map((s) => {
    const rows = s.chatIds.map((id) => {
      const idStr = String(id);
      const title = titleMap[idStr] ?? '无法获取名称';
      return `  ${idStr} — ${title}`;
    });
    return [`• ${s.tag}: ${s.chatIds.length} 个群组`, ...rows].join('\n');
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
    await bot.sendMessage(msg.chat.id, '暂无已保存消息。请使用 /cm <代码>（回复消息或媒体说明）。');
    return;
  }
  const lines = list.map((row) => {
    const t = row.updatedAt || row.createdAt;
    const time = t ? new Date(t).toISOString() : '';
    return `• ${row.code}: chat ${row.fromChatId}, msg ${row.messageId}${time ? ` (${time})` : ''}`;
  });
  await sendTelegramChunks(bot, msg.chat.id, lines.join('\n'));

  // Gửi đầy đủ nội dung từng tin đã lưu để xem trực tiếp.
  for (const row of list) {
    await bot.sendMessage(msg.chat.id, `代码 "${row.code}" 的内容：`);
    try {
      await bot.copyMessage(msg.chat.id, row.fromChatId, row.messageId);
    } catch (e) {
      await bot.sendMessage(
        msg.chat.id,
        `无法加载代码 "${row.code}" 的内容（${row.fromChatId}/${row.messageId}）：${e.message || e}`
      );
    }
  }
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
        message: `集合 "${tag}" 中还没有群组。请在需要接收消息的每个群组中使用 /g ${tag}。`
      };
    }
    return { ok: true, targets: [...set.chatIds] };
  }
  if (isNumericChatId(target)) {
    return { ok: true, targets: [target.trim()] };
  }
  return {
    ok: false,
    message: `未找到集合 "${tag}"。请先在群组中使用 /g ${tag}，或填写正确的 Telegram 群组 ID（一般为负数，格式如 -100...）。`
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
      '用法：/send <已保存消息代码> <群组代码或ID>，或回复消息后发送 /send <群组代码或ID>。'
    );
    return;
  }

  let fromChatId;
  let messageId;

  if (parts.length === 2) {
    if (!msg.reply_to_message) {
      await bot.sendMessage(
        msg.chat.id,
        '请先回复要发送的消息，再发送 /send <群组代码或ID>；或不回复，直接使用 /send <消息代码> <群组代码或ID>。'
      );
      return;
    }
    fromChatId = msg.reply_to_message.chat.id.toString();
    messageId = msg.reply_to_message.message_id;
  } else {
    const msgCode = parts[1].toLowerCase();
    const saved = await BroadcastSavedMessage.findOne({ code: msgCode });
    if (!saved) {
      await bot.sendMessage(msg.chat.id, `未找到消息 "${msgCode}"。`);
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

  let report = `发送完成：${ok}/${targets.length} 成功。`;
  if (errors.length) {
    report += `\n错误：\n${errors.slice(0, 10).join('\n')}`;
    if (errors.length > 10) report += `\n... 以及另外 ${errors.length - 10} 个错误`;
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
    await bot.sendMessage(msg.chat.id, '用法：/dm <消息代码>');
    return;
  }
  const res = await BroadcastSavedMessage.deleteOne({ code });
  if (res.deletedCount) {
    await bot.sendMessage(msg.chat.id, `已删除消息 "${code}"。`);
  } else {
    await bot.sendMessage(msg.chat.id, `没有消息 "${code}"。`);
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
      `已将本群从所有集合中移除（匹配 ${r.matchedCount}）。`
    );
    return;
  }

  if (isNumericChatId(arg)) {
    const idStr = arg.trim();
    const r = await BroadcastGroupSet.updateMany({}, { $pull: { chatIds: idStr } });
    await removeEmptyGroupSets();
    await bot.sendMessage(
      msg.chat.id,
      `已将聊天 ${idStr} 从所有集合中移除（匹配 ${r.matchedCount}）。`
    );
    return;
  }

  const tag = arg.toLowerCase();
  const cid = msg.chat.id.toString();
  const r = await BroadcastGroupSet.updateOne({ tag }, { $pull: { chatIds: cid } });
  await removeEmptyGroupSets();
  if (r.matchedCount) {
    await bot.sendMessage(msg.chat.id, `已将本群从集合 "${tag}" 中移除。`);
  } else {
    await bot.sendMessage(msg.chat.id, `没有集合 "${tag}"。`);
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
