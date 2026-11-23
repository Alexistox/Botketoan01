const BroadcastGroupSet = require('../models/BroadcastGroupSet');
const BroadcastSavedMessage = require('../models/BroadcastSavedMessage');
const BroadcastSchedule = require('../models/BroadcastSchedule');
const { splitTelegramText } = require('../utils/telegramChunks');

const SCHEDULE_TZ = 'Asia/Phnom_Penh';

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

function parseHHmm(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

/**
 * Parse khung ngày trong tuần: 1=T2 … 7=CN.
 * Hỗ trợ: 3 | 1-5 | 2,5 | 2.5 | 2:5 | wd/work | we/weekend
 * @returns {number[]|null} null = không hợp lệ; [] không dùng (caller dùng empty = mọi ngày)
 */
function parseDaysOfWeek(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'wd' || s === 'work') return [1, 2, 3, 4, 5];
  if (s === 'we' || s === 'weekend') return [6, 7];

  // Không nhầm HH:mm thành ngày
  if (parseHHmm(s)) return null;

  const normalized = s.replace(/[.:]/g, ',');
  const tokens = normalized.split(',').map((t) => t.trim()).filter(Boolean);
  if (!tokens.length) return null;

  const days = new Set();
  for (const tok of tokens) {
    const range = tok.match(/^([1-7])-([1-7])$/);
    if (range) {
      let a = Number(range[1]);
      let b = Number(range[2]);
      if (a > b) {
        const t = a;
        a = b;
        b = t;
      }
      for (let d = a; d <= b; d += 1) days.add(d);
      continue;
    }
    if (/^[1-7]$/.test(tok)) {
      days.add(Number(tok));
      continue;
    }
    return null;
  }
  if (!days.size) return null;
  return [...days].sort((a, b) => a - b);
}

/** Hiển thị: [] → 每日; [1,2,3,4,5] → 1-5; [2,5] → 2,5 */
function formatDaysOfWeekLabel(days) {
  const list = Array.isArray(days) ? [...new Set(days.map(Number))].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b) : [];
  if (!list.length) return '每日';
  if (list.length === 7) return '每日';

  const ranges = [];
  let start = list[0];
  let prev = list[0];
  for (let i = 1; i < list.length; i += 1) {
    if (list[i] === prev + 1) {
      prev = list[i];
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = list[i];
    prev = list[i];
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(',');
}

/** Ngày + giờ + weekday hiện tại theo Asia/Phnom_Penh (Campuchia). weekday: 1=Mon…7=Sun */
function getScheduleNowParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHEDULE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  let hour = parts.hour;
  if (hour === '24') hour = '00';

  const wdShort = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHEDULE_TZ,
    weekday: 'short'
  }).format(date);
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const weekday = weekdayMap[wdShort] || null;

  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    timeHHmm: `${hour}:${parts.minute}`,
    weekday
  };
}

function describeScheduleSource(row) {
  if (row.msgCode) return `code:${row.msgCode}`;
  if (row.fromChatId != null && row.messageId != null) {
    return `reply ${row.fromChatId}/${row.messageId}`;
  }
  return '?';
}

async function resolveScheduleMessageSource(row) {
  if (row.msgCode) {
    const saved = await BroadcastSavedMessage.findOne({ code: String(row.msgCode).toLowerCase() });
    if (!saved) {
      return { ok: false, message: `未找到消息 "${row.msgCode}"。` };
    }
    return { ok: true, fromChatId: saved.fromChatId, messageId: saved.messageId };
  }
  if (row.fromChatId != null && row.messageId != null) {
    return { ok: true, fromChatId: String(row.fromChatId), messageId: Number(row.messageId) };
  }
  return { ok: false, message: '日程缺少消息来源。' };
}

/**
 * Chạy một lịch: copyMessage tới mọi target. Cập nhật lastFiredDate khi bắt đầu (tránh trùng).
 * @returns {{ ok: number, total: number, errors: string[] }}
 */
async function fireBroadcastSchedule(bot, schedule) {
  const source = await resolveScheduleMessageSource(schedule);
  if (!source.ok) {
    return { ok: 0, total: 0, errors: [source.message] };
  }
  const resolved = await resolveBroadcastTargets(schedule.target);
  if (!resolved.ok) {
    return { ok: 0, total: 0, errors: [resolved.message] };
  }

  const today = getScheduleNowParts().dateStr;
  await BroadcastSchedule.updateOne(
    { _id: schedule._id },
    { $set: { lastFiredDate: today } }
  );

  let ok = 0;
  const errors = [];
  for (const tid of resolved.targets) {
    try {
      await bot.copyMessage(tid, source.fromChatId, source.messageId);
      ok += 1;
    } catch (e) {
      errors.push(`${tid}: ${e.message || e}`);
    }
  }
  return { ok, total: resolved.targets.length, errors };
}

/**
 * /cs <消息代码> <群组代码|ID> <HH:mm> [days]
 * hoặc reply + /cs <群组代码|ID> <HH:mm> [days]
 * days: 1-5 | 3 | 2,5 | 2.5 | 2:5 | wd | we  (1=T2…7=CN)
 */
const handleBroadcastCs = async (bot, msg) => {
  const source = commandSource(msg);
  const parts = source.split(/\s+/).filter(Boolean);
  const cmd = (parts[0] || '').split('@')[0];
  const usage =
    '用法：/cs <消息代码> <群组代码或ID> <HH:mm> [days]\n' +
    '或回复消息后：/cs <群组代码或ID> <HH:mm> [days]\n' +
    'days 可选：1-5 / 3 / 2,5 / wd / we（1=周一…7=周日；, . : 均可）\n' +
    '时区：Asia/Phnom_Penh（柬埔寨）';

  if (cmd !== '/cs' || parts.length < 3) {
    await bot.sendMessage(msg.chat.id, usage);
    return;
  }

  const rest = parts.slice(1);
  let daysOfWeek = [];
  let timeHHmm = null;
  let middle;

  if (
    rest.length >= 2 &&
    parseDaysOfWeek(rest[rest.length - 1]) &&
    parseHHmm(rest[rest.length - 2])
  ) {
    daysOfWeek = parseDaysOfWeek(rest[rest.length - 1]);
    timeHHmm = parseHHmm(rest[rest.length - 2]);
    middle = rest.slice(0, -2);
  } else if (parseHHmm(rest[rest.length - 1])) {
    timeHHmm = parseHHmm(rest[rest.length - 1]);
    middle = rest.slice(0, -1);
  } else {
    await bot.sendMessage(
      msg.chat.id,
      '时间或日期格式无效。时间用 HH:mm；日期用 1-5 / 3 / 2,5 / wd / we。'
    );
    return;
  }

  let msgCode = null;
  let fromChatId = null;
  let messageId = null;
  let target;

  if (middle.length === 1) {
    if (!msg.reply_to_message) {
      await bot.sendMessage(
        msg.chat.id,
        '请先回复要定时发送的消息，再发送 /cs <群组代码或ID> <HH:mm> [days]；\n或不回复，使用 /cs <消息代码> <群组代码或ID> <HH:mm> [days]。'
      );
      return;
    }
    target = middle[0];
    fromChatId = msg.reply_to_message.chat.id.toString();
    messageId = msg.reply_to_message.message_id;
  } else if (middle.length >= 2) {
    msgCode = middle[0].toLowerCase();
    target = middle.slice(1).join(' ').trim();
    const saved = await BroadcastSavedMessage.findOne({ code: msgCode });
    if (!saved) {
      await bot.sendMessage(msg.chat.id, `未找到消息 "${msgCode}"。请先用 /cm 保存。`);
      return;
    }
  } else {
    await bot.sendMessage(msg.chat.id, usage);
    return;
  }

  if (!target) {
    await bot.sendMessage(msg.chat.id, '缺少群组代码或ID。');
    return;
  }

  const resolved = await resolveBroadcastTargets(target);
  if (!resolved.ok) {
    await bot.sendMessage(msg.chat.id, resolved.message);
    return;
  }

  const createdBy = msg.from ? String(msg.from.id) : '';
  const row = await BroadcastSchedule.create({
    msgCode,
    fromChatId,
    messageId,
    target: target.trim(),
    timeHHmm,
    daysOfWeek,
    enabled: true,
    lastFiredDate: null,
    createdBy
  });

  const srcLabel = describeScheduleSource(row);
  const daysLabel = formatDaysOfWeekLabel(daysOfWeek);
  await bot.sendMessage(
    msg.chat.id,
    `已设置定时发送（${SCHEDULE_TZ}）：\n` +
      `#${row._id.toString().slice(-6)} ${timeHHmm} ${daysLabel} → ${target} ← ${srcLabel}\n` +
      `目标群组数：${resolved.targets.length}`
  );
};

/**
 * /cslist
 */
const handleBroadcastCslist = async (bot, msg) => {
  const list = await BroadcastSchedule.find().sort({ timeHHmm: 1, createdAt: 1 }).lean();
  if (!list.length) {
    await bot.sendMessage(
      msg.chat.id,
      '暂无定时发送。用法：/cs <消息代码> <群组代码或ID> <HH:mm> [days]\ndays 例：1-5 / 3 / 2,5 / wd / we'
    );
    return;
  }
  const lines = list.map((row, i) => {
    const n = i + 1;
    const short = String(row._id).slice(-6);
    const on = row.enabled === false ? ' [停用]' : '';
    const last = row.lastFiredDate ? ` last=${row.lastFiredDate}` : '';
    const daysLabel = formatDaysOfWeekLabel(row.daysOfWeek);
    return `${n}. #${short} ${row.timeHHmm} ${daysLabel} → ${row.target} ← ${describeScheduleSource(row)}${on}${last}`;
  });
  await sendTelegramChunks(
    bot,
    msg.chat.id,
    `定时发送列表（${SCHEDULE_TZ}）：\n${lines.join('\n')}\n\n删除：/ds <序号> 或 /ds <短码>`
  );
};

/**
 * /ds <序号|短码>
 */
const handleBroadcastDs = async (bot, msg) => {
  const source = commandSource(msg);
  const arg = argsAfterCommand(source).trim();
  if (!arg) {
    await bot.sendMessage(msg.chat.id, '用法：/ds <序号> 或 /ds <短码>（见 /cslist）');
    return;
  }

  const list = await BroadcastSchedule.find().sort({ timeHHmm: 1, createdAt: 1 });
  if (!list.length) {
    await bot.sendMessage(msg.chat.id, '暂无定时发送可删除。');
    return;
  }

  let row = null;
  if (/^\d+$/.test(arg)) {
    const idx = Number(arg);
    if (idx >= 1 && idx <= list.length) {
      row = list[idx - 1];
    }
  }
  if (!row) {
    const needle = arg.replace(/^#/, '').toLowerCase();
    row = list.find((r) => String(r._id).toLowerCase().endsWith(needle)) || null;
  }
  if (!row) {
    await bot.sendMessage(msg.chat.id, `未找到日程 "${arg}"。请用 /cslist 查看。`);
    return;
  }

  await BroadcastSchedule.deleteOne({ _id: row._id });
  await bot.sendMessage(
    msg.chat.id,
    `已删除定时 #${String(row._id).slice(-6)} ${row.timeHHmm} → ${row.target}`
  );
};

module.exports = {
  isCmCommandSource,
  handleBroadcastCm,
  handleBroadcastG,
  handleBroadcastGlist,
  handleBroadcastCmlist,
  handleBroadcastSend,
  handleBroadcastDm,
  handleBroadcastDg,
  handleBroadcastCs,
  handleBroadcastCslist,
  handleBroadcastDs,
  fireBroadcastSchedule,
  getScheduleNowParts,
  getSaigonNowParts: getScheduleNowParts,
  parseHHmm,
  parseDaysOfWeek,
  formatDaysOfWeekLabel,
  SCHEDULE_TZ
};
