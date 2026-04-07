const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const Config = require('../models/Config');
const User = require('../models/User');
const { formatSmart, formatRateValue, formatTelegramMessage, formatWithdrawRateMessage, parseSpecialNumber, evaluateSpecialExpression, isTrc20Address, formatDateUS, getUserNumberFormat, getGroupNumberFormat } = require('../utils/formatter');
const { sendLongMarkdownMessage } = require('../utils/telegramChunks');
const { isUserOperator } = require('../utils/permissions');
const { getDepositHistory, getPaymentHistory, getCardSummary } = require('./groupCommands');
const { getButtonsStatus, getInlineKeyboard } = require('./userCommands');

/**
 * Chuẩn hóa ID nhóm từ đối số /report (vd -100xxx hoặc chỉ phần số sau -100).
 */
function normalizeReportChatIdArg(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const s = raw.trim().split('@')[0].trim();
  if (!s || !/^-?\d+$/.test(s)) return null;
  if (s.startsWith('-')) return s;
  return `-100${s}`;
}

/**
 * Xử lý lệnh tính toán USDT (/t)
 */
const handleCalculateUsdtCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Phân tích tin nhắn
    const parts = messageText.split('/t ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /t 50000");
      return;
    }
    
    // Lấy số tiền VND
    const amount = parseSpecialNumber(parts[1].trim());
    if (isNaN(amount)) {
      bot.sendMessage(chatId, "");
      return; 
    }
    
    // Tìm group
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group || !group.exchangeRate || !group.rate) {
      bot.sendMessage(chatId, "请先设置汇率和费率。");
      return;
    }
    
    // Tính toán
    const xValue = group.rate;
    const yValue = group.exchangeRate;
    const usdtValue = (amount / yValue) * (1 - xValue / 100);
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Lấy format của người dùng trong nhóm này
    const userFormat = await getGroupNumberFormat(chatId);
    
    // Gửi kết quả
    bot.sendMessage(
      chatId,
      `🔄 ${formatSmart(amount, userFormat)} ➡️ ${currencyUnit} ${formatSmart(usdtValue, userFormat)}\n` +
      `(汇率: ${formatRateValue(yValue)}, 费率: ${formatRateValue(xValue)}%)`
    );
  } catch (error) {
    console.error('Error in handleCalculateUsdtCommand:', error);
    bot.sendMessage(msg.chat.id, "");
  }
};

/**
 * Xử lý lệnh tính toán VND (/v)
 */
const handleCalculateVndCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Phân tích tin nhắn
    const parts = messageText.split('/v ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /v 100");
      return;
    }
    
    // Lấy số tiền USDT
    const amount = parseSpecialNumber(parts[1].trim());
    if (isNaN(amount)) {
      bot.sendMessage(chatId, "");
      return;
    }
    
    // Tìm group
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group || !group.exchangeRate || !group.rate) {
      bot.sendMessage(chatId, "请先设置汇率和费率。");
      return;
    }
    
    // Tính toán
    const xValue = group.rate;
    const yValue = group.exchangeRate;
    const vndValue = (amount / (1 - xValue / 100)) * yValue;
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Lấy format của người dùng trong nhóm này
    const userFormat = await getGroupNumberFormat(chatId);
    
    // Gửi kết quả
    bot.sendMessage(
      chatId,
      `🔄 ${currencyUnit} ${formatSmart(amount, userFormat)} ➡️ ${formatSmart(vndValue, userFormat)}\n` +
      `(汇率: ${formatRateValue(yValue)}, 费率: ${formatRateValue(xValue)}%)`
    );
  } catch (error) {
    console.error('Error in handleCalculateVndCommand:', error);
    bot.sendMessage(msg.chat.id, "");
  }
};

/**
 * Xử lý biểu thức toán học
 */
const handleMathExpression = async (bot, chatId, expression, senderName) => {
  try {
    // Tính toán kết quả
    let result;
    try {
      result = evaluateSpecialExpression(expression);
      if (isNaN(result)) {
        result = eval(expression); // fallback cho biểu thức thông thường
      }
    } catch (error) {
      bot.sendMessage(chatId, "");
      return;
    }
    
    if (isNaN(result)) {
      bot.sendMessage(chatId, "");
      return;
    }
    
    // Gửi kết quả với format mặc định cho biểu thức toán học
    bot.sendMessage(
      chatId,
      `${expression} = ${formatSmart(result)}`
    );
  } catch (error) {
    console.error('Error in handleMathExpression:', error);
    bot.sendMessage(chatId, "");
  }
}; 

/**
 * Xử lý địa chỉ TRC20
 */
const handleTrc20Address = async (bot, chatId, address, senderName) => {
  try {
    // Gửi kết quả
    bot.sendMessage(
      chatId,
      `🔍 USDT-TRC20 地址:\n\`${address}\``
    );
  } catch (error) {
    console.error('Error in handleTrc20Address:', error);
    bot.sendMessage(chatId, "处理TRC20地址时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh báo cáo (/report [群组ID] hoặc 结束)
 * @param {object} [options]
 * @param {string} [options.reportChatId] - Nhóm cần báo cáo; mặc định = chat nơi gửi lệnh
 */
const handleReportCommand = async (bot, replyChatId, senderName, userId = null, options = {}) => {
  try {
    const replyIdStr = replyChatId.toString();
    const reportChatId =
      options.reportChatId != null ? String(options.reportChatId) : replyIdStr;

    const isDm = !replyIdStr.startsWith('-');
    if (options.reportChatId == null && isDm) {
      bot.sendMessage(
        replyChatId,
        "在私聊请指定群组：`/report -100xxxxxxxxxx`（需为该群操作员或管理员）"
      );
      return;
    }

    if (reportChatId !== replyIdStr) {
      if (userId == null) {
        bot.sendMessage(replyChatId, "⛔ 无法验证身份，无法查看其他群组报告。");
        return;
      }
      const allowed = await isUserOperator(userId, reportChatId);
      if (!allowed) {
        bot.sendMessage(
          replyChatId,
          "⛔ 无权查看该群组的报告。需为目标群组的操作员或系统管理员。"
        );
        return;
      }
    }

    // Tìm group
    const group = await Group.findOne({ chatId: reportChatId });
    if (!group) {
      bot.sendMessage(
        replyChatId,
        reportChatId === replyIdStr ? "没有可用的数据。" : "未找到该群组或群组未注册。请检查群组 ID。"
      );
      return;
    }
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${reportChatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Lấy thông tin tất cả các giao dịch trong ngày
    const todayDate = new Date();
    const lastClearDate = group.lastClearDate;
    
    // Lấy tất cả các giao dịch deposit/withdraw
    const depositTransactions = await Transaction.find({
      chatId: reportChatId,
      type: { $in: ['deposit', 'withdraw'] },
      timestamp: { $gt: lastClearDate },
      skipped: { $ne: true }
    }).sort({ timestamp: -1 });
    
    // Lấy tất cả các giao dịch payment
    const paymentTransactions = await Transaction.find({
      chatId: reportChatId,
      type: 'payment',
      timestamp: { $gt: lastClearDate },
      skipped: { $ne: true }
    }).sort({ timestamp: -1 });
    
    // Format dữ liệu giao dịch deposit (mới nhất trước)
    const depositEntries = depositTransactions.map((t, index) => {
      return {
        id: depositTransactions.length - index, // ID mới nhất = length, cũ nhất = 1
        details: t.details,
        messageId: t.messageId || null,
        chatLink: t.messageId ? `https://t.me/c/${reportChatId.replace('-100', '')}/${t.messageId}` : null,
        timestamp: t.timestamp,
        senderName: t.senderName || ''
      };
    });
    
    // Format dữ liệu giao dịch payment (mới nhất trước)
    const paymentEntries = paymentTransactions.map((t, index) => {
      return {
        id: paymentTransactions.length - index, // ID mới nhất = length, cũ nhất = 1
        details: t.details,
        messageId: t.messageId || null,
        chatLink: t.messageId ? `https://t.me/c/${reportChatId.replace('-100', '')}/${t.messageId}` : null,
        timestamp: t.timestamp,
        senderName: t.senderName || ''
      };
    });
    
    // Lấy thông tin thẻ
    const cardSummary = await getCardSummary(reportChatId);
    
    // Tạo response JSON với tất cả giao dịch
    const responseData = {
      date: formatDateUS(todayDate),
      depositData: { 
        entries: depositEntries, 
        totalCount: depositEntries.length 
      },
      paymentData: { 
        entries: paymentEntries, 
        totalCount: paymentEntries.length 
      },
      rate: formatRateValue(group.rate) + "%",
      exchangeRate: formatRateValue(group.exchangeRate),
      totalAmount: formatSmart(group.totalVND),
      totalUSDT: formatSmart(group.totalUSDT),
      totalDepositUSDT: formatSmart(group.totalDepositUSDT || 0),
      totalDepositVND: formatSmart(group.totalDepositVND || 0),
      totalWithdrawUSDT: formatSmart(group.totalWithdrawUSDT || 0),
      totalWithdrawVND: formatSmart(group.totalWithdrawVND || 0),
      paidUSDT: formatSmart(group.usdtPaid),
      remainingUSDT: formatSmart(group.remainingUSDT),
      currencyUnit,
      cards: cardSummary
    };
    
    // Kiểm tra nếu có withdraw rate để hiển thị thông tin đầy đủ
    const hasWithdrawRate = group.withdrawRate !== null && group.withdrawExchangeRate !== null;
    if (hasWithdrawRate) {
      responseData.withdrawRate = formatRateValue(group.withdrawRate) + "%";
      responseData.withdrawExchangeRate = formatRateValue(group.withdrawExchangeRate);
    }
    
    // Định dạng số theo nhóm được báo cáo
    const userFormat = await getGroupNumberFormat(reportChatId);
    
    // Format và gửi tin nhắn - sử dụng formatter phù hợp
    const response = hasWithdrawRate ? 
      formatWithdrawRateMessage(responseData, userFormat) : 
      formatTelegramMessage(responseData, userFormat);
    
    // Chỉ hiện inline keyboard khi báo cáo đúng nhóm đang chat (tránh nút gắn nhầm nhóm)
    const sameChat = reportChatId === replyIdStr;
    const showButtons = sameChat ? await getButtonsStatus(reportChatId) : false;
    const keyboard = showButtons ? await getInlineKeyboard(reportChatId) : null;
    
    await sendLongMarkdownMessage(bot, replyChatId, response, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
  } catch (error) {
    console.error('Error in handleReportCommand:', error);
    bot.sendMessage(replyChatId, "处理报告命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh trợ giúp (/help)
 */
const handleHelpCommand = async (bot, chatId) => {
  try {
    const helpMessage = `
📖 *记账机器人使用说明* 📖

🔒 *权限分级:*
👑 机器人所有者 | 🔰 管理员 | 🔹 操作员 | 👤 普通成员

-------------------------
*基础命令:*
/start - 启动机器人
/help - 查看帮助
/off - 结束会话
/u - 查看当前USDT地址 或者 u来u来
/report - 查看当前群交易报告
/report -100xxx - 查看指定群报告（需为该群操作员或管理员）
/ops - 操作员列表 或者 操作人

-------------------------
*汇率与费率:*
/t [金额] - VND转USDT (例: /t 1000000)
/v [金额] - USDT转VND (例: /v 100)
/d [费率]/[汇率] - 临时设置费率和汇率 (例: /d 2/14600)
/d2 [出款费率]/[出款汇率] - 设置出款费率和汇率 (例: /d2 3/14800)
/d2 off - 关闭出款汇率费率显示
或者 价格 费率/汇率
设置费率 [数值] - 设置费率 (例: 设置费率2)
设置汇率 [数值] - 设置汇率 (例: 设置汇率14600)

-------------------------
*交易命令（操作员）:*
+ [金额] [备注/卡号] [额度] - 添加入金 (例: +1000000 ABC123 50000)
- [金额] [备注/卡号] - 添加出金 (例: -500000 ABC123)
下发 [USDT] [卡号] - 标记已支付 (例: 下发100 ABC123)
上课 - 清空今日交易
/delete [ID] - 删除交易记录
/skip [ID] - 跳过某条交易


-------------------------
*银行卡管理:*
/x [卡号] - 隐藏银行卡
/sx [卡号] - 显示银行卡
/hiddenCards - 查看所有隐藏卡

-------------------------
*QR码生成:*
/qr on - 开启QR码生成模式
/qr off - 关闭QR码生成模式
发送银行信息格式:
账号
持卡人姓名
银行名称
金额
备注（可选）

-------------------------
*自定义按钮:*
/inline [按钮]|[命令] - 添加按钮
/removeinline [按钮] - 删除按钮
/buttons - 查看所有按钮

-------------------------
*管理员命令:*
/usdt 或者 设置地址 [地址] - 设置USDT地址
确认人 @用户名 - 设置确认人
删除确认人 @用户名 - 删除确认人
/op 或者 操作人  @用户名 - 添加操作员
/removeop 或者 删除操作人 @用户名 - 删除操作员

-------------------------
*所有者命令:*
/ad @用户名 - 添加管理员
添加管理员
/removead @用户名 - 移除管理员
删除管理员
/remove @用户名 - 移除用户
/migrate - 数据迁移

-------------------------
*数字格式设置:*
/format A - 格式化显示 (1,000,000.00)，与机器人默认相同 [全群生效]
/format - 简单显示 (1000000)，无千分位分隔 [全群生效]

-------------------------
*其他功能:*
/c - 从图片提取银行信息
输入数学表达式如 2+2 直接计算
输入TRC20地址自动格式化显示

-------------------------
💡 如有疑问请联系群管理员。
`;
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in handleHelpCommand:', error);
    bot.sendMessage(chatId, "显示帮助信息时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh trợ giúp chi tiết (/help2)
 */
const handleHelp2Command = async (bot, chatId) => {
  try {
    const help2Message = `
📚 *HƯỚNG DẪN CHI TIẾT TOÀN BỘ LỆNH BOT*

🔐 *Phân quyền:*
- 👑 Owner: toàn quyền
- 🛠 Admin: quản trị người dùng/hệ thống
- 🔹 Operator: thao tác nghiệp vụ nhóm
- 👤 Member: người dùng thường

━━━━━━━━━━━━━━━━━━
*1) Lệnh cơ bản*
- \`/start\` hoặc \`/st\`: mở hướng dẫn nhanh
- \`/help\`: trợ giúp ngắn
- \`/help2\`: trợ giúp chi tiết (lệnh này)
- \`/off\`: gửi lời kết phiên
- \`/report\` hoặc \`结束\`: báo cáo tổng hợp nhóm hiện tại
- \`/report -100...\`: báo cáo nhóm khác (operator/admin nhóm đó); ví dụ \`/report -1001234567890\`
- \`/report1\`: báo cáo chi tiết hơn (Operator)

━━━━━━━━━━━━━━━━━━
*2) Quy đổi & biểu thức*
- \`/t <VND>\`: đổi VND -> USDT
- \`/v <USDT>\`: đổi USDT -> VND
- Nhập biểu thức toán trực tiếp: ví dụ \`12w+5\`, \`1亿+2亿\`, \`1y/2\`
- Hỗ trợ ký hiệu số: \`k\`, \`m\`, \`w\`, \`万\`, \`亿\`, \`y\`, \`个亿\`

━━━━━━━━━━━━━━━━━━
*3) Tỷ giá & phí (Operator)*
- \`设置费率<giá trị>\` (vd: \`设置费率2\`)
- \`设置汇率<giá trị>\` (vd: \`设置汇率14600\`)
- \`/d <phí>/<tỷ giá>\` hoặc alias \`价格\`
- \`/d2 <phí xuất>/<tỷ giá xuất>\`
- \`/d2 off\`: tắt hiển thị phí/tỷ giá xuất
- \`上课\` / \`Start\` / \`开始新账单\`: reset phiên làm việc

━━━━━━━━━━━━━━━━━━
*4) Giao dịch (Operator)*
- \`+<số tiền> [mã thẻ] [hạn mức]\`: cộng giao dịch
- \`-<số tiền> [mã thẻ]\`: trừ giao dịch
- \`下发 <USDT> [mã thẻ]\` hoặc \`%...\`: đánh dấu đã chi
- \`/delete <ID>\`: xóa giao dịch
- \`/skip <ID>\` hoặc alias \`撤回 <ID>\`: bỏ qua giao dịch

━━━━━━━━━━━━━━━━━━
*5) Thẻ ngân hàng (Operator)*
- \`/x <mã thẻ>\`: ẩn thẻ
- \`/sx <mã thẻ>\`: hiện lại thẻ
- \`/hiddenCards\`: danh sách thẻ đang ẩn

━━━━━━━━━━━━━━━━━━
*6) QR / ảnh / OCR*
- \`/qr on\` | \`/qr off\`: bật/tắt QR mode
- \`/c\`: trích xuất thông tin ngân hàng từ ảnh
- \`/pic on\` | \`/pic off\`: bật/tắt chế độ xử lý reply ảnh (1/2/3)

━━━━━━━━━━━━━━━━━━
*7) Địa chỉ USDT*
- \`/usdt <address>\` hoặc alias \`设置地址 <address>\` (Admin+)
- \`/u\` hoặc alias \`u来u来\`: xem địa chỉ USDT hiện tại
- \`/rmusdt ...\` hoặc alias \`删除usdt ...\`: xóa địa chỉ USDT (Admin+)
- Gửi chuỗi TRC20 bot sẽ tự nhận diện và format

━━━━━━━━━━━━━━━━━━
*8) Quản lý operator / admin / owner*
- \`/op @user\` hoặc \`设置操作 @user\`: thêm operator (Admin+)
- \`/removeop @user\` hoặc \`删除操作 @user\`: xóa operator (Admin+)
- \`/ops\` hoặc \`操作人\`: xem operator
- \`/ad @user\` / \`添加管理员 ...\`: thêm admin (Owner)
- \`/removead @user\` / \`删除管理员 ...\`: xóa admin (Owner)
- \`/admins\`: danh sách admin
- \`/setowner ...\`: đặt owner (Owner)
- \`/remove ...\`: gỡ người dùng (Owner)
- \`/migrate\`: migrate dữ liệu (Owner)

━━━━━━━━━━━━━━━━━━
*9) Button tùy chỉnh*
- \`/inline <text>|<command>\`: thêm/sửa nút
- \`/removeinline <text>\`: xóa nút
- \`/buttons\`: xem nút
- \`/onbut\` | \`/offbut\`: bật/tắt hiển thị nút
- \`/inline2 ...\`, \`/removeinline2 ...\`, \`/buttons2\`, \`/chat ...\`: nhóm lệnh button/chat mở rộng

━━━━━━━━━━━━━━━━━━
*10) Định dạng số*
- \`/format A\`: format có phân tách (vd: 1,000,000.00) — trùng mặc định bot
- \`/format\`: số thuần không phân tách nghìn (vd: 1000000)

━━━━━━━━━━━━━━━━━━
*11) Broadcast nhóm/tin đã lưu (Operator)*
- \`/g <mã>\`: thêm nhóm hiện tại vào tập mã
- \`/glist\`: xem tất cả tập nhóm (id + tên nhóm)
- \`/dg\`: gỡ nhóm hiện tại khỏi mọi tập
- \`/dg <id nhóm>\`: gỡ id đó khỏi mọi tập
- \`/dg <mã>\`: gỡ nhóm hiện tại khỏi 1 tập mã
- \`/cm <mã tin>\`: lưu tin (reply tin cần lưu hoặc gửi media kèm caption)
- \`/cmlist\`: xem mã tin đã lưu + gửi lại toàn bộ nội dung đã lưu
- \`/dm <mã tin>\`: xóa tin đã lưu
- \`/send <mã tin> <mã nhóm|id>\`: gửi tin đã lưu tới nhóm đích
- Reply 1 tin rồi dùng \`/send <mã nhóm|id>\`: gửi trực tiếp tin reply

💡 *Gợi ý:* trong đa số nhóm, lệnh nghiệp vụ cần quyền Operator trở lên.
`;
    const maxLen = 3800;
    const chunks = [];
    let remaining = help2Message.trim();

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      const piece = remaining.slice(0, maxLen);
      let splitAt = piece.lastIndexOf('\n');
      if (splitAt < 500) splitAt = maxLen;

      const chunk = remaining.slice(0, splitAt).trim();
      chunks.push(chunk);
      remaining = remaining.slice(splitAt).trim();
    }

    for (let i = 0; i < chunks.length; i += 1) {
      const prefix = chunks.length > 1 ? `📚 Help2 (${i + 1}/${chunks.length})\n\n` : '';
      // Gửi plain text để tránh lỗi Markdown khi nội dung bị chia nhỏ.
      await bot.sendMessage(chatId, `${prefix}${chunks[i]}`);
    }
  } catch (error) {
    console.error('Error in handleHelp2Command:', error);
    bot.sendMessage(chatId, "Hiển thị trợ giúp chi tiết thất bại. Vui lòng thử lại sau.");
  }
};

const handleStartCommand = async (bot, chatId) => {
  try {
    const startMessage = `欢迎使用记账机器人！\n\n开始新账单/ 上课\n记账入账▫️+10000 或者 +数字 [卡号] [额度]\n代付减账▫️-10000\n撤回▫️撤回id\n下发▫️下发 100  或者 %数字 [卡号] [额度]\n设置费率▫️设置汇率1600  或者 \n价格 费率/汇率\n设置操作▫️@群成员  （群成员 必须在设置之前发送消息）\n删除操作▫️@群成员 \n操作人 ▫️ 查看被授权人员名单\n\n+0▫️\n结束| /report（群内）| 私聊/跨群 /report -100群ID（需操作员）`;
    bot.sendMessage(chatId, startMessage);
  } catch (error) {
    console.error('Error in handleStartCommand:', error);
    bot.sendMessage(chatId, "显示账单帮助信息时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh cài đặt format số (/format A)
 */
const handleFormatCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "请先设置汇率和费率后再设置数字格式。");
      return;
    }
    
    if (messageText === '/format') {
      // Kiểu số thuần (không phân tách nghìn) — khác với mặc định bot (formatted)
      group.numberFormat = 'default';
      await group.save();
      bot.sendMessage(chatId, "✅ 本群已切换到简单数字格式 (例: 1000000) - 对所有成员生效");
    } else if (messageText === '/format A') {
      // Giống mặc định bot: có dấu phẩy phần nghìn
      group.numberFormat = 'formatted';
      await group.save();
      bot.sendMessage(chatId, "✅ 本群已切换到格式化数字格式 (例: 1,000,000.00) - 对所有成员生效");
    } else {
      // Hiển thị trợ giúp
      const currentFormat = group.numberFormat === 'formatted' ? '格式化显示 (默认)' : '简单显示';
      bot.sendMessage(chatId, 
        "🔢 *数字格式设置 (对全群生效):*\n\n" +
        "/format A - 格式化显示 (1,000,000.00)，与机器人默认相同 [全群生效]\n" +
        "/format - 简单显示 (1000000)，无千分位分隔 [全群生效]\n\n" +
        "本群当前格式: " + currentFormat,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('Error in handleFormatCommand:', error);
    bot.sendMessage(msg.chat.id, "处理格式命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh /pic on/off - bật/tắt chế độ trích xuất ảnh
 */
const handlePicCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text.trim();
    
    // Lấy tham số (on hoặc off)
    const param = messageText.substring(4).trim().toLowerCase();
    
    if (param !== 'on' && param !== 'off') {
      bot.sendMessage(chatId, "语法无效。使用: /pic on 或 /pic off");
      return;
    }
    
    // Lưu trạng thái vào Config
    const configKey = `PIC_MODE_${chatId}`;
    
    if (param === 'on') {
      await Config.findOneAndUpdate(
        { key: configKey },
        { key: configKey, value: 'true' },
        { upsert: true, new: true }
      );
      bot.sendMessage(chatId, "✅ 已开启图片识别模式\n\n📋 使用方法：\n• 回复 \"1\" → 自动执行 + 命令\n• 回复 \"2\" → 自动执行 % 命令\n• 回复 \"3\" → 自动执行 - 命令\n\n💡 回复包含金额的图片或图片标题");
    } else {
      await Config.findOneAndUpdate(
        { key: configKey },
        { key: configKey, value: 'false' },
        { upsert: true, new: true }
      );
      bot.sendMessage(chatId, "❌ 已关闭图片识别模式");
    }
    
  } catch (error) {
    console.error('Error in handlePicCommand:', error);
    bot.sendMessage(msg.chat.id, "处理图片模式命令时出错。请稍后再试。");
  }
};

/**
 * Kiểm tra xem chế độ pic có được bật không
 */
const isPicModeEnabled = async (chatId) => {
  try {
    const config = await Config.findOne({ key: `PIC_MODE_${chatId}` });
    return config && config.value === 'true';
  } catch (error) {
    console.error('Error checking pic mode:', error);
    return false;
  }
};

module.exports = {
  handleCalculateUsdtCommand,
  handleCalculateVndCommand,
  handleMathExpression,
  handleTrc20Address,
  normalizeReportChatIdArg,
  handleReportCommand,
  handleHelpCommand,
  handleHelp2Command,
  handleStartCommand,
  handleFormatCommand,
  handlePicCommand,
  isPicModeEnabled
}; 