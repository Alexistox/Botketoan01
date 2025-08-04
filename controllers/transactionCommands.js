const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const Config = require('../models/Config');
const { formatSmart, formatRateValue, formatTelegramMessage, formatWithdrawRateMessage, isSingleNumber, isValidNumber, parseSpecialNumber, evaluateSpecialExpression, formatDateUS, formatTimeString, getUserNumberFormat, getGroupNumberFormat } = require('../utils/formatter');
const { getDepositHistory, getPaymentHistory, getCardSummary } = require('./groupCommands');
const { getButtonsStatus, getInlineKeyboard } = require('./userCommands');

/**
 * Xử lý lệnh thêm tiền (+)
 */
const handlePlusCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    const messageId = msg.message_id.toString();
    
    // Phân tích tin nhắn
    const parts = messageText.split('+');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：+数字 或 +数字 [卡号] [额度]");
      return;
    }
    
    // Xử lý các tham số
    const inputParts = parts[1].trim().split(' ');
    const expr = inputParts[0];
    const cardCode = inputParts.length > 1 ? inputParts[1].toUpperCase() : '';
    const cardLimit = inputParts.length > 2 ? parseSpecialNumber(inputParts[2]) : 0;
    
    // Tính toán số tiền
    let amountVND;
    if (isValidNumber(expr)) {
      amountVND = parseSpecialNumber(expr);
    } else {
      try {
        amountVND = evaluateSpecialExpression(expr);
        if (isNaN(amountVND)) {
          amountVND = eval(expr); // fallback cho biểu thức không có số đặc biệt
        }
      } catch(err) {
        bot.sendMessage(chatId, "");
        return;
      }
    }
    
    if (isNaN(amountVND)) {
      bot.sendMessage(chatId, "");
      return;
    }

    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }
    // Kiểm tra tỷ giá
    if (!group.exchangeRate) {
      bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';

    // Bỏ qua giao dịch +0
    if (amountVND === 0) {
      // Chỉ hiển thị thông tin hiện tại mà không ghi nhận giao dịch
      const todayDate = new Date();
      const depositData = await getDepositHistory(chatId);
      const paymentData = await getPaymentHistory(chatId);
      const cardSummary = await getCardSummary(chatId);
      
      // Lấy format của người dùng trong nhóm này
      const userFormat = await getGroupNumberFormat(chatId);
      
      // Tạo response JSON
      const responseData = {
        date: formatDateUS(todayDate),
        depositData,
        paymentData,
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
      return;
    }
   
    
    // Tính toán giá trị USDT
    const xValue = group.rate;
    const yValue = group.exchangeRate;
    const newUSDT = (amountVND / yValue) * (1 - xValue / 100);
    
    // Tính toán phần (1-(费率/100))
    const rateFactor = (1 - xValue / 100).toFixed(2);
    
    // Cập nhật group
    group.totalVND += amountVND;
    group.totalUSDT += newUSDT;
    group.totalDepositUSDT += newUSDT; // Tracking riêng cho deposit USDT
    group.totalDepositVND += amountVND; // Tracking riêng cho deposit VND
    
    // Tính lại remainingUSDT dựa trên logic mới
    if (group.totalDepositUSDT !== undefined && group.totalWithdrawUSDT !== undefined) {
      group.remainingUSDT = group.totalDepositUSDT - group.totalWithdrawUSDT - group.usdtPaid;
    } else {
      group.remainingUSDT = group.totalUSDT - group.usdtPaid;
    }
    
    await group.save();
    
    // Lấy format của người dùng cho hiển thị details
    const userFormat = await getGroupNumberFormat(chatId);
    
    // Tạo chi tiết giao dịch
    let details;
    if (cardCode) {
      details = `\`${formatTimeString(new Date())}\` *${formatSmart(amountVND, userFormat)}*\\*${rateFactor}/${yValue} = ${formatSmart(newUSDT, userFormat)} (${cardCode}) \`${senderName}\``;
    } else {
      details = `\`${formatTimeString(new Date())}\` *${formatSmart(amountVND, userFormat)}*\\*${rateFactor}/${yValue} = ${formatSmart(newUSDT, userFormat)} \`${senderName}\``;
    }
    
    // Lưu giao dịch mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'deposit',
      amount: amountVND,
      usdtAmount: newUSDT,
      message: messageText,
      details,
      senderName,
      cardCode,
      limit: cardLimit,
      rate: xValue,
      exchangeRate: yValue,
      timestamp: new Date(),
      messageId
    });
    
    await transaction.save();
    
    // Nếu có mã thẻ, cập nhật hoặc tạo thẻ mới
    if (cardCode) {
      let card = await Card.findOne({ chatId: chatId.toString(), cardCode });
      if (!card) {
        card = new Card({
          chatId: chatId.toString(),
          cardCode,
          total: amountVND,
          paid: 0,
          limit: cardLimit > 0 ? cardLimit : 0,
          hidden: false,
          lastUpdated: new Date()
        });
      } else {
        card.total += amountVND;
        if (cardLimit > 0) {
          card.limit = cardLimit;
        }
        card.lastUpdated = new Date();
      }
      await card.save();
    }
    
    // Tính toán giá trị ví dụ
    let exampleValue = null;
    if (Math.abs(amountVND) < 1) {
      exampleValue = (100000 / yValue) * (1 - xValue / 100);
    }
    
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
      exchangeRate: formatRateValue(yValue),
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
    
    // Thêm ví dụ nếu cần
    if (exampleValue !== null) {
      responseData.example = formatSmart(exampleValue);
    }
    
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
    console.error('Error in handlePlusCommand:', error);
    bot.sendMessage(msg.chat.id, "处理入款命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh rút tiền (-)
 */
const handleMinusCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    const messageId = msg.message_id.toString();
    
    // Phân tích tin nhắn
    const parts = messageText.split('-');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：-数字 或 -数字 [卡号]");
      return;
    }
    
    // Xử lý các tham số
    const inputParts = parts[1].trim().split(' ');
    const expr = inputParts[0];
    const cardCode = inputParts.length > 1 ? inputParts[1].toUpperCase() : '';
    
    // Tính toán số tiền
    let amountVND;
    if (isValidNumber(expr)) {
      amountVND = parseSpecialNumber(expr);
    } else {
      try {
        amountVND = evaluateSpecialExpression(expr);
        if (isNaN(amountVND)) {
          amountVND = eval(expr); // fallback cho biểu thức không có số đặc biệt
        }
      } catch(err) {
        bot.sendMessage(chatId, "");
        return;
      }
    }
    
    if (isNaN(amountVND)) {
      bot.sendMessage(chatId, "");
      return;
    }
   
    
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }
    
    // Kiểm tra tỷ giá
    if (!group.exchangeRate) {
      bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }
    
    // Tính toán giá trị USDT - sử dụng 出款费率 và 出款汇率 nếu có
    let xValue, yValue, minusUSDT, rateFactor;
    let useWithdrawRate = false;
    
    if (group.withdrawRate !== null && group.withdrawExchangeRate !== null) {
      // Sử dụng 出款费率 và 出款汇率
      xValue = group.withdrawRate;
      yValue = group.withdrawExchangeRate;
      minusUSDT = (amountVND / yValue) * (1 + xValue / 100);
      rateFactor = (1 + xValue / 100).toFixed(2);
      useWithdrawRate = true;
    } else {
      // Sử dụng 费率 và 汇率 cũ
      xValue = group.rate;
      yValue = group.exchangeRate;
      minusUSDT = (amountVND / yValue) * (1 - xValue / 100);
      rateFactor = (1 - xValue / 100).toFixed(2);
    }
    
    // Cập nhật group
    group.totalVND -= amountVND;
    group.totalUSDT -= minusUSDT;
    
    // Cập nhật totalWithdrawUSDT và totalWithdrawVND
    if (useWithdrawRate) {
      group.totalWithdrawUSDT += minusUSDT;
    }
    group.totalWithdrawVND += amountVND; // Tracking VND của lệnh trừ
    
    // Tính lại remainingUSDT dựa trên logic mới
    if (group.totalDepositUSDT !== undefined && group.totalWithdrawUSDT !== undefined) {
      group.remainingUSDT = group.totalDepositUSDT - group.totalWithdrawUSDT - group.usdtPaid;
    } else {
      group.remainingUSDT = group.totalUSDT - group.usdtPaid;
    }
    
    await group.save();
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Lấy format của người dùng cho hiển thị details
    const userFormat = await getGroupNumberFormat(chatId);
    
    // Tạo chi tiết giao dịch
    let details;
    const operator = useWithdrawRate ? '+' : '-';
    if (cardCode) {
      details = `\`${formatTimeString(new Date())}\` -*${formatSmart(amountVND, userFormat)}*\\*${rateFactor}/${yValue} = ${formatSmart(minusUSDT, userFormat)} (${cardCode}) \`${senderName}\``;
    } else {
      details = `\`${formatTimeString(new Date())}\` -*${formatSmart(amountVND, userFormat)}*\\*${rateFactor}/${yValue} = ${formatSmart(minusUSDT, userFormat)} \`${senderName}\``;
    }
    // Lưu giao dịch mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'withdraw',
      amount: -amountVND,
      usdtAmount: -minusUSDT,
      message: messageText,
      details,
      senderName,
      cardCode,
      rate: xValue,
      exchangeRate: yValue,
      timestamp: new Date(),
      messageId
    });
    
    await transaction.save();
    
    // Nếu có mã thẻ, cập nhật thẻ
    if (cardCode) {
      let card = await Card.findOne({ chatId: chatId.toString(), cardCode });
      if (card) {
        card.total -= amountVND;
        card.lastUpdated = new Date();
        await card.save();
      } else {
        // Tạo thẻ mới với số tiền âm
        card = new Card({
          chatId: chatId.toString(),
          cardCode,
          total: -amountVND,
          paid: 0,
          hidden: false,
          lastUpdated: new Date()
        });
        await card.save();
      }
    }
    
    // Tính toán giá trị ví dụ
    let exampleValue = null;
    if (Math.abs(amountVND) < 1) {
      if (useWithdrawRate) {
        exampleValue = (100000 / yValue) * (1 + xValue / 100);
      } else {
        exampleValue = (100000 / yValue) * (1 - xValue / 100);
      }
    }
    
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
    
    // Thêm thông tin rate phù hợp
    if (useWithdrawRate) {
      responseData.rate = (group.rate !== null && group.rate !== undefined) ? formatRateValue(group.rate) + "%" : "未设置";
      responseData.exchangeRate = (group.exchangeRate !== null && group.exchangeRate !== undefined) ? formatRateValue(group.exchangeRate) : "未设置";
      responseData.withdrawRate = formatRateValue(xValue) + "%";
      responseData.withdrawExchangeRate = formatRateValue(yValue);
    } else {
      responseData.rate = formatRateValue(xValue) + "%";
      responseData.exchangeRate = formatRateValue(yValue);
    }
    
    // Thêm ví dụ nếu cần
    if (exampleValue !== null) {
      if (useWithdrawRate) {
        responseData.withdrawExample = formatSmart(exampleValue);
      } else {
        responseData.example = formatSmart(exampleValue);
      }
    }
    
    // Format và gửi tin nhắn - sử dụng formatter phù hợp
    const response = useWithdrawRate ? 
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
    console.error('Error in handleMinusCommand:', error);
    bot.sendMessage(msg.chat.id, "处理出款命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thanh toán (下发 hoặc %)
 */
const handlePercentCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    const messageId = msg.message_id.toString();
    
    // Phân tích tin nhắn - hỗ trợ cả 下发 và % prefix
    let parts;
    if (messageText.startsWith('下发')) {
      parts = messageText.split('下发');
    } else if (messageText.startsWith('%')) {
      parts = messageText.split('%');
    } else {
      bot.sendMessage(chatId, "指令无效。格式为：下发数字 (USDT) 或 %数字 (USDT) 或 下发数字 [卡号] 或 %数字 [卡号]");
      return;
    }
    
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：下发数字 (USDT) 或 %数字 (USDT) 或 下发数字 [卡号] 或 %数字 [卡号]");
      return;
    }
    
    // Xử lý các tham số
    const inputParts = parts[1].trim().split(' ');
    const expr = inputParts[0];
    const cardCode = inputParts.length > 1 ? inputParts[1].toUpperCase() : '';
    
    // Tính toán số tiền USDT
    let payUSDT;
    if (isValidNumber(expr)) {
      payUSDT = parseSpecialNumber(expr);
    } else {
      try {
        payUSDT = evaluateSpecialExpression(expr);
        if (isNaN(payUSDT)) {
          payUSDT = eval(expr); // fallback cho biểu thức không có số đặc biệt
        }
      } catch(err) {
        bot.sendMessage(chatId, "");
        return;
      }
    }
    
    if (isNaN(payUSDT)) {
      bot.sendMessage(chatId, "USDT金额无效。");
      return;
    }
    
    // Ignore zero-value transactions
    if (payUSDT === 0) {
      bot.sendMessage(chatId, "金额为零，不处理。");
      return;
    }
    
    // Tìm hoặc tạo group
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }
    
    // Kiểm tra tỷ giá
    if (!group.exchangeRate) {
      bot.sendMessage(chatId, "请设置汇率，费率");
      return;
    }
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Cập nhật group
    group.usdtPaid += payUSDT;
    
    // Tính lại remainingUSDT dựa trên logic mới
    if (group.totalDepositUSDT !== undefined && group.totalWithdrawUSDT !== undefined) {
      group.remainingUSDT = group.totalDepositUSDT - group.totalWithdrawUSDT - group.usdtPaid;
    } else {
      group.remainingUSDT = group.totalUSDT - group.usdtPaid;
    }
    
    await group.save();
    
    // Lấy format của người dùng cho hiển thị details  
    const userFormat = await getGroupNumberFormat(chatId);
    
    // Tạo chi tiết giao dịch
    let details;
    if (cardCode) {
      details = `\`${formatTimeString(new Date())}\`    *${formatSmart(payUSDT, userFormat)}*  ${currencyUnit} (${cardCode})`;
    } else {
      details = `\`${formatTimeString(new Date())}\`    *${formatSmart(payUSDT, userFormat)}*  ${currencyUnit}`;
    }
    
    // Lưu giao dịch mới
    const transaction = new Transaction({
      chatId: chatId.toString(),
      type: 'payment',
      usdtAmount: payUSDT,
      message: messageText,
      details,
      senderName,
      cardCode,
      rate: group.rate,
      exchangeRate: group.exchangeRate,
      timestamp: new Date(),
      messageId
    });
    
    await transaction.save();
    
    // Nếu có mã thẻ, cập nhật thẻ
    if (cardCode) {
      let card = await Card.findOne({ chatId: chatId.toString(), cardCode });
      if (card) {
        card.paid += payUSDT;
        card.lastUpdated = new Date();
        await card.save();
      } else {
        // Không tạo thẻ mới khi chỉ thanh toán mà không có tiền gửi
        bot.sendMessage(chatId, `卡号 ${cardCode} 不存在。`);
        return;
      }
    }
    
    // Tính toán giá trị ví dụ
    let exampleValue = null;
    if (Math.abs(payUSDT) < 0.1) {
      exampleValue = (100000 / group.exchangeRate) * (1 - group.rate / 100);
    }
    
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
    
    // Thêm ví dụ nếu cần
    if (exampleValue !== null) {
      responseData.example = formatSmart(exampleValue);
    }
    
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
    console.error('Error in handlePercentCommand:', error);
    bot.sendMessage(msg.chat.id, "处理下发命令时出错。请稍后再试。");
  }
};

/**
 * Tính toán lại tất cả giá trị group từ các transactions chưa bị skip
 */
const recalculateGroupTotals = async (group) => {
  try {
    const chatId = group.chatId;
    const lastClearDate = group.lastClearDate;
    
    // Lấy tất cả transactions chưa bị skip từ lần clear cuối
    const activeTransactions = await Transaction.find({
      chatId: chatId,
      timestamp: { $gt: lastClearDate },
      skipped: { $ne: true },
      type: { $in: ['deposit', 'withdraw', 'payment'] }
    }).sort({ timestamp: 1 });
    
    // Reset all totals
    group.totalVND = 0;
    group.totalUSDT = 0;
    group.totalDepositUSDT = 0;
    group.totalDepositVND = 0;
    group.totalWithdrawUSDT = 0;
    group.totalWithdrawVND = 0;
    group.usdtPaid = 0;
    group.remainingUSDT = 0;
    
    // Recalculate from all active transactions
    for (const transaction of activeTransactions) {
      if (transaction.type === 'deposit') {
        group.totalVND += transaction.amount;
        group.totalUSDT += transaction.usdtAmount;
        group.totalDepositUSDT += transaction.usdtAmount;
        group.totalDepositVND += transaction.amount;
      } else if (transaction.type === 'withdraw') {
        group.totalVND += transaction.amount; // amount is already negative
        group.totalUSDT += transaction.usdtAmount; // usdtAmount is already negative
        group.totalWithdrawUSDT += Math.abs(transaction.usdtAmount);
        group.totalWithdrawVND += Math.abs(transaction.amount);
      } else if (transaction.type === 'payment') {
        group.usdtPaid += transaction.usdtAmount;
      }
    }
    
    // Calculate remaining USDT
    if (group.totalDepositUSDT !== undefined && group.totalWithdrawUSDT !== undefined) {
      group.remainingUSDT = group.totalDepositUSDT - group.totalWithdrawUSDT - group.usdtPaid;
    } else {
      group.remainingUSDT = group.totalUSDT - group.usdtPaid;
    }
    
    return group;
  } catch (error) {
    console.error('Error in recalculateGroupTotals:', error);
    return group;
  }
};

/**
 * Tính toán lại tất cả card totals và paid từ transactions chưa bị skip
 */
const recalculateCardTotals = async (chatId) => {
  try {
    const lastClearDate = await Group.findOne({ chatId })?.lastClearDate || new Date(0);
    
    // Lấy tất cả transactions chưa bị skip từ lần clear cuối
    const activeTransactions = await Transaction.find({
      chatId: chatId,
      timestamp: { $gt: lastClearDate },
      skipped: { $ne: true },
      type: { $in: ['deposit', 'withdraw', 'payment'] },
      cardCode: { $ne: '' }
    }).sort({ timestamp: 1 });
    
    // Get all cards for this chat
    const cards = await Card.find({ chatId });
    
    // Reset all card totals and paid amounts
    for (const card of cards) {
      card.total = 0;
      card.paid = 0;
    }
    
    // Recalculate from active transactions
    for (const transaction of activeTransactions) {
      if (transaction.cardCode) {
        let card = cards.find(c => c.cardCode === transaction.cardCode);
        
        if (!card) {
          // Create new card if it doesn't exist
          card = new Card({
            chatId: chatId,
            cardCode: transaction.cardCode,
            total: 0,
            paid: 0,
            limit: transaction.limit || 0,
            hidden: false,
            lastUpdated: new Date()
          });
          cards.push(card);
        }
        
        if (transaction.type === 'deposit') {
          card.total += transaction.amount;
        } else if (transaction.type === 'withdraw') {
          card.total += transaction.amount; // amount is already negative
        } else if (transaction.type === 'payment') {
          card.paid += transaction.usdtAmount;
        }
        
        card.lastUpdated = new Date();
      }
    }
    
    // Save all cards
    for (const card of cards) {
      await card.save();
    }
  } catch (error) {
    console.error('Error in recalculateCardTotals:', error);
  }
};

/**
 * Xử lý lệnh skip (/skip) - Xóa một giao dịch theo ID
 */
const handleSkipCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const senderName = msg.from.first_name;
    const messageText = msg.text;
    
    // Phân tích tin nhắn để lấy ID
    const parts = messageText.split('/skip');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：/skip [ID] 例如: /skip 3 或 /skip !2");
      return;
    }
    
    // Xử lý ID, loại bỏ khoảng trắng và ký tự !
    let idStr = parts[1].trim();
    let isPaymentId = false;
    
    if (idStr.startsWith('!')) {
      isPaymentId = true;
      idStr = idStr.substring(1);
    }
    
    // Chuyển đổi ID thành số
    const id = parseInt(idStr);
    if (isNaN(id) || id <= 0) {
      bot.sendMessage(chatId, "ID无效。应为正整数。");
      return;
    }
    
    // Tìm nhóm
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      bot.sendMessage(chatId, "没有找到群组信息。");
      return;
    }
    
    // Lấy tất cả giao dịch trong nhóm sau lần clear cuối
    const lastClearDate = group.lastClearDate;
    
    let transactions;
    if (isPaymentId) {
      // Lấy các giao dịch payment
      transactions = await Transaction.find({
        chatId: chatId.toString(),
        type: 'payment',
        timestamp: { $gt: lastClearDate },
        skipped: { $ne: true }
      }).sort({ timestamp: 1 });
    } else {
      // Lấy các giao dịch deposit và withdraw
      transactions = await Transaction.find({
        chatId: chatId.toString(),
        type: { $in: ['deposit', 'withdraw'] },
        timestamp: { $gt: lastClearDate },
        skipped: { $ne: true }
      }).sort({ timestamp: 1 });
    }
    
    // Kiểm tra xem ID có hợp lệ không
    if (id > transactions.length) {
      bot.sendMessage(chatId, `ID无效。${isPaymentId ? '下发' : '入款'}记录中只有 ${transactions.length} 个条目。`);
      return;
    }
    
    // Lấy giao dịch cần skip - vì ID là số thứ tự trong mảng (bắt đầu từ 1), nên cần trừ 1
    const transaction = transactions[id - 1];
    
    // Đánh dấu giao dịch là đã skip
    transaction.skipped = true;
    transaction.skipReason = `Skipped by ${senderName} at ${new Date().toLocaleString()}`;
    await transaction.save();
    
    // Tính toán lại toàn bộ giá trị group từ các transactions chưa bị skip
    group = await recalculateGroupTotals(group);
    await group.save();
    
    // Tính toán lại toàn bộ card totals từ các transactions chưa bị skip
    await recalculateCardTotals(chatId.toString());
    
    // Lưu transaction mới về lệnh skip
    const skipTransaction = new Transaction({
      chatId: chatId.toString(),
      type: 'skip',
      message: messageText,
      details: `Skip transaction ID: ${id}${isPaymentId ? '!' : ''} - ${transaction.details}`,
      senderName,
      timestamp: new Date()
    });
    
    await skipTransaction.save();
    
    // Lấy thông tin giao dịch gần đây sau khi skip
    const todayDate = new Date();
    const depositData = await getDepositHistory(chatId);
    const paymentData = await getPaymentHistory(chatId);
    const cardSummary = await getCardSummary(chatId);
    
    // Tạo response JSON
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    const responseData = {
      date: formatDateUS(todayDate),
      depositData,
      paymentData,
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
    
    // Lấy format của người dùng
    const userFormat = await getGroupNumberFormat(chatId);
    
    // Format và gửi tin nhắn - sử dụng formatter phù hợp
    const response = hasWithdrawRate ? 
      formatWithdrawRateMessage(responseData, userFormat) : 
      formatTelegramMessage(responseData, userFormat);
    
    // Kiểm tra trạng thái hiển thị buttons
    const showButtons = await getButtonsStatus(chatId);
    const keyboard = showButtons ? await getInlineKeyboard(chatId) : null;
    
    bot.sendMessage(chatId, `✅ 成功删除ID为 ${id}${isPaymentId ? '!' : ''} 的交易记录，所有金额已重新计算。`, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    bot.sendMessage(chatId, response, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
  } catch (error) {
    console.error('Error in handleSkipCommand:', error);
    bot.sendMessage(msg.chat.id, "处理删除命令时出错。请稍后再试。");
  }
};

module.exports = {
  handlePlusCommand,
  handleMinusCommand,
  handlePercentCommand,
  handleSkipCommand,
  recalculateGroupTotals,
  recalculateCardTotals
}; 