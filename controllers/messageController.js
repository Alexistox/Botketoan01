const axios = require('axios');
const { extractBankInfoFromImage } = require('../utils/openai');
const { getDownloadLink, logMessage } = require('../utils/telegramUtils');
const { 
  formatSmart, 
  formatRateValue, 
  isMathExpression, 
  isSingleNumber, 
  isTrc20Address,
  formatTelegramMessage
} = require('../utils/formatter');

const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const User = require('../models/User');
const Config = require('../models/Config');
const MessageLog = require('../models/MessageLog');

// Hàm xử lý tin nhắn chính
const handleMessage = async (bot, msg, cache) => {
  try {
    // Log message to database
    await logMessage(msg, process.env.TELEGRAM_BOT_TOKEN, MessageLog);
    
    // Log tin nhắn vào console để debug
    console.log('Received message:', JSON.stringify(msg, null, 2));
    
    // Lấy thông tin cơ bản từ tin nhắn
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'unknown';
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const timestamp = new Date();
    const messageText = msg.text || '';
    
    // Xử lý thành viên mới tham gia nhóm
    if (msg.new_chat_members) {
      const newMembers = msg.new_chat_members;
      for (const member of newMembers) {
        await sendWelcomeMessage(bot, chatId, member);
      }
      return;
    }
    
    // Xử lý các lệnh liên quan đến ảnh
    if (msg.photo) {
      if (msg.caption && msg.caption.startsWith('/c')) {
        await handleImageBankInfo(bot, msg);
        return;
      }
    }
    
    // Xử lý khi người dùng reply một tin nhắn có ảnh
    if (msg.reply_to_message && msg.reply_to_message.photo && msg.text && msg.text.startsWith('/c')) {
      await handleReplyImageBankInfo(bot, msg);
      return;
    }
    
    // Nếu không có văn bản, không xử lý
    if (!msg.text) {
      return;
    }
    
    // Kiểm tra và đăng ký người dùng mới
    await checkAndRegisterUser(userId, username, firstName, lastName);
    
    // Xử lý các lệnh tiếng Trung
    if (messageText === '上课') {
      await handleClearCommand(bot, chatId, userId, firstName);
      return;
    }
    
    if (messageText === '结束') {
      await handleReportCommand(bot, chatId, firstName);
      return;
    }
    
    if (messageText.startsWith('设置费率')) {
      await handleRateCommand(bot, msg);
      return;
    }
    
    if (messageText.startsWith('设置汇率')) {
      await handleExchangeRateCommand(bot, msg);
      return;
    }
    
    if (messageText.startsWith('下发')) {
      await handlePercentCommand(bot, msg);
      return;
    }
    
    // Giữ lại kiểm tra owner cho các lệnh quản trị
    if (messageText.startsWith('加操作人')) {
      if (await isUserOwner(userId)) {
        await handleAddOperatorCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
      }
      return;
    }
    
    if (messageText.startsWith('移除操作人')) {
      if (await isUserOwner(userId)) {
        await handleRemoveOperatorCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
      }
      return;
    }
    
    // Xử lý các lệnh bắt đầu bằng "/"
    if (messageText.startsWith('/')) {
      if (messageText === '/start') {
        bot.sendMessage(chatId, "欢迎使用交易管理机器人！");
        return;
      }
      
      if (messageText === '/off') {
        bot.sendMessage(chatId, "感谢大家的辛勤付出，祝大家发财！ 💰💸🍀");
        return;
      }
      
      if (messageText.startsWith('/m ')) {
        await handleCurrencyUnitCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/t ')) {
        await handleCalculateUsdtCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/v ')) {
        await handleCalculateVndCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/d ')) {
        await handleDualRateCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/x ')) {
        await handleHideCardCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/sx ')) {
        await handleShowCardCommand(bot, msg);
        return;
      }
      
      if (messageText === '/hiddenCards') {
        await handleListHiddenCardsCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/delete')) {
        await handleDeleteCommand(bot, msg);
        return;
      }
      
      // Giữ lại kiểm tra owner cho lệnh thiết lập địa chỉ USDT
      if (messageText.startsWith('/usdt ')) {
        if (await isUserOwner(userId)) {
          await handleSetUsdtAddressCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
        }
        return;
      }
      
      if (messageText === '/u') {
        await handleGetUsdtAddressCommand(bot, msg);
        return;
      }
      
      if (messageText === '/users') {
        await handleListUsersCommand(bot, msg);
        return;
      }
      
      if (messageText === '/report') {
        await handleReportCommand(bot, chatId, firstName);
        return;
      }
      
      // Giữ lại kiểm tra owner cho lệnh setowner
      if (messageText.startsWith('/setowner')) {
        if (await isUserOwner(userId)) {
          await handleSetOwnerCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
        }
        return;
      }
      
      // Giữ lại kiểm tra owner cho lệnh remove
      if (messageText.startsWith('/remove ')) {
        if (await isUserOwner(userId)) {
          await handleRemoveCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
        }
        return;
      }
      
      // Giữ lại kiểm tra owner cho lệnh migrate
      if (messageText === '/migrate') {
        if (await isUserOwner(userId)) {
          await handleMigrateDataCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
        }
        return;
      }
    }
    
    // Xử lý tin nhắn + và -
    if (messageText.startsWith('+')) {
      await handlePlusCommand(bot, msg);
      return;
    }
    
    if (messageText.startsWith('-')) {
      await handleMinusCommand(bot, msg);
      return;
    }
    
    // Xử lý biểu thức toán học
    if (isMathExpression(messageText)) {
      if (!isSingleNumber(messageText)) {
        await handleMathExpression(bot, chatId, messageText, firstName);
        return;
      }
    }
    
    // Xử lý địa chỉ TRC20
    if (isTrc20Address(messageText.trim())) {
      await handleTrc20Address(bot, chatId, messageText.trim(), firstName);
      return;
    }
    
  } catch (error) {
    console.error('Error in handleMessage:', error);
  }
};

// Hàm kiểm tra và đăng ký người dùng mới
const checkAndRegisterUser = async (userId, username, firstName, lastName) => {
  try {
    let user = await User.findOne({ userId: userId.toString() });
    
    if (!user) {
      // Kiểm tra xem đã có owner chưa
      const ownerExists = await User.findOne({ isOwner: true });
      
      // Nếu chưa có owner, user đầu tiên sẽ là owner
      const isFirstUser = !ownerExists;
      
      user = new User({
        userId: userId.toString(),
        username,
        firstName,
        lastName,
        isOwner: isFirstUser
      });
      
      await user.save();
      
      if (isFirstUser) {
        console.log(`User ${username} (ID: ${userId}) is now the bot owner`);
      }
    }
    
    return user;
  } catch (error) {
    console.error('Error in checkAndRegisterUser:', error);
    return null;
  }
};

// Hàm kiểm tra quyền hạn owner - chỉ giữ lại owner cho bảo trì hệ thống
const isUserOwner = async (userId) => {
  try {
    const user = await User.findOne({ userId: userId.toString() });
    return user && user.isOwner;
  } catch (error) {
    console.error('Error in isUserOwner:', error);
    return false;
  }
};

// Hàm kiểm tra quyền hạn sử dụng - luôn trả về true để cho phép tất cả người dùng
const isUserAuthorized = async (userId, username, chatId) => {
  return true; // Cho phép tất cả người dùng sử dụng bot
};

// Hàm gửi tin nhắn chào mừng
const sendWelcomeMessage = async (bot, chatId, member) => {
  const welcomeName = member.first_name;
  const welcomeMessage = `欢迎 ${welcomeName} 加入群组！! 🎉`;
  bot.sendMessage(chatId, welcomeMessage);
};

// Phần còn lại của file sẽ import các controller khác
const { 
  handleClearCommand,
  handleRateCommand,
  handleExchangeRateCommand,
  handleDualRateCommand,
  handleDeleteCommand
} = require('./groupCommands');

const {
  handlePlusCommand,
  handleMinusCommand,
  handlePercentCommand
} = require('./transactionCommands');

const {
  handleHideCardCommand,
  handleShowCardCommand,
  handleListHiddenCardsCommand
} = require('./cardCommands');

const {
  handleAddOperatorCommand,
  handleRemoveOperatorCommand,
  handleListUsersCommand,
  handleCurrencyUnitCommand,
  handleSetUsdtAddressCommand,
  handleGetUsdtAddressCommand,
  handleSetOwnerCommand,
  handleRemoveCommand,
  handleMigrateDataCommand
} = require('./userCommands');

const {
  handleCalculateUsdtCommand,
  handleCalculateVndCommand,
  handleMathExpression,
  handleTrc20Address,
  handleReportCommand
} = require('./utilCommands');

const {
  handleImageBankInfo,
  handleReplyImageBankInfo
} = require('./imageCommands');

module.exports = {
  handleMessage
}; 