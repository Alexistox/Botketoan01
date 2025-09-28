const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const Config = require('../models/Config');
const { formatSmart, formatRateValue, formatTelegramMessage, formatWithdrawRateMessage, parseSpecialNumber, formatDateUS, getUserNumberFormat, getGroupNumberFormat } = require('../utils/formatter');
const { getButtonsStatus, getInlineKeyboard } = require('./userCommands');

/**
 * Xử lý lệnh clear (上课) - Reset các giá trị về 0
 */
const handleClearCommand = async (bot, msg) => {
  try {
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: msg.chat.id.toString() });
    
    // Lấy rate và exchangeRate hiện tại
    const currentRate = group ? group.rate : 0;
    const currentExRate = group ? group.exchangeRate : 0;
    
    if (!group) {
      group = new Group({
        chatId: msg.chat.id.toString(),
        totalVND: 0,
        totalUSDT: 0,
        totalDepositUSDT: 0,
        totalDepositVND: 0,
        totalWithdrawUSDT: 0,
        totalWithdrawVND: 0,
        usdtPaid: 0,
        remainingUSDT: 0,
        rate: currentRate,
        exchangeRate: currentExRate,
        lastClearDate: new Date()
      });
    } else {
      group.totalVND = 0;
      group.totalUSDT = 0;
      group.totalDepositUSDT = 0;
      group.totalDepositVND = 0;
      group.totalWithdrawUSDT = 0;
      group.totalWithdrawVND = 0;
      group.usdtPaid = 0;
      group.remainingUSDT = 0;
      group.lastClearDate = new Date();
    }
    
    await group.save();
    
    // Lưu transaction mới
    const transaction = new Transaction({
      chatId: msg.chat.id.toString(),
      type: 'clear',
      message: '/clear',
      senderName: msg.from.first_name,
      rate: currentRate,
      exchangeRate: currentExRate,
      timestamp: new Date()
    });
    
    await transaction.save();
    
    // Xóa toàn bộ thẻ thuộc nhóm hiện tại
    await Card.deleteMany({ chatId: msg.chat.id.toString() });
    
    // Kiểm tra nếu có withdraw rate để hiển thị thông tin đầy đủ
    const hasWithdrawRate = group.withdrawRate !== null && group.withdrawExchangeRate !== null;
    
    // Chỉ hiển thị thông báo đơn giản về tỷ giá
    let simpleMessage = `上课！`;
    
    if (currentRate !== null && currentExRate !== null) {
      simpleMessage += `收款费率: ${formatRateValue(currentRate)}% | 汇率: ${formatRateValue(currentExRate)}`;
      
      if (hasWithdrawRate) {
        simpleMessage += `出款费率: ${formatRateValue(group.withdrawRate)}% | 汇率: ${formatRateValue(group.withdrawExchangeRate)}`;
      }
    }
    
    bot.sendMessage(msg.chat.id, simpleMessage);
    
  } catch (error) {
    console.error('Error in handleClearCommand:', error);
    bot.sendMessage(msg.chat.id, "处理清除命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh đặt rate (设置费率)
 */
const handleRateCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    
    // Trích xuất giá trị rate từ tin nhắn
    const inputText = messageText.substring(4).trim();
    
    if (!inputText) {
      bot.sendMessage(chatId, "语法无效。例如: 设置费率2 (对应2%)");
      return;
    }
    
    // Chuyển đổi sang số
    const xValue = parseSpecialNumber(inputText);
    if (isNaN(xValue)) {
      bot.sendMessage(chatId, "输入值无效。");
      return;
    }
    
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({
        chatId: chatId.toString(),
        rate: xValue
      });
    } else {
      group.rate = xValue;
    }
    
    await group.save();
    
    // Lưu transaction mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'setRate',
      amount: 0,
      message: messageText,
      senderName,
      rate: xValue,
      exchangeRate: group.exchangeRate,
      timestamp: new Date()
    });
    
    await transaction.save();
    
    // Tính toán giá trị ví dụ
    let exampleValue = 0;
    if (group.exchangeRate > 0) {
      exampleValue = (100000 / group.exchangeRate) * (1 - xValue / 100);
    }
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Lấy thông tin giao dịch gần đây
    const todayDate = new Date();
    const depositData = await getDepositHistory(chatId);
    const paymentData = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const responseData = {
      date: formatDateUS(todayDate),
      depositData,
      paymentData,
      rate: formatRateValue(xValue) + "%",
      exchangeRate: formatRateValue(group.exchangeRate),
      example: formatSmart(exampleValue),
      totalAmount: formatSmart(group.totalVND),
      totalUSDT: formatSmart(group.totalUSDT),
      paidUSDT: formatSmart(group.usdtPaid),
      remainingUSDT: formatSmart(group.remainingUSDT),
      currencyUnit,
      cards: cardSummary
    };
    
    // Lấy format của người dùng
    const userFormat = await getGroupNumberFormat(chatId);
    
    // Format và gửi tin nhắn
    const response = formatTelegramMessage(responseData, userFormat);
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error in handleRateCommand:', error);
    bot.sendMessage(msg.chat.id, "处理费率命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh đặt tỷ giá (设置汇率)
 */
const handleExchangeRateCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    
    // Trích xuất giá trị tỷ giá từ tin nhắn
    const inputText = messageText.substring(4).trim();
    
    if (!inputText) {
      bot.sendMessage(chatId, "语法无效。例如: 设置汇率23000");
      return;
    }
    
    // Chuyển đổi sang số
    const yValue = parseSpecialNumber(inputText);
    if (isNaN(yValue)) {
      bot.sendMessage(chatId, "输入值无效。");
      return;
    }
    
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({
        chatId: chatId.toString(),
        exchangeRate: yValue
      });
    } else {
      group.exchangeRate = yValue;
    }
    
    await group.save();
    
    // Lưu transaction mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'setExchangeRate',
      amount: 0,
      message: messageText,
      senderName,
      rate: group.rate,
      exchangeRate: yValue,
      timestamp: new Date()
    });
    
    await transaction.save();
    
    // Tính toán giá trị ví dụ
    let exampleValue = 0;
    if (yValue > 0) {
      exampleValue = (100000 / yValue) * (1 - group.rate / 100);
    }
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Lấy thông tin giao dịch gần đây
    const todayDate = new Date();
    const depositData = await getDepositHistory(chatId);
    const paymentData = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const responseData = {
      date: formatDateUS(todayDate),
      depositData,
      paymentData,
      rate: formatRateValue(group.rate) + "%",
      exchangeRate: formatRateValue(yValue),
      example: formatSmart(exampleValue),
      totalAmount: formatSmart(group.totalVND),
      totalUSDT: formatSmart(group.totalUSDT),
      paidUSDT: formatSmart(group.usdtPaid),
      remainingUSDT: formatSmart(group.remainingUSDT),
      currencyUnit,
      cards: cardSummary
    };
    
    // Lấy format của người dùng
    const userFormat = await getGroupNumberFormat(chatId);
    
    // Format và gửi tin nhắn
    const response = formatTelegramMessage(responseData, userFormat);
    bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error in handleExchangeRateCommand:', error);
    bot.sendMessage(msg.chat.id, "处理汇率命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh đặt cả 2 giá trị rate và exchangeRate (/d)
 */
const handleDualRateCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    
    // Trích xuất tham số từ tin nhắn
    const param = messageText.substring(3).trim();
    const parts = param.split('/');
    
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /d 2/14600");
      return;
    }
    
    const newRate = parseSpecialNumber(parts[0]);
    const newExRate = parseSpecialNumber(parts[1]);
    
    if (isNaN(newRate) || isNaN(newExRate)) {
      bot.sendMessage(chatId, "输入的数值无效，请检查后重试。");
      return;
    }
    
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({
        chatId: chatId.toString(),
        rate: newRate,
        exchangeRate: newExRate
      });
    } else {
      group.rate = newRate;
      group.exchangeRate = newExRate;
    }
    
    await group.save();
    
    // Lưu transaction mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'setRate',
      amount: 0,
      message: messageText,
      senderName,
      rate: newRate,
      exchangeRate: newExRate,
      timestamp: new Date()
    });
    
    await transaction.save();
    
    // Chỉ hiển thị thông báo đã thay đổi tỷ giá
    bot.sendMessage(chatId, `✅ 已设置入款费率: ${formatRateValue(newRate)}% | 汇率: ${formatRateValue(newExRate)}`);
    
  } catch (error) {
    console.error('Error in handleDualRateCommand:', error);
    bot.sendMessage(msg.chat.id, "处理双费率命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh đặt 出款费率 và 出款汇率 (/d2)
 */
const handleWithdrawRateCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    
    // Trích xuất tham số từ tin nhắn
    const param = messageText.substring(4).trim();
    
    // Kiểm tra lệnh tắt
    if (param.toLowerCase() === 'off') {
      // Tìm group
      let group = await Group.findOne({ chatId: chatId.toString() });
      if (!group) {
        bot.sendMessage(chatId, "没有找到群组信息。");
        return;
      }
      
      // Reset withdraw rate về null
      group.withdrawRate = null;
      group.withdrawExchangeRate = null;
      await group.save();
      
      bot.sendMessage(chatId, "已关闭出款汇率费率显示，回到普通模式。");
      return;
    }
    
    const parts = param.split('/');
    
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /d2 3/14800 或者 /d2 off");
      return;
    }
    
    const newWithdrawRate = parseSpecialNumber(parts[0]);
    const newWithdrawExRate = parseSpecialNumber(parts[1]);
    
    if (isNaN(newWithdrawRate) || isNaN(newWithdrawExRate)) {
      bot.sendMessage(chatId, "输入的数值无效，请检查后重试。");
      return;
    }
    
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({
        chatId: chatId.toString(),
        withdrawRate: newWithdrawRate,
        withdrawExchangeRate: newWithdrawExRate
      });
    } else {
      group.withdrawRate = newWithdrawRate;
      group.withdrawExchangeRate = newWithdrawExRate;
    }
    
    await group.save();
    
    // Lưu transaction mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'setWithdrawRate',
      amount: 0,
      message: messageText,
      senderName,
      rate: newWithdrawRate,
      exchangeRate: newWithdrawExRate,
      timestamp: new Date()
    });
    
    await transaction.save();
    
    // Chỉ hiển thị thông báo đã thay đổi tỷ giá xuất tiền
    bot.sendMessage(chatId, `✅ 已设置出款费率: ${formatRateValue(newWithdrawRate)}% | 汇率: ${formatRateValue(newWithdrawExRate)}`);
    
  } catch (error) {
    console.error('Error in handleWithdrawRateCommand:', error);
    bot.sendMessage(msg.chat.id, "处理出款费率命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh xóa dữ liệu nhóm (/delete)
 */
const handleDeleteCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Xóa tất cả giao dịch của nhóm
    await Transaction.deleteMany({ chatId: chatId.toString() });
    
    // Xóa tất cả thông tin thẻ
    await Card.deleteMany({ chatId: chatId.toString() });
    
    // Reset thông tin nhóm
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({ chatId: chatId.toString() });
    } else {
      group.totalVND = 0;
      group.totalUSDT = 0;
      group.totalDepositUSDT = 0;
      group.totalDepositVND = 0;
      group.totalWithdrawUSDT = 0;
      group.totalWithdrawVND = 0;
      group.usdtPaid = 0;
      group.remainingUSDT = 0;
      group.rate = 0;
      group.exchangeRate = 0;
      group.withdrawRate = null;
      group.withdrawExchangeRate = null;
      group.lastClearDate = new Date();
    }
    
    await group.save();
    
    // Lưu transaction mới về lệnh delete
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'delete',
      message: '/delete',
      senderName: msg.from.first_name,
      timestamp: new Date()
    });
    
    await transaction.save();
    
    bot.sendMessage(chatId, "Dữ liệu đã được xóa.");
    
  } catch (error) {
    console.error('Error in handleDeleteCommand:', error);
    bot.sendMessage(msg.chat.id, "处理删除命令时出错。请稍后再试。");
  }
};

/**
 * Hàm lấy lịch sử giao dịch deposit
 */
const getDepositHistory = async (chatId) => {
  try {
    // Tìm nhóm và lấy ngày clear cuối cùng
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) return { entries: [] };
    
    const lastClearDate = group.lastClearDate;
    
    // Lấy tất cả giao dịch deposit và withdraw sau lần clear cuối
    const transactions = await Transaction.find({
      chatId: chatId.toString(),
      type: { $in: ['deposit', 'withdraw'] },
      timestamp: { $gt: lastClearDate },
      skipped: { $ne: true } // Không lấy các giao dịch đã bị skip
    }).sort({ timestamp: 1 }); // Sắp xếp theo thời gian tăng dần (ID sẽ tăng dần, cũ đến mới)
    
    if (transactions.length === 0) return { entries: [] };
    
    // Format lại các chi tiết với messageId và senderName
    // Gán ID theo thứ tự giao dịch
    const entries = transactions.map((t, index) => {
      return {
        id: index + 1, // ID theo thứ tự trong mảng
        details: t.details,
        messageId: t.messageId || null,
        chatLink: t.messageId ? `https://t.me/c/${chatId.toString().replace('-100', '')}/${t.messageId}` : null,
        timestamp: t.timestamp,
        senderName: t.senderName || ''
      };
    });
    
    // Chỉ lấy 6 giao dịch gần đây nhất nếu có quá nhiều giao dịch
    return { entries: entries.slice(-5), totalCount: entries.length };
  } catch (error) {
    console.error('Error in getDepositHistory:', error);
    return { entries: [], totalCount: 0 };
  }
};

/**
 * Hàm lấy lịch sử giao dịch thanh toán
 */
const getPaymentHistory = async (chatId) => {
  try {
    // Tìm nhóm và lấy ngày clear cuối cùng
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) return { entries: [] };
    
    const lastClearDate = group.lastClearDate;
    
    // Lấy tất cả giao dịch payment sau lần clear cuối
    const transactions = await Transaction.find({
      chatId: chatId.toString(),
      type: 'payment',
      timestamp: { $gt: lastClearDate },
      skipped: { $ne: true } // Không lấy các giao dịch đã bị skip
    }).sort({ timestamp: 1 }); // Sắp xếp theo thời gian tăng dần (ID sẽ tăng dần, cũ đến mới)
    
    if (transactions.length === 0) return { entries: [] };
    
    // Format lại các chi tiết với messageId và senderName
    // Gán ID theo thứ tự giao dịch
    const entries = transactions.map((t, index) => {
      return {
        id: index + 1, // ID theo thứ tự trong mảng
        details: t.details,
        messageId: t.messageId || null,
        chatLink: t.messageId ? `https://t.me/c/${chatId.toString().replace('-100', '')}/${t.messageId}` : null,
        timestamp: t.timestamp,
        senderName: t.senderName || ''
      };
    });
    
    // Chỉ lấy 3 giao dịch gần đây nhất nếu có quá nhiều giao dịch
    return { entries: entries.slice(-3), totalCount: entries.length };
  } catch (error) {
    console.error('Error in getPaymentHistory:', error);
    return { entries: [], totalCount: 0 };
  }
};

/**
 * Hàm lấy thông tin các thẻ
 */
const getCardSummary = async (chatId) => {
  try {
    // Lấy tất cả thẻ của nhóm không bị ẩn
    const cards = await Card.find({
      chatId: chatId.toString(),
      hidden: false
    });
    
    if (cards.length === 0) return [];
    
    // Lấy thông tin group
    const group = await Group.findOne({ chatId: chatId.toString() });
    const showRemaining = (group && group.rate === 0 && group.exchangeRate === 1);
    
    // Format thông tin từng thẻ
    const summary = cards.map(card => {
      let cardInfo = `${card.cardCode}=${formatSmart(card.total)}`;
      
      // Thêm thông tin limit nếu có
      if (card.limit > 0) {
        const remaining = card.limit - card.total;
        cardInfo += `|剩余额度:${formatSmart(remaining)}`;
      }
      
      // Thêm thông tin thanh toán còn lại nếu rate=0 và exchange rate=1
      if (showRemaining) {
        const remainingPayment = card.total - card.paid;
        cardInfo += `|剩余余额:${formatSmart(remainingPayment)}`;
      }
      
      return cardInfo;
    });
    
    return summary;
  } catch (error) {
    console.error('Error in getCardSummary:', error);
    return [];
  }
};

module.exports = {
  handleClearCommand,
  handleRateCommand,
  handleExchangeRateCommand,
  handleDualRateCommand,
  handleWithdrawRateCommand,
  handleDeleteCommand,
  getDepositHistory,
  getPaymentHistory,
  getCardSummary
}; 