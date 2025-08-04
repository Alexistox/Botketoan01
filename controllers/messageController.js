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
const { isUserOwner, isUserAdmin, isUserOperator } = require('../utils/permissions');

const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const User = require('../models/User');
const Config = require('../models/Config');
const MessageLog = require('../models/MessageLog');

const {
  handleCalculateUsdtCommand,
  handleCalculateVndCommand,
  handleMathExpression,
  handleReportCommand,
  handleHelpCommand,
  handleStartCommand,
  handleFormatCommand,
  handlePicCommand,
  isPicModeEnabled
} = require('./utilCommands');

const {
  handleImageBankInfo,
  handleReplyImageBankInfo,
  handleBankNotificationReply,
  handlePicModeReply
} = require('./imageCommands');

const {
  handleReport1Command
} = require('./reportCommands');

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
    
    // Nếu người dùng gửi '开始', chuyển thành '/st' để dùng chung logic
    if (messageText === '开始') {
      const modifiedMsg = { ...msg, text: '/st' };
      await handleStartCommand(bot, chatId);
      return;
    }
    
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
      if (msg.caption && msg.caption === ('/c')) {
        await handleImageBankInfo(bot, msg);
        return;
      }
    }
    
    // Xử lý khi người dùng reply một tin nhắn có ảnh
    if (msg.reply_to_message && msg.reply_to_message.photo && msg.text && msg.text === ('/c')) {
      await handleReplyImageBankInfo(bot, msg);
      return;
    }
    
    // Xử lý khi người dùng reply "1" vào tin nhắn thông báo ngân hàng
    if (msg.reply_to_message && msg.reply_to_message.text && msg.text && msg.text === '1') {
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        await handleBankNotificationReply(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
      return;
    }
    
    // Xử lý pic mode replies: 1, 2, 3
    if (msg.reply_to_message && (msg.reply_to_message.photo || msg.reply_to_message.text) && 
        msg.text && (msg.text === '1' || msg.text === '2' || msg.text === '3')) {
      // Kiểm tra xem pic mode có được bật không
      if (await isPicModeEnabled(chatId)) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handlePicModeReply(bot, msg, msg.text);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
    }
    
    // Nếu không có văn bản, không xử lý
    if (!msg.text) {
      return;
    }
    
    // Kiểm tra và đăng ký người dùng mới
    await checkAndRegisterUser(userId, username, firstName, lastName);
    
    // Xử lý các lệnh tiếng Trung
    if (messageText === '上课' || messageText === 'Start' || messageText === '开始新账单') {
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        await handleClearCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
      return;
    }
    
    if (messageText === '结束') {
      // Xử lý "结束" giống như "/report"
      await handleReportCommand(bot, chatId, firstName, userId);
      return;
    }
    
    if (messageText.startsWith('设置费率')) {
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        await handleRateCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
      return;
    }
    
    if (messageText.startsWith('设置汇率')) {
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        await handleExchangeRateCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
      return;
    }
    
    if (messageText.startsWith('下发') || messageText.startsWith('%')) {
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        await handlePercentCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
      return;
    }
    
    // Kiểm tra lệnh 价格 (chỉ khi nó là từ độc lập, không phải một phần của từ khác)
    if (messageText === '价格' || 
        messageText.startsWith('价格 ') || 
        messageText.startsWith('价格/') || 
        messageText.startsWith('价格:')) {
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        // Chuyển đổi tin nhắn để sử dụng lệnh /d
        const modifiedMsg = { ...msg };
        if (messageText === '价格') {
          modifiedMsg.text = '/d';
        } else {
          modifiedMsg.text = '/d' + messageText.substring(2);
        }
        await handleDualRateCommand(bot, modifiedMsg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
      return;
    }
    
    // Lệnh 撤销账单 (tương đương /skip)
    if (messageText.startsWith('撤回')) {
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        // Chuyển đổi tin nhắn để sử dụng lệnh /skip
        const modifiedMsg = { ...msg };
        if (messageText === '撤回') {
          bot.sendMessage(chatId, "指令无效。格式为：撤回 [ID] 例如: 撤回 3 或 撤回 !2");
          return;
        } else {
          modifiedMsg.text = '/skip' + messageText.substring(2);
        }
        await handleSkipCommand(bot, modifiedMsg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
      return;
    }
    
    // Lệnh quản lý operators
    if (messageText.startsWith('设置操作')) {
      // Kiểm tra quyền Admin
      if (await isUserAdmin(userId)) {
        // Chuyển đổi tin nhắn để sử dụng lệnh /op
        const modifiedMsg = { ...msg };
        const prefixLength = messageText.startsWith('设置操作') ? 4 : 5;
        // Đảm bảo luôn có một dấu cách sau /op
        modifiedMsg.text = '/op ' + messageText.substring(prefixLength).trim();
        await handleAddOperatorInGroupCommand(bot, modifiedMsg);
      } else {
        bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
      }
      return;
    }
    
    if (messageText.startsWith('删除操作')) {
      // Kiểm tra quyền Admin
      if (await isUserAdmin(userId)) {
        // Chuyển đổi tin nhắn để sử dụng lệnh /removeop
        const modifiedMsg = { ...msg };
        // Xác định độ dài prefix
        const prefixLength = messageText.startsWith('删除操作') ? 4 : 5;
        // Đảm bảo luôn có một dấu cách sau /removeop
        modifiedMsg.text = '/removeop ' + messageText.substring(prefixLength).trim();
        await handleRemoveOperatorInGroupCommand(bot, modifiedMsg);
      } else {
        bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
      }
      return;
    }
    
    // --- Xử lý alias tiếng Trung trước khi kiểm tra lệnh bắt đầu bằng "/" ---
    if (messageText === '操作人') {
      const modifiedMsg = { ...msg, text: '/ops' };
      await handleListOperatorsCommand(bot, modifiedMsg);
      return;
    }
    if (messageText.startsWith('添加管理员')) {
      const modifiedMsg = { ...msg };
      const prefixLength = messageText.startsWith('添加管理员') ? 5 : 6;
      modifiedMsg.text = '/ad ' + messageText.substring(prefixLength).trim();
      await handleAddAdminCommand(bot, modifiedMsg);
      return;
    }
    if (messageText.startsWith('删除管理员')) {
      const modifiedMsg = { ...msg };
      const prefixLength = messageText.startsWith('删除管理员') ? 5 : 6;
      modifiedMsg.text = '/removead ' + messageText.substring(prefixLength).trim();
      await handleRemoveAdminCommand(bot, modifiedMsg);
      return;
    }
    if (messageText.startsWith('设置地址')) {
      if (await isUserAdmin(userId)) {
        const modifiedMsg = { ...msg };
        const prefixLength = 4;
        modifiedMsg.text = '/usdt ' + messageText.substring(prefixLength).trim();
        await handleSetUsdtAddressCommand(bot, modifiedMsg);
      } else {
        bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
      }
      return;
    }
    if (messageText.startsWith('确认人')) {
      if (await isUserAdmin(userId)) {
        const modifiedMsg = { ...msg };
        const prefixLength = 3;
        modifiedMsg.text = '/usdtxn ' + messageText.substring(prefixLength).trim();
        await handleUsdtConfirmCommand(bot, modifiedMsg);
      } else {
        bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
      }
      return;
    }
    if (messageText.startsWith('删除确认人')) {
      if (await isUserAdmin(userId)) {
        const modifiedMsg = { ...msg };
        const prefixLength = 5;
        modifiedMsg.text = '/usdtxxn ' + messageText.substring(prefixLength).trim();
        await handleUsdtRemoveConfirmCommand(bot, modifiedMsg);
      } else {
        bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
      }
      return;
    }
    if (messageText.startsWith('移除确认人')) {
      if (await isUserAdmin(userId)) {
        const modifiedMsg = { ...msg };
        const prefixLength = 5;
        modifiedMsg.text = '/usdtxxn ' + messageText.substring(prefixLength).trim();
        await handleUsdtRemoveConfirmCommand(bot, modifiedMsg);
      } else {
        bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
      }
      return;
    }
    if (messageText === 'u来u来') {
      await handleGetUsdtAddressCommand(bot, msg);
      return;
    }
    if (messageText.startsWith('删除usdt')) {
      if (await isUserAdmin(userId)) {
        await handleRemoveUsdtCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
      }
      return;
    }
    // --- Kết thúc alias tiếng Trung ---
    
    // Xử lý các lệnh bắt đầu bằng "/"
    if (messageText.startsWith('/')) {
      if (messageText === '/start') {
        bot.sendMessage(chatId, "欢迎使用交易管理机器人！");
        return;
      }
      
      if (messageText === '/help') {
        await handleHelpCommand(bot, chatId);
        return;
      }
      
      if (messageText === '/off') {
        bot.sendMessage(chatId, "感谢大家的辛勤付出，祝大家发财！ 💰💸🍀");
        return;
      }
      
      // Các lệnh quản lý admin - chỉ owner
      if (messageText.startsWith('/ad ')) {
        await handleAddAdminCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/removead ')) {
        await handleRemoveAdminCommand(bot, msg);
        return;
      }
      
      if (messageText === '/admins') {
        await handleListAdminsCommand(bot, msg);
        return;
      }
      
      // Lệnh liệt kê danh sách nhóm
      if (messageText === '/listgroups') {
        await handleListGroupsCommand(bot, msg);
        return;
      }
      
      // Các lệnh quản lý operator - admin và owner
      if (messageText.startsWith('/op ')) {
        await handleAddOperatorInGroupCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/removeop ')) {
        await handleRemoveOperatorInGroupCommand(bot, msg);
        return;
      }
      
      if (messageText === '/ops') {
        await handleListOperatorsCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/m ')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleCurrencyUnitCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      // Lệnh chuyển đổi tiền tệ - tất cả user
      if (messageText.startsWith('/t ')) {
        await handleCalculateUsdtCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/v ')) {
        await handleCalculateVndCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/skip ')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleSkipCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      if (messageText.startsWith('/d ')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleDualRateCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      if (messageText.startsWith('/d2 ')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleWithdrawRateCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      if (messageText.startsWith('/x ')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleHideCardCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      if (messageText.startsWith('/sx ')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleShowCardCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      if (messageText === '/hiddenCards') {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleListHiddenCardsCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      if (messageText.startsWith('/delete')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleDeleteCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      // Lệnh quản lý inline buttons
      if (messageText.startsWith('/inline ')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleAddInlineCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      if (messageText.startsWith('/removeinline ')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleRemoveInlineCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      if (messageText === '/buttons') {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await displayInlineButtons(bot, chatId);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      // Lệnh thiết lập địa chỉ USDT - chỉ admin và owner
      if (messageText.startsWith('/usdt ')) {
        if (await isUserAdmin(userId)) {
          await handleSetUsdtAddressCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
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
        await handleReportCommand(bot, chatId, firstName, userId);
        return;
      }
      
      if (messageText === '/report1') {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleReport1Command(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      if (messageText.startsWith('/format')) {
        await handleFormatCommand(bot, msg);
        return;
      }
      
      if (messageText.startsWith('/pic ')) {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handlePicCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }
      
      // Lệnh thiết lập owner - chỉ owner
      if (messageText.startsWith('/setowner')) {
        if (await isUserOwner(userId)) {
          await handleSetOwnerCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
        }
        return;
      }
      
      // Lệnh xóa operator - chỉ owner bảo trì
      if (messageText.startsWith('/remove ')) {
        if (await isUserOwner(userId)) {
          await handleRemoveCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
        }
        return;
      }
      
      // Lệnh migrate data - chỉ owner bảo trì
      if (messageText === '/migrate') {
        if (await isUserOwner(userId)) {
          await handleMigrateDataCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
        }
        return;
      }

      // Thêm xử lý cho lệnh /onbut và /offbut
      if (messageText === '/onbut') {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleEnableButtonsCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }

      if (messageText === '/offbut') {
        // Kiểm tra quyền Operator
        if (await isUserOperator(userId, chatId)) {
          await handleDisableButtonsCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
        }
        return;
      }

      if (messageText === '/st') {
        await handleStartCommand(bot, chatId);
        return;
      }

      // Xử lý lệnh /chat
      if (messageText.startsWith('/chat')) {
        await handleChatWithButtons2Command(bot, msg);
        return;
      }

      // Lệnh xác nhận địa chỉ USDT - chỉ admin và owner
      if (messageText.startsWith('/usdtxn')) {
        if (await isUserAdmin(userId)) {
          await handleUsdtConfirmCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
        }
        return;
      }

      // Lệnh xóa xác nhận địa chỉ USDT - chỉ admin và owner
      if (messageText.startsWith('/usdtxxn')) {
        if (await isUserAdmin(userId)) {
          await handleUsdtRemoveConfirmCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
        }
        return;
      }

      if (messageText.startsWith('/rmusdt')) {
        if (await isUserAdmin(userId)) {
          await handleRemoveUsdtCommand(bot, msg);
        } else {
          bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能使用此命令！");
        }
        return;
      }

    }
    // Xử lý lệnh /inline2
    if (messageText.startsWith('/inline2 ')) {
      await handleAddInline2Command(bot, msg);
      return;
    }
    // Xử lý lệnh /removeinline2
    if (messageText.startsWith('/removeinline2 ')) {
      await handleRemoveInline2Command(bot, msg);
      return;
    }
    // Xử lý lệnh /buttons2
    if (messageText === '/buttons2') {
      await handleButtons2Command(bot, msg);
      return;
    }
    
    // Xử lý tin nhắn + và -
    if (messageText.startsWith('+')) {
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        await handlePlusCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
      return;
    }
    
    if (messageText.startsWith('-')) {
      // Kiểm tra quyền Operator
      if (await isUserOperator(userId, chatId)) {
        await handleMinusCommand(bot, msg);
      } else {
        bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      }
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
      // Gửi địa chỉ TRC20 dạng markdown
      bot.sendMessage(chatId, `TRC20地址:\n\`${messageText.trim()}\``, { parse_mode: 'Markdown' });
      return;
    }
    
    // Thêm xử lý media + caption cho lệnh /usdt
    if ((msg.photo || msg.video || msg.animation || msg.sticker) && msg.caption && msg.caption.match(/^T.{33}$/)) {
      // Nếu caption là địa chỉ USDT hợp lệ
      await handleSetUsdtAddressCommand(bot, msg);
      return;
    }
    // Nếu là reply vào media và text là /usdt <address>
    if (msg.reply_to_message && (msg.reply_to_message.photo || msg.reply_to_message.video || msg.reply_to_message.animation || msg.reply_to_message.sticker) && msg.text && msg.text.startsWith('/usdt ')) {
      await handleSetUsdtAddressCommand(bot, msg);
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
      
      // Nếu chưa có owner, user đầu tiên sẽ là owner và admin
      const isFirstUser = !ownerExists;
      
      user = new User({
        userId: userId.toString(),
        username,
        firstName,
        lastName,
        isOwner: isFirstUser,
        isAdmin: isFirstUser,
        groupPermissions: []
      });
      
      await user.save();
      
      if (isFirstUser) {
        console.log(`User ${username} (ID: ${userId}) is now the bot owner and admin`);
      }
    }
    
    return user;
  } catch (error) {
    console.error('Error in checkAndRegisterUser:', error);
    return null;
  }
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
  handleWithdrawRateCommand,
  handleDeleteCommand
} = require('./groupCommands');

const {
  handlePlusCommand,
  handleMinusCommand,
  handlePercentCommand,
  handleSkipCommand
} = require('./transactionCommands');

const {
  handleHideCardCommand,
  handleShowCardCommand,
  handleListHiddenCardsCommand
} = require('./cardCommands');

const {
  handleListUsersCommand,
  handleCurrencyUnitCommand,
  handleSetUsdtAddressCommand,
  handleSetOwnerCommand,
  handleRemoveCommand,
  handleMigrateDataCommand,
  handleAddAdminCommand,
  handleRemoveAdminCommand,
  handleListAdminsCommand,
  handleAddOperatorInGroupCommand,
  handleRemoveOperatorInGroupCommand,
  handleListOperatorsCommand,
  handleListGroupsCommand,
  handleAddInlineCommand,
  handleRemoveInlineCommand,
  displayInlineButtons,
  handleGetUsdtAddressCommand,
  handleEnableButtonsCommand,
  handleDisableButtonsCommand,
  handleAddInline2Command,
  handleRemoveInline2Command,
  handleButtons2Command,
  handleChatWithButtons2Command,
  handleUsdtConfirmCommand,
  handleUsdtRemoveConfirmCommand,
  handleRemoveUsdtCommand
} = require('./userCommands');

module.exports = {
  handleMessage
}; 