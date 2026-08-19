const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const MessageLog = require('../models/MessageLog');

function getBot(opts = {}) {
  if (opts.bot) return opts.bot;
  try {
    return require('../app').bot || null;
  } catch (_) {
    return null;
  }
}

function buildDateFilter(startDate, endDate) {
  if (!startDate && !endDate) return null;
  const ts = {};
  if (startDate) ts.$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    ts.$lte = end;
  }
  return ts;
}

/** Thử nhiều cách khớp chatId (string/number, -100…). */
async function findGroupByChatId(chatId) {
  const id = String(chatId);
  let group = await Group.findOne({ chatId: id }).lean();
  if (group) return group;

  if (/^-?\d+$/.test(id)) {
    group = await Group.findOne({ chatId: Number(id) }).lean();
    if (group) return group;
  }

  const normalized = id.replace(/^-100/, '');
  const candidates = await Group.find({}).lean();
  for (const g of candidates) {
    const gc = String(g.chatId);
    if (gc === id || gc.replace(/^-100/, '') === normalized) {
      return g;
    }
  }
  return null;
}

async function getMessageLogMeta(chatId) {
  const id = String(chatId);
  const latest = await MessageLog.findOne({ chatId: id })
    .sort({ timestamp: -1 })
    .select('groupName chatType')
    .lean();
  const count = await MessageLog.countDocuments({ chatId: id });
  return {
    groupName: latest?.groupName || '',
    chatType: latest?.chatType || '',
    messageLogCount: count
  };
}

async function getChatParticipantsFromLogs(chatId) {
  const rows = await MessageLog.aggregate([
    { $match: { chatId: String(chatId), senderId: { $nin: ['', null] } } },
    {
      $group: {
        _id: '$senderId',
        fullName: { $last: '$senderName' },
        username: { $last: '$username' },
        messageCount: { $sum: 1 },
        lastActive: { $max: '$timestamp' }
      }
    },
    { $sort: { messageCount: -1, lastActive: -1 } }
  ]);

  return rows.map((r) => ({
    senderId: String(r._id),
    fullName: r.fullName || 'Unknown',
    username: r.username || '',
    telegramLink: r.username ? `https://t.me/${r.username}` : null,
    messageCount: r.messageCount,
    lastActive: r.lastActive,
    roles: ['member']
  }));
}

function mergeAllMembers(logParticipants, tgAdmins, operators) {
  const map = new Map();

  const upsert = (key, entry) => {
    if (!key) return;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        senderId: entry.senderId || '',
        fullName: entry.fullName || 'Unknown',
        username: entry.username || '',
        telegramLink: entry.telegramLink || (entry.username ? `https://t.me/${entry.username}` : null),
        messageCount: entry.messageCount || 0,
        lastActive: entry.lastActive || null,
        roles: [...(entry.roles || [])]
      });
      return;
    }
    if (entry.username && !prev.username) {
      prev.username = entry.username;
      prev.telegramLink = `https://t.me/${entry.username}`;
    }
    if (entry.fullName && prev.fullName === 'Unknown') prev.fullName = entry.fullName;
    if (entry.messageCount) prev.messageCount = Math.max(prev.messageCount, entry.messageCount);
    if (entry.lastActive && (!prev.lastActive || entry.lastActive > prev.lastActive)) {
      prev.lastActive = entry.lastActive;
    }
    (entry.roles || []).forEach((role) => {
      if (!prev.roles.includes(role)) prev.roles.push(role);
    });
  };

  logParticipants.forEach((p) => upsert(String(p.senderId), p));
  tgAdmins.forEach((a) => {
    upsert(String(a.id), {
      senderId: String(a.id),
      fullName: a.fullName,
      username: a.username,
      telegramLink: a.telegramLink,
      messageCount: 0,
      roles: [a.status === 'creator' ? 'creator' : 'admin']
    });
  });
  operators.forEach((o) => {
    upsert(String(o.userId || o.username), {
      senderId: String(o.userId || ''),
      fullName: o.fullName || o.username || 'Unknown',
      username: o.username || '',
      telegramLink: o.telegramLink,
      messageCount: 0,
      roles: ['operator']
    });
  });

  return Array.from(map.values()).sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0));
}

function extractUsernames(allMembers) {
  const seen = new Set();
  const list = [];
  allMembers.forEach((m) => {
    const u = (m.username || '').trim();
    if (!u || seen.has(u.toLowerCase())) return;
    seen.add(u.toLowerCase());
    list.push(u);
  });
  return list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * @param {string} chatId
 * @param {{ startDate?: string, endDate?: string, bot?: object }} opts
 */
async function fetchGroupDetails(chatId, opts = {}) {
  const group = await findGroupByChatId(chatId);
  const logMeta = await getMessageLogMeta(chatId);
  const resolvedChatId = group ? String(group.chatId) : String(chatId);
  const logParticipants = await getChatParticipantsFromLogs(resolvedChatId);
  const allMembersPartial = mergeAllMembers(logParticipants, [], []);
  const usernamesPartial = extractUsernames(allMembersPartial);

  if (!group) {
    return {
      chatId: resolvedChatId,
      groupTitle: logMeta.groupName || `Chat ${resolvedChatId}`,
      registered: false,
      messageLogCount: logMeta.messageLogCount,
      group: null,
      summary: null,
      periodTotals: null,
      statsByType: {},
      dailySummary: [],
      members: [],
      allMembers: allMembersPartial,
      usernames: usernamesPartial,
      operators: [],
      memberCount: 0,
      transactionCount: 0,
      rateHistory: [],
      transactionRateStats: null,
      cards: [],
      startHistory: [],
      filters: { startDate: opts.startDate || null, endDate: opts.endDate || null },
      hint:
        'Nhóm chưa có dữ liệu kế toán trong bot. Hãy dùng lệnh + hoặc /start trong nhóm Telegram trước.'
    };
  }

  const bot = getBot(opts);
  let groupTitle = group.groupName || logMeta.groupName || `Chat ${resolvedChatId}`;
  let memberCount = 0;
  let members = [];
  const operators = (group.operators || []).map((op) => ({
    userId: op.userId,
    username: op.username || '',
    dateAdded: op.dateAdded,
    telegramLink: op.username ? `https://t.me/${op.username}` : null,
    statusText: 'Bot Operator',
    fullName: op.username || 'Unknown'
  }));

  if (bot) {
    try {
      const chatInfo = await bot.getChat(resolvedChatId);
      groupTitle = chatInfo.title || groupTitle;
      memberCount = await bot.getChatMemberCount(resolvedChatId);
    } catch (_) {
      /* ignore */
    }
    try {
      const administrators = await bot.getChatAdministrators(resolvedChatId);
      members = administrators.map((admin) => ({
        id: admin.user.id,
        username: admin.user.username || '',
        fullName:
          `${admin.user.first_name || ''} ${admin.user.last_name || ''}`.trim() ||
          admin.user.username ||
          'Unknown',
        telegramLink: admin.user.username ? `https://t.me/${admin.user.username}` : null,
        status: admin.status,
        statusText: admin.status === 'creator' ? 'Chủ nhóm' : 'Quản trị viên',
        isBot: admin.user.is_bot || false
      }));
    } catch (_) {
      members = [];
    }
  }

  const { startDate, endDate } = opts;
  const txFilter = { chatId: resolvedChatId, skipped: { $ne: true } };
  const dateRange = buildDateFilter(startDate, endDate);
  if (dateRange) txFilter.timestamp = dateRange;

  const transactionCount = await Transaction.countDocuments(txFilter);

  const typeStats = await Transaction.aggregate([
    { $match: txFilter },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalUsdt: { $sum: '$usdtAmount' }
      }
    }
  ]);

  const statsByType = {};
  typeStats.forEach((row) => {
    statsByType[row._id] = {
      count: row.count,
      totalAmount: row.totalAmount || 0,
      totalUsdt: row.totalUsdt || 0
    };
  });

  const dailyData = await Transaction.aggregate([
    { $match: txFilter },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          type: '$type'
        },
        totalAmount: { $sum: '$amount' },
        totalUsdtAmount: { $sum: '$usdtAmount' },
        count: { $sum: 1 },
        avgRate: { $avg: '$rate' },
        avgExchangeRate: { $avg: '$exchangeRate' }
      }
    },
    { $sort: { '_id.date': -1 } }
  ]);

  const summary = {};
  let periodVND = 0;
  let periodUSDT = 0;
  let periodPaid = 0;

  dailyData.forEach((item) => {
    const date = item._id.date;
    const type = item._id.type;
    if (!summary[date]) {
      summary[date] = {
        date,
        deposits: { amount: 0, usdtAmount: 0, count: 0 },
        withdraws: { amount: 0, usdtAmount: 0, count: 0 },
        payments: { amount: 0, usdtAmount: 0, count: 0 },
        transactionCount: 0,
        avgRate: 0,
        avgExchangeRate: 0
      };
    }
    if (type === 'deposit') {
      summary[date].deposits = {
        amount: item.totalAmount,
        usdtAmount: item.totalUsdtAmount,
        count: item.count
      };
    } else if (type === 'withdraw') {
      summary[date].withdraws = {
        amount: Math.abs(item.totalAmount),
        usdtAmount: Math.abs(item.totalUsdtAmount),
        count: item.count
      };
    } else if (type === 'payment') {
      summary[date].payments = {
        amount: item.totalAmount,
        usdtAmount: item.totalUsdtAmount,
        count: item.count
      };
    }
    if (item.avgRate) summary[date].avgRate = item.avgRate;
    if (item.avgExchangeRate) summary[date].avgExchangeRate = item.avgExchangeRate;
    summary[date].transactionCount += item.count;
  });

  Object.values(summary).forEach((day) => {
    day.totalVND = day.deposits.amount - day.withdraws.amount;
    day.totalUSDT = day.deposits.usdtAmount - day.withdraws.usdtAmount;
    day.totalPaid = day.payments.usdtAmount;
    day.remaining = day.totalUSDT - day.totalPaid;
    periodVND += day.totalVND;
    periodUSDT += day.totalUSDT;
    periodPaid += day.totalPaid;
  });

  const dailySummary = Object.values(summary).sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  const totalPaidAll = await Transaction.aggregate([
    { $match: { chatId: resolvedChatId, type: 'payment', skipped: { $ne: true } } },
    { $group: { _id: null, total: { $sum: '$usdtAmount' } } }
  ]);
  const totalPaidAmount = totalPaidAll.length ? totalPaidAll[0].total : 0;

  const rateHistoryRaw = await Transaction.find({
    chatId: resolvedChatId,
    type: { $in: ['setRate', 'setExchangeRate', 'setWithdrawRate', 'setWRate'] }
  })
    .sort({ timestamp: -1 })
    .limit(40)
    .lean();

  const rateHistory = rateHistoryRaw.map((t) => ({
    type: t.type === 'setWithdrawRate' ? 'setWRate' : t.type,
    typeLabel:
      t.type === 'setRate'
        ? 'Rate (%)'
        : t.type === 'setExchangeRate'
          ? 'Tỷ giá'
          : 'WRate / WTỷ giá',
    rate: t.rate || 0,
    exchangeRate: t.exchangeRate || 0,
    message: t.message || t.details || '',
    senderName: t.senderName || '',
    timestamp: t.timestamp
  }));

  const txRateAgg = await Transaction.aggregate([
    {
      $match: {
        chatId: resolvedChatId,
        type: { $in: ['deposit', 'withdraw'] },
        skipped: { $ne: true }
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        avgRate: { $avg: '$rate' },
        minRate: { $min: '$rate' },
        maxRate: { $max: '$rate' },
        avgExchangeRate: { $avg: '$exchangeRate' },
        minExchangeRate: { $min: '$exchangeRate' },
        maxExchangeRate: { $max: '$exchangeRate' }
      }
    }
  ]);
  const transactionRateStats = txRateAgg.length ? txRateAgg[0] : null;

  const cards = await Card.find({ chatId: resolvedChatId, hidden: { $ne: true } })
    .sort({ cardCode: 1 })
    .lean();

  const startHistory = await Transaction.find({ chatId: resolvedChatId, type: 'clear' })
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();

  const allMembers = mergeAllMembers(logParticipants, members, operators);
  const usernames = extractUsernames(allMembers);

  return {
    chatId: resolvedChatId,
    groupTitle,
    registered: true,
    messageLogCount: logMeta.messageLogCount,
    group: {
      totalVND: group.totalVND || 0,
      totalVNDPlus: group.totalVNDPlus ?? group.totalDepositVND ?? 0,
      totalVNDMinus: group.totalVNDMinus ?? group.totalWithdrawVND ?? 0,
      totalUSDT: group.totalUSDT || 0,
      totalUSDTPlus: group.totalUSDTPlus ?? group.totalDepositUSDT ?? 0,
      totalUSDTMinus: group.totalUSDTMinus ?? group.totalWithdrawUSDT ?? 0,
      usdtPaid: group.usdtPaid || 0,
      remainingUSDT: group.remainingUSDT ?? (group.totalUSDT || 0) - totalPaidAmount,
      rate: group.rate || 0,
      exchangeRate: group.exchangeRate || 0,
      wrate: group.withdrawRate ?? group.wrate ?? 0,
      wexchangeRate: group.withdrawExchangeRate ?? group.wexchangeRate ?? 0,
      currency: group.currency || 'USDT',
      lastClearDate: group.lastClearDate,
      numberFormat: group.numberFormat === 'formatted' ? 'comma' : (group.numberFormat || 'comma'),
      qrEnabled: group.qrEnabled || false
    },
    memberCount,
    members,
    allMembers,
    usernames,
    operators,
    transactionCount,
    statsByType,
    dailySummary,
    periodTotals: {
      totalVND: periodVND,
      totalUSDT: periodUSDT,
      totalPaid: periodPaid,
      remaining: periodUSDT - periodPaid
    },
    summary: {
      totalVND: group.totalVND || 0,
      totalUSDT: group.totalUSDT || 0,
      totalPaid: totalPaidAmount,
      remaining: (group.totalUSDT || 0) - totalPaidAmount,
      rate: group.rate || 0,
      exchangeRate: group.exchangeRate || 0,
      wrate: group.withdrawRate ?? group.wrate ?? 0,
      wexchangeRate: group.withdrawExchangeRate ?? group.wexchangeRate ?? 0
    },
    rateHistory,
    transactionRateStats,
    cards: cards.map((c) => ({
      cardCode: c.cardCode,
      total: c.total || 0,
      paid: c.paid || 0,
      limit: c.limit || 0,
      remaining: (c.total || 0) - (c.paid || 0)
    })),
    startHistory: startHistory.map((t) => ({
      date: t.timestamp.toISOString().split('T')[0],
      time: t.timestamp,
      senderName: t.senderName
    })),
    filters: { startDate: startDate || null, endDate: endDate || null }
  };
}

module.exports = { fetchGroupDetails, findGroupByChatId };
