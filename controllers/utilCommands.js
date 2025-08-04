const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const Config = require('../models/Config');
const User = require('../models/User');
const { formatSmart, formatRateValue, formatTelegramMessage, formatWithdrawRateMessage, parseSpecialNumber, evaluateSpecialExpression, isTrc20Address, formatDateUS, getUserNumberFormat, getGroupNumberFormat } = require('../utils/formatter');
const { getDepositHistory, getPaymentHistory, getCardSummary } = require('./groupCommands');
const { getButtonsStatus, getInlineKeyboard } = require('./userCommands');

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
 * Xử lý lệnh báo cáo (/report hoặc 结束)
 */
const handleReportCommand = async (bot, chatId, senderName, userId = null) => {
  try {
    // Tìm group
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "没有可用的数据。");
      return;
    }
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Lấy thông tin tất cả các giao dịch trong ngày
    const todayDate = new Date();
    const lastClearDate = group.lastClearDate;
    
    // Lấy tất cả các giao dịch deposit/withdraw
    const depositTransactions = await Transaction.find({
      chatId: chatId.toString(),
      type: { $in: ['deposit', 'withdraw'] },
      timestamp: { $gt: lastClearDate },
      skipped: { $ne: true }
    }).sort({ timestamp: 1 });
    
    // Lấy tất cả các giao dịch payment
    const paymentTransactions = await Transaction.find({
      chatId: chatId.toString(),
      type: 'payment',
      timestamp: { $gt: lastClearDate },
      skipped: { $ne: true }
    }).sort({ timestamp: 1 });
    
    // Format dữ liệu giao dịch deposit
    const depositEntries = depositTransactions.map((t, index) => {
      return {
        id: index + 1,
        details: t.details,
        messageId: t.messageId || null,
        chatLink: t.messageId ? `https://t.me/c/${chatId.toString().replace('-100', '')}/${t.messageId}` : null,
        timestamp: t.timestamp,
        senderName: t.senderName || ''
      };
    });
    
    // Format dữ liệu giao dịch payment
    const paymentEntries = paymentTransactions.map((t, index) => {
      return {
        id: index + 1,
        details: t.details,
        messageId: t.messageId || null,
        chatLink: t.messageId ? `https://t.me/c/${chatId.toString().replace('-100', '')}/${t.messageId}` : null,
        timestamp: t.timestamp,
        senderName: t.senderName || ''
      };
    });
    
    // Lấy thông tin thẻ
    const cardSummary = await getCardSummary(chatId);
    
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
    
    // Lấy format của người dùng nếu có userId
    const userFormat = userId ? await getGroupNumberFormat(chatId) : 'default';
    
    // Format và gửi tin nhắn - sử dụng formatter phù hợp
    const response = hasWithdrawRate ? 
      formatWithdrawRateMessage(responseData, userFormat) : 
      formatTelegramMessage(responseData, userFormat);
    
    // Kiểm tra trạng thái hiển thị buttons
    const showButtons = await getButtonsStatus(chatId);
    const keyboard = showButtons ? await getInlineKeyboard(chatId) : null;
    
    bot.sendMessage(chatId, response, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
  } catch (error) {
    console.error('Error in handleReportCommand:', error);
    bot.sendMessage(chatId, "处理报告命令时出错。请稍后再试。");
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
/report - 查看交易报告
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
/format A - 切换到格式化显示 (1,000,000.00) [全群生效]
/format - 切换到默认显示 (1000000) [全群生效]

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

const handleStartCommand = async (bot, chatId) => {
  try {
    const startMessage = `欢迎使用记账机器人！\n\n开始新账单/ 上课\n记账入账▫️+10000 或者 +数字 [卡号] [额度]\n代付减账▫️-10000\n撤回▫️撤回id\n下发▫️下发 100  或者 %数字 [卡号] [额度]\n设置费率▫️设置汇率1600  或者 \n价格 费率/汇率\n设置操作▫️@群成员  （群成员 必须在设置之前发送消息）\n删除操作▫️@群成员 \n操作人 ▫️ 查看被授权人员名单\n\n+0▫️\n结束| /report`;
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
      // Quay về format mặc định cho cả nhóm
      group.numberFormat = 'default';
      await group.save();
      bot.sendMessage(chatId, "✅ 本群已切换到默认数字格式 (例: 1000000) - 对所有成员生效");
    } else if (messageText === '/format A') {
      // Chuyển sang format có dấu phẩy cho cả nhóm
      group.numberFormat = 'formatted';
      await group.save();
      bot.sendMessage(chatId, "✅ 本群已切换到格式化数字格式 (例: 1,000,000.00) - 对所有成员生效");
    } else {
      // Hiển thị trợ giúp
      const currentFormat = group.numberFormat === 'formatted' ? '格式化显示' : '默认显示';
      bot.sendMessage(chatId, 
        "🔢 *数字格式设置 (对全群生效):*\n\n" +
        "/format A - 切换到格式化显示 (1,000,000.00) [全群生效]\n" +
        "/format - 切换到默认显示 (1000000) [全群生效]\n\n" +
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

/**
 * Xử lý lệnh xuất Excel (/excel)
 */
const handleExcelExportCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    
    // Tìm group
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "没有可用的数据。");
      return;
    }
    
    // Lấy tất cả transactions từ lastClearDate
    const lastClearDate = group.lastClearDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to yesterday
    
    const transactions = await Transaction.find({
      chatId: chatId.toString(),
      timestamp: { $gt: lastClearDate },
      skipped: { $ne: true }
    }).sort({ timestamp: 1 });
    
    if (transactions.length === 0) {
      bot.sendMessage(chatId, "当前没有交易数据可导出。");
      return;
    }
    
    // Import xlsx package (cần cài đặt)
    let XLSX;
    try {
      XLSX = require('xlsx');
    } catch (error) {
      bot.sendMessage(chatId, "系统错误：缺少Excel导出功能所需的依赖包。请联系管理员安装xlsx包。");
      return;
    }
    
    // Chuẩn bị dữ liệu cho Excel
    const excelData = transactions.map((transaction, index) => {
      const vietnamTime = new Date(transaction.timestamp.getTime() + 7 * 60 * 60 * 1000);
      return {
        'ID': index + 1,
        '时间': vietnamTime.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        '类型': getTransactionTypeText(transaction.type),
        '金额': transaction.amount || 0,
        'USDT金额': transaction.usdtAmount || 0,
        '卡号': transaction.cardCode || '',
        '额度': transaction.limit || 0,
        '操作人': transaction.senderName || '',
        '消息': transaction.message || '',
        '详情': transaction.details || '',
        '费率%': transaction.rate || 0,
        '汇率': transaction.exchangeRate || 0,
        '消息ID': transaction.messageId || '',
        '已跳过': transaction.skipped ? '是' : '否',
        '跳过原因': transaction.skipReason || ''
      };
    });
    
    // Tạo workbook và worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Đặt tên cho sheet
    const today = new Date();
    const dateStr = today.toLocaleDateString('zh-CN').replace(/\//g, '-');
    const sheetName = `交易记录_${dateStr}`;
    
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Tạo buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Tạo tên file
    const fileName = `交易记录_群组${Math.abs(chatId)}_${dateStr}.xlsx`;
    
    // Gửi file Excel
    bot.sendDocument(chatId, buffer, {
      filename: fileName,
      caption: `📊 交易记录导出\n📅 导出时间: ${today.toLocaleString('zh-CN')}\n📈 总记录数: ${transactions.length}条\n👤 导出人: ${senderName}`
    }, {
      filename: fileName,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
  } catch (error) {
    console.error('Error in handleExcelExportCommand:', error);
    bot.sendMessage(msg.chat.id, "导出Excel文件时出错。请稍后再试。");
  }
};

/**
 * Chuyển đổi loại transaction thành text tiếng Trung
 */
const getTransactionTypeText = (type) => {
  const typeMap = {
    'deposit': '入款',
    'withdraw': '出款', 
    'payment': '代付',
    'setRate': '设置费率',
    'setExchangeRate': '设置汇率',
    'setWithdrawRate': '设置出款费率',
    'clear': '清空数据',
    'delete': '删除',
    'skip': '跳过'
  };
  return typeMap[type] || type;
};

module.exports = {
  handleCalculateUsdtCommand,
  handleCalculateVndCommand,
  handleMathExpression,
  handleTrc20Address,
  handleReportCommand,
  handleHelpCommand,
  handleStartCommand,
  handleFormatCommand,
  handlePicCommand,
  isPicModeEnabled,
  handleExcelExportCommand
}; 