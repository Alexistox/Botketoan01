const Transaction = require('../models/Transaction');
const Group = require('../models/Group');
const Config = require('../models/Config');
const crypto = require('crypto');
const { Readable } = require('stream');
const { isUserOperator } = require('../utils/permissions');
const { getGroupNumberFormat } = require('../utils/formatter');
const {
  groupTransactionsBySession,
  buildHistoryRichHtmlChunks,
  buildHistoryPlainFallback,
  buildHistoryExcelBuffer,
  sendRichHtml
} = require('../utils/reportHistory');

/**
 * /report h [群组ID] — rich table (Excel-like) lịch sử theo từng phiên 上课 + file .xlsx
 */
const handleReportHCommand = async (bot, msg, options = {}) => {
  const replyChatId = msg.chat.id;
  const replyIdStr = replyChatId.toString();
  const userId = msg.from && msg.from.id != null ? String(msg.from.id) : null;

  try {
    const reportChatId =
      options.reportChatId != null ? String(options.reportChatId) : replyIdStr;
    const isPrivate = !String(reportChatId).startsWith('-');

    if (userId == null) {
      await bot.sendMessage(replyChatId, '⛔ 无法验证身份。');
      return;
    }

    // Quyền: sổ riêng (DM = userId) luôn được; nhóm khác cần operator/admin
    const isOwnDmLedger = isPrivate && userId === String(reportChatId);
    const sameChat = reportChatId === replyIdStr;
    if (!isOwnDmLedger) {
      const allowed = await isUserOperator(userId, reportChatId);
      if (!allowed) {
        await bot.sendMessage(
          replyChatId,
          sameChat
            ? '⛔ 只有操作员或管理员可以使用 /report h。'
            : '⛔ 无权查看该群组的历史报表。需为目标群组的操作员或系统管理员。'
        );
        return;
      }
    }

    const group = await Group.findOne({ chatId: reportChatId });
    if (!group) {
      await bot.sendMessage(
        replyChatId,
        reportChatId === replyIdStr
          ? '没有可用的数据。请先上课或记账。'
          : '未找到该群组或群组未注册。请检查群组 ID。'
      );
      return;
    }

    const transactions = await Transaction.find({
      chatId: reportChatId,
      skipped: { $ne: true }
    })
      .sort({ timestamp: 1 })
      .lean();

    if (!transactions.length) {
      await bot.sendMessage(replyChatId, '暂无交易记录。');
      return;
    }

    const sessions = groupTransactionsBySession(transactions);
    const configCurrency = await Config.findOne({
      key: `CURRENCY_UNIT_${reportChatId}`
    });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    const numberFormat = await getGroupNumberFormat(reportChatId);

    const meta = {
      chatId: reportChatId,
      currencyUnit,
      numberFormat,
      isPrivate
    };

    const richChunks = buildHistoryRichHtmlChunks(meta, sessions);
    let richOk = true;
    for (let i = 0; i < richChunks.length; i += 1) {
      const mode = await sendRichHtml(bot, replyChatId, richChunks[i]);
      if (!mode) {
        richOk = false;
        break;
      }
    }

    if (!richOk) {
      const plain = buildHistoryPlainFallback(meta, sessions);
      // Chia nếu quá dài
      const max = 3500;
      for (let i = 0; i < plain.length; i += max) {
        const part = plain.slice(i, i + max);
        await bot.sendMessage(replyChatId, part, { parse_mode: 'HTML' });
      }
    }

    // Kèm file Excel (dashboard spreadsheet)
    try {
      const { buffer, filename } = buildHistoryExcelBuffer(meta, sessions);
      const stream = Readable.from(buffer);
      await bot.sendDocument(
        replyChatId,
        stream,
        {
          caption: `📎 Excel 报表 · ${sessions.length} 场 · ${transactions.length} 笔`
        },
        {
          filename,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      );
    } catch (excelErr) {
      console.warn(
        '[reportH] excel send failed:',
        excelErr && excelErr.message ? excelErr.message : excelErr
      );
    }
  } catch (error) {
    console.error('Error in handleReportHCommand:', error);
    await bot.sendMessage(replyChatId, '生成历史报表时出错，请稍后重试。');
  }
};

/**
 * /report [群组ID] — tạo link website dashboard (24h).
 * /report1 giữ làm alias.
 */
const handleReportWebCommand = async (bot, msg, options = {}) => {
  const replyChatId = msg.chat.id;
  const replyIdStr = replyChatId.toString();
  const userId = msg.from && msg.from.id != null ? String(msg.from.id) : null;

  try {
    const reportChatId =
      options.reportChatId != null ? String(options.reportChatId) : replyIdStr;
    const isPrivate = !String(reportChatId).startsWith('-');

    if (userId == null) {
      await bot.sendMessage(replyChatId, '⛔ 无法验证身份。');
      return;
    }

    const isOwnDmLedger = isPrivate && userId === String(reportChatId);
    const sameChat = reportChatId === replyIdStr;
    if (!isOwnDmLedger) {
      const allowed = await isUserOperator(userId, reportChatId);
      if (!allowed) {
        await bot.sendMessage(
          replyChatId,
          sameChat
            ? '⛔ 只有操作员或管理员可以使用 /report。'
            : '⛔ 无权查看该群组的仪表盘。需为目标群组的操作员或系统管理员。'
        );
        return;
      }
    }

    const group = await Group.findOne({ chatId: reportChatId });
    if (!group) {
      await bot.sendMessage(
        replyChatId,
        reportChatId === replyIdStr
          ? '❌ 未注册账本。请先上课或记账。'
          : '❌ 未找到该群组或群组未注册。'
      );
      return;
    }

    const timestamp = Date.now();
    const token = crypto
      .createHash('md5')
      .update(
        `${reportChatId}-${timestamp}-${process.env.REPORT_SECRET || 'default-secret'}`
      )
      .digest('hex');

    group.reportToken = token;
    group.reportTokenExpiry = new Date(timestamp + 24 * 60 * 60 * 1000);
    await group.save();

    const { getBaseUrl } = require('../utils/serverUrl');
    const baseUrl = getBaseUrl();
    const reportUrl = `${baseUrl}/report/${encodeURIComponent(reportChatId)}?token=${token}`;

    const transactionCount = await Transaction.countDocuments({
      chatId: reportChatId,
      skipped: { $ne: true }
    });
    const clearCount = await Transaction.countDocuments({
      chatId: reportChatId,
      type: 'clear'
    });

    const scope = isPrivate ? '私聊' : '群组';
    // Link mở trực tiếp: thẻ <a> + nút URL (Telegram mở in-app browser)
    const message =
      `📊 <b>交易仪表盘</b>\n\n` +
      `🔗 <a href="${reportUrl}">点击打开网页报表</a>\n\n` +
      `📂 ${scope} <code>${reportChatId}</code>\n` +
      `📝 交易 ${transactionCount} 笔 · 上课 ${clearCount} 场\n` +
      `⏰ 链接有效期 24 小时\n` +
      `🔒 仅持有链接者可查看\n\n` +
      `提示: <code>/report h</code> 表格+Excel · <code>结束</code> 当前场次电报报告`;

    await bot.sendMessage(replyChatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 打开网页报表 / Mở báo cáo', url: reportUrl }]
        ]
      }
    });
  } catch (error) {
    console.error('Error in handleReportWebCommand:', error);
    await bot.sendMessage(replyChatId, '❌ 生成报告链接时出错，请重试。');
  }
};

/** @deprecated dùng handleReportWebCommand — giữ tên cũ cho import */
const handleReport1Command = handleReportWebCommand;

module.exports = {
  handleReport1Command,
  handleReportWebCommand,
  handleReportHCommand
}; 