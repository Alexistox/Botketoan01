const User = require('../models/User');
const Group = require('../models/Group');
const Config = require('../models/Config');
const { isTrc20Address } = require('../utils/formatter');
const { migrateUserGroupsToOperators } = require('../utils/dataConverter');
const { isUserOwner, isUserAdmin, isUserOperator, extractUserFromCommand } = require('../utils/permissions');
const Transaction = require('../models/Transaction');
const fs = require('fs');
const path = require('path');
const BUTTONS2_PATH = path.join(__dirname, '../config/inline_buttons2.json');
const UsdtMedia = require('../models/UsdtMedia');
const usdtMediaHandler = require('../utils/usdtMediaHandler');

function readButtons2() {
  if (!fs.existsSync(BUTTONS2_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(BUTTONS2_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeButtons2(buttons) {
  fs.writeFileSync(BUTTONS2_PATH, JSON.stringify(buttons, null, 2), 'utf8');
}

/**
 * Xử lý lệnh thêm admin (/ad) - Chỉ Owner
 */
const handleAddAdminCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    
    // Chỉ Owner mới có quyền thêm Admin
    if (!await isUserOwner(userId)) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者才能添加管理员！");
      return;
    }
    
    // Phân tích tin nhắn
    const parts = messageText.split('/ad ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /ad @username1 @username2 @username3");
      return;
    }
    
    // Tách các username
    const usernames = parts[1].trim().split(' ').filter(u => u.startsWith('@'));
    if (usernames.length === 0) {
      bot.sendMessage(chatId, "/ad || 添加管理员。例如: /ad @username1 @username2");
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let message = '';

    // Xử lý từng username
    for (const username of usernames) {
      const targetUser = await extractUserFromCommand(username);
      if (!targetUser) {
        failCount++;
        continue;
      }
      
      // Kiểm tra nếu đã là admin
      if (targetUser.isAdmin) {
        message += `⚠️ 用户 @${targetUser.username} (ID: ${targetUser.userId}) 已经是管理员了。\n`;
        failCount++;
        continue;
      }
      
      // Cập nhật quyền Admin
      targetUser.isAdmin = true;
      await targetUser.save();
      message += `✅ 用户 @${targetUser.username} (ID: ${targetUser.userId}) 已被设置为管理员\n`;
      successCount++;
    }

    // Thêm thống kê vào cuối tin nhắn
    message += `\n📊 统计: 成功 ${successCount} 个, 失败 ${failCount} 个`;
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error in handleAddAdminCommand:', error);
    bot.sendMessage(msg.chat.id, "处理添加管理员命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh xóa admin (/removead) - Chỉ Owner
 */
const handleRemoveAdminCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    
    // Chỉ Owner mới có quyền xóa Admin
    if (!await isUserOwner(userId)) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者才能移除管理员！");
      return;
    }
    
    // Phân tích tin nhắn
    const parts = messageText.split('/removead ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /removead @username1 @username2 @username3");
      return;
    }
    
    // Tách các username
    const usernames = parts[1].trim().split(' ').filter(u => u.startsWith('@'));
    if (usernames.length === 0) {
      bot.sendMessage(chatId, "/removead || 删除管理员。例如: /removead @username1 @username2");
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let message = '';

    // Xử lý từng username
    for (const username of usernames) {
      const targetUser = await extractUserFromCommand(username);
      if (!targetUser) {
        failCount++;
        continue;
      }
      
      // Kiểm tra nếu là owner
      if (targetUser.isOwner) {
        message += `⛔ 不能移除机器人所有者的管理员权限！\n`;
        failCount++;
        continue;
      }
      
      // Kiểm tra nếu không phải admin
      if (!targetUser.isAdmin) {
        message += `⚠️ 用户 @${targetUser.username} (ID: ${targetUser.userId}) 不是管理员。\n`;
        failCount++;
        continue;
      }
      
      // Cập nhật quyền Admin
      targetUser.isAdmin = false;
      await targetUser.save();
      message += `✅ 已移除用户 @${targetUser.username} (ID: ${targetUser.userId}) 的管理员权限\n`;
      successCount++;
    }

    // Thêm thống kê vào cuối tin nhắn
    message += `\n📊 统计: 成功 ${successCount} 个, 失败 ${failCount} 个`;
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error in handleRemoveAdminCommand:', error);
    bot.sendMessage(msg.chat.id, "处理移除管理员命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh liệt kê tất cả admin (/admins) - Chỉ Owner
 */
const handleListAdminsCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Chỉ Owner mới có quyền xem danh sách Admin
    if (!await isUserOwner(userId)) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者才能查看管理员列表！");
      return;
    }
    
    // Tìm tất cả admin và owner
    const admins = await User.find({ 
      $or: [{ isAdmin: true }, { isOwner: true }]
    }).sort({ isOwner: -1 }); // Owner hiển thị trước
    
    if (admins.length === 0) {
      bot.sendMessage(chatId, "⚠️ 尚未设置任何管理员或所有者。");
      return;
    }
    
    // Tạo danh sách hiển thị
    let message = '👑 管理员列表:\n\n';
    
    admins.forEach(admin => {
      const role = admin.isOwner ? '👑 所有者' : '🔰 管理员';
      message += `${role}: @${admin.username} (ID: ${admin.userId})\n`;
    });
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error in handleListAdminsCommand:', error);
    bot.sendMessage(msg.chat.id, "处理查看管理员列表命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thêm operator (/op) - Admin và Owner
 */
const handleAddOperatorInGroupCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const senderName = msg.from.username || msg.from.first_name || 'unknown';
    const messageText = msg.text;
    
    // Chỉ Admin và Owner có quyền thêm Operator
    if (!await isUserAdmin(userId)) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能添加操作员！");
      return;
    }
    
    // Phân tích tin nhắn
    const parts = messageText.split('/op ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /op @username1 @username2 @username3");
      return;
    }
    
    // Tách các username
    const usernames = parts[1].trim().split(' ').filter(u => u.startsWith('@'));
    if (usernames.length === 0) {
      bot.sendMessage(chatId, "/op || 设置操作。例如: /op @username1 @username2");
      return;
    }

    // Tìm hoặc tạo nhóm
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({
        chatId: chatId.toString(),
        operators: []
      });
    }

    let successCount = 0;
    let failCount = 0;
    let message = '';

    // Xử lý từng username
    for (const username of usernames) {
      const targetUser = await extractUserFromCommand(username);
      if (!targetUser) {
        failCount++;
        continue;
      }
      
      // Kiểm tra xem đã là operator chưa
      const existingOperator = group.operators.find(op => op.userId === targetUser.userId);
      if (existingOperator) {
        message += `⚠️ 用户 @${targetUser.username} (ID: ${targetUser.userId}) 已经是此群组的操作员。\n`;
        failCount++;
        continue;
      }
      
      // Thêm vào danh sách operators
      group.operators.push({
        userId: targetUser.userId,
        username: targetUser.username,
        dateAdded: new Date()
      });
      
      // Cập nhật groupPermissions trong User document
      const groupPerm = targetUser.groupPermissions.find(p => p.chatId === chatId.toString());
      if (groupPerm) {
        groupPerm.isOperator = true;
      } else {
        targetUser.groupPermissions.push({
          chatId: chatId.toString(),
          isOperator: true
        });
      }
      
      await targetUser.save();
      message += `✅ 用户 @${targetUser.username} (ID: ${targetUser.userId}) 已被添加为此群组的操作员\n`;
      successCount++;
    }

    // Lưu thay đổi vào group
    await group.save();

    // Thêm thống kê vào cuối tin nhắn
    message += `\n📊 统计: 成功 ${successCount} 个, 失败 ${failCount} 个`;
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error in handleAddOperatorInGroupCommand:', error);
    bot.sendMessage(msg.chat.id, "处理添加操作员命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh xóa operator (/removeop) - Admin và Owner
 */
const handleRemoveOperatorInGroupCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    
    // Chỉ Admin và Owner có quyền xóa Operator
    if (!await isUserAdmin(userId)) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能移除操作员！");
      return;
    }
    
    // Phân tích tin nhắn
    const parts = messageText.split('/removeop ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /removeop @username1 @username2 @username3");
      return;
    }
    
    // Tách các username
    const usernames = parts[1].trim().split(' ').filter(u => u.startsWith('@'));
    if (usernames.length === 0) {
      bot.sendMessage(chatId, "用 /removeop || 删除操作。例如: /removeop @username1 @username2");
      return;
    }

    // Tìm thông tin nhóm
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group || !group.operators || group.operators.length === 0) {
      bot.sendMessage(chatId, `⚠️ 此群组尚未设置任何操作员。`);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let message = '';

    // Xử lý từng username
    for (const username of usernames) {
      const targetUser = await extractUserFromCommand(username);
      if (!targetUser) {
        failCount++;
        continue;
      }
      
      // Kiểm tra xem có trong danh sách không
      const operatorIndex = group.operators.findIndex(op => op.userId === targetUser.userId);
      if (operatorIndex === -1) {
        message += `⚠️ 用户 @${targetUser.username} (ID: ${targetUser.userId}) 不是此群组的操作员。\n`;
        failCount++;
        continue;
      }
      
      // Kiểm tra nếu là owner/admin
      if (targetUser.isOwner || targetUser.isAdmin) {
        message += `⛔ 不能移除所有者或管理员的操作员权限！\n`;
        failCount++;
        continue;
      }
      
      // Xóa khỏi danh sách operators
      group.operators.splice(operatorIndex, 1);
      
      // Cập nhật groupPermissions trong User document
      const groupPermIndex = targetUser.groupPermissions.findIndex(p => p.chatId === chatId.toString());
      if (groupPermIndex !== -1) {
        targetUser.groupPermissions.splice(groupPermIndex, 1);
        await targetUser.save();
      }
      
      message += `✅ 已移除用户 @${targetUser.username} (ID: ${targetUser.userId}) 的操作员权限\n`;
      successCount++;
    }

    // Lưu thay đổi vào group
    await group.save();

    // Thêm thống kê vào cuối tin nhắn
    message += `\n📊 统计: 成功 ${successCount} 个, 失败 ${failCount} 个`;
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error in handleRemoveOperatorInGroupCommand:', error);
    bot.sendMessage(msg.chat.id, "处理移除操作员命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh liệt kê operators (/ops) - Tất cả
 */
const handleListOperatorsCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Tìm thông tin nhóm
    const group = await Group.findOne({ chatId: chatId.toString() });
    
    if (!group || !group.operators || group.operators.length === 0) {
      bot.sendMessage(chatId, `⚠️ 此群组尚未设置任何操作员。`);
      return;
    }
    
    // Sắp xếp theo thời gian thêm vào, mới nhất lên đầu
    const sortedOperators = [...group.operators].sort((a, b) => 
      new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0)
    );
    
    // Tạo danh sách hiển thị
    let message = '👥 此群组的操作员列表:\n\n';
    
    for (const op of sortedOperators) {
      const user = await User.findOne({ userId: op.userId });
      let roleBadge = '';
      
      if (user) {
        if (user.isOwner) {
          roleBadge = '👑';
        } else if (user.isAdmin) {
          roleBadge = '🔰';
        } else {
          roleBadge = '🔹';
        }
      } else {
        roleBadge = '🔹';
      }
      
      message += `${roleBadge} @${op.username} (ID: ${op.userId})\n`;
    }
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error in handleListOperatorsCommand:', error);
    bot.sendMessage(msg.chat.id, "处理查看操作员列表命令时出错。请稍后再试。");
  }
};


const handleListUsersCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Tìm tất cả owner
    const owners = await User.find({ isOwner: true });
    let ownersList = '';
    if (owners.length > 0) {
      ownersList = '🔑 所有者列表:\n' + owners.map(o => `@${o.username}: ${o.userId}`).join('\n');
    } else {
      ownersList = '🔑 尚未设置机器人所有者';
    }
    
    // Tìm thông tin nhóm và danh sách operators
    const group = await Group.findOne({ chatId: chatId.toString() });
    
    let operatorsList = '';
    if (group && group.operators && group.operators.length > 0) {
      // Sắp xếp theo thời gian thêm vào, mới nhất lên đầu
      const sortedOperators = [...group.operators].sort((a, b) => 
        new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0)
      );
      
      operatorsList = '👥 此群组的操作人列表:\n' + sortedOperators.map(op => `@${op.username}: ${op.userId}`).join('\n');
    } else {
      operatorsList = '👥 此群组尚未有操作人';
    }
    
    // Send both lists
    bot.sendMessage(chatId, `${ownersList}\n\n${operatorsList}`);
  } catch (error) {
    console.error('Error in handleListUsersCommand:', error);
    bot.sendMessage(msg.chat.id, "处理列出用户命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thiết lập đơn vị tiền tệ (/m)
 */
const handleCurrencyUnitCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Phân tích tin nhắn
    const parts = messageText.split('/m ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：/m 币种名称");
      return;
    }
    
    const currencyUnit = parts[1].trim().toUpperCase();
    if (!currencyUnit) {
      bot.sendMessage(chatId, "请指定一个币种名称。");
      return;
    }
    
    // Lưu riêng cho từng nhóm
    let config = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    
    if (!config) {
      config = new Config({
        key: `CURRENCY_UNIT_${chatId}`,
        value: currencyUnit
      });
    } else {
      config.value = currencyUnit;
    }
    
    await config.save();
    bot.sendMessage(chatId, `✅ 已设置本群币种为 ${currencyUnit}`);
  } catch (error) {
    console.error('Error in handleCurrencyUnitCommand:', error);
    bot.sendMessage(msg.chat.id, "处理设置币种命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thiết lập địa chỉ USDT (/usdt)
 */
const handleSetUsdtAddressCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    let address = null;
    let mediaType = null;
    let fileId = null;
    let fileUniqueId = null;

    // Ưu tiên media + caption
    if (usdtMediaHandler.hasMedia(msg) && msg.caption) {
      address = msg.caption.trim();
      if (!isTrc20Address(address)) {
        bot.sendMessage(chatId, "❌ TRC20地址无效！地址必须以字母T开头并且有34个字符。");
        return;
      }
      
      // Xử lý media files
      const mediaFiles = usdtMediaHandler.processMediaFromMessage(msg);
      
      // Lưu vào UsdtMediaHandler (không bắt lỗi)
      try {
        await usdtMediaHandler.saveUsdtMedia(
          chatId, 
          address, 
          mediaFiles, 
          userId.toString(), 
          msg.from.first_name || msg.from.username || 'Unknown'
        );
      } catch (error) {
        console.log('UsdtMediaHandler save failed, using Config only');
      }
      // Lưu vào Config (giữ logic cũ)
      let config = await Config.findOne({ key: 'USDT_ADDRESS' });
      if (!config) {
        config = new Config({ key: 'USDT_ADDRESS', value: address });
      } else {
        config.value = address;
      }
      await config.save();
      bot.sendMessage(chatId, `✅ 保存成功!`);
      return;
    }

    // Nếu là reply vào tin nhắn có media và text là /usdt <address>
    if (msg.reply_to_message && (msg.reply_to_message.photo || msg.reply_to_message.video || msg.reply_to_message.animation || msg.reply_to_message.sticker)) {
      const parts = msg.text.split('/usdt ');
      if (parts.length === 2) {
        address = parts[1].trim();
        if (!isTrc20Address(address)) {
          bot.sendMessage(chatId, "❌ TRC20地址无效！地址必须以字母T开头并且有34个字符。");
          return;
        }
        // Xử lý media files từ reply message
        const mediaFiles = usdtMediaHandler.processMediaFromMessage(msg.reply_to_message);
        
        // Lưu vào UsdtMediaHandler (không bắt lỗi)
        try {
          await usdtMediaHandler.saveUsdtMedia(
            chatId, 
            address, 
            mediaFiles, 
            userId.toString(), 
            msg.from.first_name || msg.from.username || 'Unknown'
          );
        } catch (error) {
          console.log('UsdtMediaHandler save failed, using Config only');
        }
        // Lưu vào Config (giữ logic cũ)
        let config = await Config.findOne({ key: 'USDT_ADDRESS' });
        if (!config) {
          config = new Config({ key: 'USDT_ADDRESS', value: address });
        } else {
          config.value = address;
        }
        await config.save();
        bot.sendMessage(chatId, `✅ 保存成功!`);
        return;
      }
    }

    // Nếu chỉ có text như cũ
    const messageText = msg.text;
    const parts = messageText.split('/usdt ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "ℹ️ 语法: /usdt <TRC20地址>");
      return;
    }
    address = parts[1].trim();
    if (!isTrc20Address(address)) {
      bot.sendMessage(chatId, "❌ TRC20地址无效！地址必须以字母T开头并且有34个字符。");
      return;
    }
    // Lưu vào UsdtMediaHandler (không có media files)
    try {
      await usdtMediaHandler.saveUsdtMedia(
        chatId, 
        address, 
        [], // Không có media files
        userId.toString(), 
        msg.from.first_name || msg.from.username || 'Unknown'
      );
    } catch (error) {
      console.log('UsdtMediaHandler save failed, using Config only');
    }
    
    // Lưu vào Config (giữ logic cũ)
    let config = await Config.findOne({ key: 'USDT_ADDRESS' });
    const oldAddress = config ? config.value : null;
    if (!config) {
      config = new Config({ key: 'USDT_ADDRESS', value: address });
    } else {
      config.value = address;
    }
    await config.save();
    if (oldAddress) {
      bot.sendMessage(chatId, "🔄 已更新USDT-TRC20地址:\n`" + address + "`");
    } else {
      bot.sendMessage(chatId, "✅ 已保存全局USDT-TRC20地址:\n`" + address + "`");
    }
  } catch (error) {
    console.error('Error in handleSetUsdtAddressCommand:', error);
    bot.sendMessage(msg.chat.id, "处理设置USDT地址命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh lấy địa chỉ USDT (/u)
 */
const handleGetUsdtAddressCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Lấy USDT media từ UsdtMediaHandler
    let usdtMedia = null;
    let address = null;
    
    try {
      usdtMedia = await usdtMediaHandler.getUsdtMedia(chatId);
      if (usdtMedia && usdtMedia.usdtAddress) {
        address = usdtMedia.usdtAddress;
      }
    } catch (error) {
      console.log('UsdtMediaHandler get failed, trying Config');
    }
    
    // Fallback to Config if UsdtMediaHandler fails
    if (!address) {
      const config = await Config.findOne({ key: 'USDT_ADDRESS' });
      if (config && config.value) {
        address = config.value;
      }
    }
    
    if (!address) {
      bot.sendMessage(chatId, "⚠️ 尚未设置USDT-TRC20地址。请使用 /usdt 命令设置。");
      return;
    }
    
    // Nếu có media files, gửi media group
    if (usdtMedia.mediaFiles && usdtMedia.mediaFiles.length > 0) {
      try {
        await usdtMediaHandler.sendUsdtMedia(bot, chatId, usdtMedia);
        return;
      } catch (error) {
        console.error('Error sending USDT media:', error);
        // Fallback to text if media fails
      }
    }
    
    // Fallback: Gửi text nếu không có media hoặc media lỗi
    // Tạo lưu ý về 6 ký tự đầu, giữa, cuối (tiếng Trung, ngắn gọn)
    let note = '';
    if (address.length === 34) {
      const first6 = address.slice(0, 6);
      const mid6 = address.slice(14, 20);
      const last6 = address.slice(-6);
      note = `\n首6: \`${first6}\`  中6: \`${mid6}\`  末6: \`${last6}\``;
    }
    // Nhắc nhở ngắn gọn
    const remind = '\n请务必核对地址片段，防止转错！';
    // Caption tiếng Trung, ngắn gọn
    const caption = `USDT地址: \n\n\`${address}\`\n\n${note}${remind}`;
    
    // Gửi text nếu không có media
    await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in handleGetUsdtAddressCommand:', error);
    bot.sendMessage(msg.chat.id, "处理获取USDT地址命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thiết lập người sở hữu (/setowner)
 */
const handleSetOwnerCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    const senderId = msg.from.id;
    
    // Chỉ cho phép owner hiện tại thêm owner khác
    const isCurrentUserOwner = await isUserOwner(senderId.toString());
    if (!isCurrentUserOwner) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
      return;
    }
    
    // Phân tích tin nhắn
    const parts = messageText.split('/setowner ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：/setowner @username");
      return;
    }
    
    // Lấy username
    const usernameText = parts[1].trim();
    const username = usernameText.replace('@', '');
    
    if (!username) {
      bot.sendMessage(chatId, "请指定一个用户名。");
      return;
    }
    
    // Tìm người dùng theo username
    let user = await User.findOne({ username });
    
    if (!user) {
      // Tạo người dùng mới nếu không tồn tại
      const uniqueUserId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      user = new User({
        userId: uniqueUserId,
        username,
        isOwner: true,
        isAllowed: true
      });
      await user.save();
      bot.sendMessage(chatId, `✅ 已将新用户 @${username} 设置为机器人所有者。`);
    } else if (user.isOwner) {
      bot.sendMessage(chatId, `⚠️ 用户 @${username} 已是机器人所有者。`);
    } else {
      user.isOwner = true;
      user.isAllowed = true;
      await user.save();
      bot.sendMessage(chatId, `✅ 已将用户 @${username} 设置为机器人所有者。`);
    }
  } catch (error) {
    console.error('Error in handleSetOwnerCommand:', error);
    bot.sendMessage(msg.chat.id, "处理设置所有者命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh chuyển đổi dữ liệu (/migrate)
 */
const handleMigrateDataCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Chỉ cho phép owner thực hiện việc chuyển đổi dữ liệu
    const isCurrentUserOwner = await isUserOwner(userId.toString());
    if (!isCurrentUserOwner) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
      return;
    }
    
    bot.sendMessage(chatId, "🔄 开始数据迁移，请稍后...");
    
    const result = await migrateUserGroupsToOperators();
    
    if (result.success) {
      bot.sendMessage(chatId, "✅ 数据迁移成功！用户权限已从旧结构转移到新结构。");
    } else {
      bot.sendMessage(chatId, `❌ 数据迁移失败: ${result.error}`);
    }
  } catch (error) {
    console.error('Error in handleMigrateDataCommand:', error);
    bot.sendMessage(msg.chat.id, "处理数据迁移命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh hiển thị danh sách nhóm
 */
const handleListGroupsCommand = async (bot, msg) => {
  try {
    const userId = msg.from.id;
    
    // Chỉ cho phép owner hoặc admin sử dụng lệnh này
    if (!(await isUserAdmin(userId))) {
      bot.sendMessage(msg.chat.id, "⛔ 只有机器人所有者和管理员才能使用此命令！");
      return;
    }
    
    // Lấy tất cả các nhóm từ database
    const groups = await Group.find({});
    
    if (groups.length === 0) {
      bot.sendMessage(msg.chat.id, "机器人还没有加入任何群组。");
      return;
    }
    
    // Format danh sách nhóm
    let message = "*🔄 机器人加入的群组列表:*\n\n";
    
    for (const group of groups) {
      // Lấy thông tin tên nhóm nếu có
      let groupTitle = "未知群组";
      try {
        const chatInfo = await bot.getChat(group.chatId);
        groupTitle = chatInfo.title || `Chat ID: ${group.chatId}`;
      } catch (error) {
        // Không lấy được thông tin chat, có thể bot đã bị đá khỏi nhóm
        groupTitle = `未知群组 (ID: ${group.chatId})`;
      }
      
      // Đếm số lượng giao dịch trong nhóm
      const transactionCount = await Transaction.countDocuments({ 
        chatId: group.chatId,
        skipped: { $ne: true }
      });
      
      // Thêm vào message
      message += `*${groupTitle}*\n`;
      message += `Chat ID: \`${group.chatId}\`\n`;
      message += `Rate: ${group.rate}% | Exchange Rate: ${group.exchangeRate}\n`;
      message += `Transactions: ${transactionCount}\n`;
      message += `Last Clear: ${group.lastClearDate ? group.lastClearDate.toLocaleString() : 'Never'}\n\n`;
    }
    
    message += `Total Groups: ${groups.length}`;
    
    // Gửi tin nhắn
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error in handleListGroupsCommand:', error);
    bot.sendMessage(msg.chat.id, "处理列出群组命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thêm nút inline keyboard
 */
const handleAddInlineCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    
    // Kiểm tra quyền Operator
    if (!(await isUserOperator(userId, chatId))) {
      bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      return;
    }
    
    // Phân tích cú pháp tin nhắn
    const parts = messageText.split('/inline ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：/inline 按钮文字|命令内容");
      return;
    }
    
    const inputParts = parts[1].split('|');
    if (inputParts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：/inline 按钮文字|命令内容");
      return;
    }
    
    const buttonText = inputParts[0].trim();
    const commandText = inputParts[1].trim();
    
    if (!buttonText || !commandText) {
      bot.sendMessage(chatId, "按钮文字和命令内容不能为空。");
      return;
    }
    
    // Tìm hoặc tạo Config cho inline buttons
    let inlineConfig = await Config.findOne({ key: 'INLINE_BUTTONS_GLOBAL' });
    
    let buttons = [];
    if (inlineConfig) {
      try {
        buttons = JSON.parse(inlineConfig.value);
      } catch (error) {
        buttons = [];
      }
    } else {
      inlineConfig = new Config({
        key: 'INLINE_BUTTONS_GLOBAL',
        value: JSON.stringify([])
      });
    }
    
    // Kiểm tra xem nút đã tồn tại chưa
    const existingButtonIndex = buttons.findIndex(b => b.text === buttonText);
    
    if (existingButtonIndex >= 0) {
      // Cập nhật nút hiện có
      buttons[existingButtonIndex] = { text: buttonText, command: commandText };
      bot.sendMessage(chatId, `✅ 已更新现有按钮 "${buttonText}"`);
    } else {
      // Thêm nút mới
      buttons.push({ text: buttonText, command: commandText });
      bot.sendMessage(chatId, `✅ 已添加新按钮 "${buttonText}"`);
    }
    
    // Lưu cấu hình
    inlineConfig.value = JSON.stringify(buttons);
    await inlineConfig.save();
    
    // Hiển thị danh sách các nút hiện tại
    await displayInlineButtons(bot, chatId);
    
  } catch (error) {
    console.error('Error in handleAddInlineCommand:', error);
    bot.sendMessage(msg.chat.id, "处理添加按钮命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh xóa nút inline keyboard
 */
const handleRemoveInlineCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    
    // Kiểm tra quyền Operator
    if (!(await isUserOperator(userId, chatId))) {
      bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      return;
    }
    
    // Phân tích cú pháp tin nhắn
    const parts = messageText.split('/removeinline ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：/removeinline 按钮文字");
      return;
    }
    
    const buttonText = parts[1].trim();
    
    if (!buttonText) {
      bot.sendMessage(chatId, "按钮文字不能为空。");
      return;
    }
    
    // Tìm cấu hình inline buttons
    const inlineConfig = await Config.findOne({ key: 'INLINE_BUTTONS_GLOBAL' });
    
    if (!inlineConfig) {
      bot.sendMessage(chatId, "还没有设置任何按钮。");
      return;
    }
    
    let buttons = [];
    try {
      buttons = JSON.parse(inlineConfig.value);
    } catch (error) {
      bot.sendMessage(chatId, "按钮配置无效。");
      return;
    }
    
    // Tìm và xóa nút
    const initialLength = buttons.length;
    buttons = buttons.filter(b => b.text !== buttonText);
    
    if (buttons.length < initialLength) {
      // Lưu cấu hình mới
      inlineConfig.value = JSON.stringify(buttons);
      await inlineConfig.save();
      bot.sendMessage(chatId, `✅ 已删除按钮 "${buttonText}"`);
    } else {
      bot.sendMessage(chatId, `❌ 未找到按钮 "${buttonText}"`);
    }
    
    // Hiển thị danh sách các nút hiện tại
    await displayInlineButtons(bot, chatId);
    
  } catch (error) {
    console.error('Error in handleRemoveInlineCommand:', error);
    bot.sendMessage(msg.chat.id, "处理删除按钮命令时出错。请稍后再试。");
  }
};

/**
 * Hiển thị danh sách các nút inline hiện tại
 */
const displayInlineButtons = async (bot, chatId) => {
  try {
    // Tìm cấu hình inline buttons
    const inlineConfig = await Config.findOne({ key: 'INLINE_BUTTONS_GLOBAL' });
    
    if (!inlineConfig) {
      bot.sendMessage(chatId, "还没有设置任何按钮。");
      return;
    }
    
    let buttons = [];
    try {
      buttons = JSON.parse(inlineConfig.value);
    } catch (error) {
      bot.sendMessage(chatId, "按钮配置无效。");
      return;
    }
    
    if (buttons.length === 0) {
      bot.sendMessage(chatId, "还没有设置任何按钮。");
      return;
    }
    
    // Hiển thị danh sách nút
    let message = "*当前按钮列表:*\n\n";
    
    buttons.forEach((button, index) => {
      message += `${index + 1}. 文字: *${button.text}*\n`;
      message += `   命令: \`${button.command}\`\n\n`;
    });
    
    // Tạo keyboard inline
    const inlineKeyboard = {
      inline_keyboard: buttons.map(button => [
        { text: button.text, callback_data: button.command }
      ])
    };
    
    // Gửi tin nhắn với keyboard
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
    
  } catch (error) {
    console.error('Error in displayInlineButtons:', error);
    bot.sendMessage(chatId, "显示按钮列表时出错。请稍后再试。");
  }
};

/**
 * Xử lý callback từ nút inline
 */
const handleInlineButtonCallback = async (bot, callbackQuery) => {
  try {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const command = callbackQuery.data;
    
    // Acknowledge the callback query to remove the loading indicator
    await bot.answerCallbackQuery(callbackQuery.id);
    
    // Kiểm tra quyền người dùng
    if (!(await isUserOperator(userId, chatId))) {
      bot.sendMessage(chatId, "⛔ 您无权使用此功能！需要操作员权限。");
      return;
    }
    
    // Tạo một tin nhắn mới với nội dung của nút
    const msg = {
      chat: { id: chatId },
      from: callbackQuery.from,
      text: command,
      message_id: callbackQuery.message.message_id
    };
    
    // Gửi tin nhắn đến hàm xử lý tin nhắn
    // Đây là một kỹ thuật để tái sử dụng logic xử lý lệnh
    const { handleMessage } = require('./messageController');
    await handleMessage(bot, msg);
    
  } catch (error) {
    console.error('Error in handleInlineButtonCallback:', error);
  }
};

/**
 * Xử lý lệnh bật hiển thị buttons (/onbut)
 */
const handleEnableButtonsCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Kiểm tra quyền Operator
    if (!(await isUserOperator(userId, chatId))) {
      bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      return;
    }
    
    // Tìm hoặc tạo Config cho trạng thái buttons
    let buttonsConfig = await Config.findOne({ key: `SHOW_BUTTONS_${chatId}` });
    
    if (!buttonsConfig) {
      buttonsConfig = new Config({
        key: `SHOW_BUTTONS_${chatId}`,
        value: 'true'
      });
    } else {
      buttonsConfig.value = 'true';
    }
    
    await buttonsConfig.save();
    bot.sendMessage(chatId, "✅ 已启用所有消息的按钮显示");
    
  } catch (error) {
    console.error('Error in handleEnableButtonsCommand:', error);
    bot.sendMessage(msg.chat.id, "处理命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh tắt hiển thị buttons (/offbut)
 */
const handleDisableButtonsCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Kiểm tra quyền Operator
    if (!(await isUserOperator(userId, chatId))) {
      bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      return;
    }
    
    // Tìm hoặc tạo Config cho trạng thái buttons
    let buttonsConfig = await Config.findOne({ key: `SHOW_BUTTONS_${chatId}` });
    
    if (!buttonsConfig) {
      buttonsConfig = new Config({
        key: `SHOW_BUTTONS_${chatId}`,
        value: 'false'
      });
    } else {
      buttonsConfig.value = 'false';
    }
    
    await buttonsConfig.save();
    bot.sendMessage(chatId, "✅ 已禁用所有消息的按钮显示");
    
  } catch (error) {
    console.error('Error in handleDisableButtonsCommand:', error);
    bot.sendMessage(msg.chat.id, "处理命令时出错。请稍后再试。");
  }
};

/**
 * Lấy trạng thái hiển thị buttons
 */
const getButtonsStatus = async (chatId) => {
  try {
    const buttonsConfig = await Config.findOne({ key: `SHOW_BUTTONS_${chatId}` });
    return buttonsConfig ? buttonsConfig.value === 'true' : true; // Mặc định là true
  } catch (error) {
    console.error('Error in getButtonsStatus:', error);
    return true;
  }
};

/**
 * Lấy inline keyboard từ cấu hình
 */
const getInlineKeyboard = async (chatId) => {
  try {
    const inlineConfig = await Config.findOne({ key: 'INLINE_BUTTONS_GLOBAL' });
    if (!inlineConfig) return null;
    
    let buttons = [];
    try {
      buttons = JSON.parse(inlineConfig.value);
    } catch (error) {
      return null;
    }
    
    if (buttons.length === 0) return null;
    
    // Sắp xếp các buttons theo hàng ngang, mỗi hàng tối đa 3 buttons
    const keyboard = [];
    for (let i = 0; i < buttons.length; i += 3) {
      const row = buttons.slice(i, i + 3).map(button => {
        // Kiểm tra nếu command là URL
        if (button.command.startsWith('http://') || button.command.startsWith('https://')) {
          return {
            text: button.text,
            url: button.command
          };
        }
        return {
          text: button.text,
          callback_data: button.command
        };
      });
      keyboard.push(row);
    }
    
    return {
      inline_keyboard: keyboard
    };
  } catch (error) {
    console.error('Error in getInlineKeyboard:', error);
    return null;
  }
};

// Thêm button vào bộ 2
const handleAddInline2Command = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!(await isUserOperator(userId, chatId))) {
    bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
    return;
  }
  const args = msg.text.split(' ');
  if (args.length < 3) {
    bot.sendMessage(chatId, 'Cú pháp: /inline2 [Tên nút] [Link]');
    return;
  }
  const text = args[1];
  const command = args.slice(2).join(' ');
  let buttons = readButtons2();
  if (buttons.find(b => b.text === text)) {
    bot.sendMessage(chatId, 'Tên nút đã tồn tại!');
    return;
  }
  buttons.push({ text, command });
  writeButtons2(buttons);
  bot.sendMessage(chatId, `Đã thêm button: ${text}`);
};

// Xóa button khỏi bộ 2
const handleRemoveInline2Command = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!(await isUserOperator(userId, chatId))) {
    bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
    return;
  }
  const args = msg.text.split(' ');
  if (args.length < 2) {
    bot.sendMessage(chatId, 'Cú pháp: /removeinline2 [Tên nút]');
    return;
  }
  const text = args[1];
  let buttons = readButtons2();
  const newButtons = buttons.filter(b => b.text !== text);
  if (newButtons.length === buttons.length) {
    bot.sendMessage(chatId, 'Không tìm thấy button này!');
    return;
  }
  writeButtons2(newButtons);
  bot.sendMessage(chatId, `Đã xóa button: ${text}`);
};

// Hiển thị danh sách button bộ 2
const handleButtons2Command = async (bot, msg) => {
  const chatId = msg.chat.id;
  const buttons = readButtons2();
  if (!buttons.length) {
    bot.sendMessage(chatId, 'Chưa có button nào!');
    return;
  }
  // Sắp xếp hàng ngang, mỗi hàng 3 nút
  const keyboard = [];
  for (let i = 0; i < buttons.length; i += 3) {
    const row = buttons.slice(i, i + 3).map(b => {
      if (b.command.startsWith('http://') || b.command.startsWith('https://')) {
        return { text: b.text, url: b.command };
      }
      return { text: b.text, callback_data: b.command };
    });
    keyboard.push(row);
  }
  bot.sendMessage(chatId, 'Danh sách button:', {
    reply_markup: { inline_keyboard: keyboard }
  });
};

const handleChatWithButtons2Command = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!(await isUserOperator(userId, chatId))) {
    bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
    return;
  }
  const buttons = readButtons2();
  // Sắp xếp hàng ngang, mỗi hàng 3 nút
  const keyboard = [];
  for (let i = 0; i < buttons.length; i += 3) {
    const row = buttons.slice(i, i + 3).map(b => {
      if (b.command.startsWith('http://') || b.command.startsWith('https://')) {
        return { text: b.text, url: b.command };
      }
      return { text: b.text, callback_data: b.command };
    });
    keyboard.push(row);
  }
  const reply_markup = { inline_keyboard: keyboard };

  // Nếu là reply vào tin nhắn có media
  if (msg.reply_to_message) {
    const r = msg.reply_to_message;
    if (r.photo) {
      // Ảnh
      const fileId = r.photo[r.photo.length - 1].file_id;
      await bot.sendPhoto(chatId, fileId, { caption: r.caption || '', reply_markup });
      return;
    }
    if (r.video) {
      await bot.sendVideo(chatId, r.video.file_id, { caption: r.caption || '', reply_markup });
      return;
    }
    if (r.document) {
      await bot.sendDocument(chatId, r.document.file_id, { caption: r.caption || '', reply_markup });
      return;
    }
    if (r.animation) {
      await bot.sendAnimation(chatId, r.animation.file_id, { caption: r.caption || '', reply_markup });
      return;
    }
    if (r.text) {
      await bot.sendMessage(chatId, r.text, { reply_markup });
      return;
    }
    // Nếu không có gì phù hợp
    bot.sendMessage(chatId, 'Không hỗ trợ loại tin nhắn này!');
    return;
  }
  // Nếu không phải reply, lấy nội dung sau /chat
  const args = msg.text.split(' ');
  if (args.length < 2) {
    bot.sendMessage(chatId, 'Cú pháp: /chat [nội dung hoặc reply vào tin nhắn]');
    return;
  }
  const content = msg.text.substring(6).trim();
  if (!content) {
    bot.sendMessage(chatId, 'Cú pháp: /chat [nội dung hoặc reply vào tin nhắn]');
    return;
  }
  await bot.sendMessage(chatId, content, { reply_markup });
};

/**
 * Xử lý lệnh xác nhận địa chỉ USDT (/usdtxn) - chỉ thêm, không xóa
 */
const handleUsdtConfirmCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    // Lấy địa chỉ USDT hiện tại
    const config = await Config.findOne({ key: 'USDT_ADDRESS' });
    if (!config || !config.value) {
      bot.sendMessage(chatId, "⚠️ 尚未设置USDT-TRC20地址。请使用 /usdt 命令设置。");
      return;
    }
    const address = config.value;
    // Lấy media mới nhất cho địa chỉ này
    const media = await UsdtMedia.findOne({ address }).sort({ createdAt: -1 });
    if (!media) {
      bot.sendMessage(chatId, "⚠️ 当前地址还没有配图！");
      return;
    }
    // Lấy danh sách username từ lệnh
    const parts = messageText.split(' ');
    if (parts.length < 2) {
      bot.sendMessage(chatId, "用法: /usdtxn @用户名1 @用户名2 ...");
      return;
    }
    const usernames = parts.slice(1).filter(u => u.startsWith('@')).map(u => u.replace('@', ''));
    if (usernames.length === 0) {
      bot.sendMessage(chatId, "请至少输入一个用户名！");
      return;
    }
    // Tìm userId và tên cho từng username (nếu có trong User)
    const users = await User.find({ username: { $in: usernames } });
    const confirmedBy = users.map(u => ({ username: u.username, userId: u.userId, fullName: (u.firstName || '') + (u.lastName ? ' ' + u.lastName : '') }));
    usernames.forEach(uname => {
      if (!confirmedBy.find(u => u.username === uname)) {
        confirmedBy.push({ username: uname, userId: '', fullName: '' });
      }
    });
    // Thêm vào danh sách đã xác nhận (không trùng lặp)
    let existed = media.confirmedBy || [];
    confirmedBy.forEach(newU => {
      if (!existed.find(u => u.username === newU.username)) {
        existed.push(newU);
      }
    });
    media.confirmedBy = existed;
    await media.save();
    bot.sendMessage(chatId, `✅ 已添加确认人: ${usernames.map(u => '@' + u).join(', ')}\n当前确认人: ${existed.map(u => '@' + u.username).join(', ')}`);
  } catch (error) {
    console.error('Error in handleUsdtConfirmCommand:', error);
    bot.sendMessage(msg.chat.id, "处理 /usdtxn 命令时出错，请稍后再试。");
  }
};

/**
 * Xử lý lệnh xóa xác nhận địa chỉ USDT (/usdtxxn)
 */
const handleUsdtRemoveConfirmCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    // Lấy địa chỉ USDT hiện tại
    const config = await Config.findOne({ key: 'USDT_ADDRESS' });
    if (!config || !config.value) {
      bot.sendMessage(chatId, "⚠️ 尚未设置USDT-TRC20地址。请使用 /usdt 命令设置。");
      return;
    }
    const address = config.value;
    // Lấy media mới nhất cho địa chỉ này
    const media = await UsdtMedia.findOne({ address }).sort({ createdAt: -1 });
    if (!media) {
      bot.sendMessage(chatId, "⚠️ 当前地址还没有配图！");
      return;
    }
    // Lấy danh sách username từ lệnh
    const parts = messageText.split(' ');
    if (parts.length < 2) {
      bot.sendMessage(chatId, "用法: /usdtxxn @用户名1 @用户名2 ...");
      return;
    }
    const usernames = parts.slice(1).filter(u => u.startsWith('@')).map(u => u.replace('@', ''));
    if (usernames.length === 0) {
      bot.sendMessage(chatId, "请至少输入一个用户名！");
      return;
    }
    // Xóa khỏi danh sách xác nhận
    let existed = media.confirmedBy || [];
    usernames.forEach(uname => {
      const idx = existed.findIndex(u => u.username === uname);
      if (idx !== -1) {
        existed.splice(idx, 1);
      }
    });
    media.confirmedBy = existed;
    await media.save();
    bot.sendMessage(chatId, `✅ 已移除确认人: ${usernames.map(u => '@' + u).join(', ')}\n当前确认人: ${existed.map(u => '@' + u.username).join(', ')}`);
  } catch (error) {
    console.error('Error in handleUsdtRemoveConfirmCommand:', error);
    bot.sendMessage(msg.chat.id, "处理 /usdtxxn 命令时出错，请稍后再试。");
  }
};

/**
 * Xử lý lệnh xóa toàn bộ thông tin USDT (/rmusdt)
 */
const handleRemoveUsdtCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    // Xóa Config USDT_ADDRESS
    await Config.deleteOne({ key: 'USDT_ADDRESS' });
    // Xóa toàn bộ UsdtMedia
    await UsdtMedia.deleteMany({});
    bot.sendMessage(chatId, '✅ 已清空所有USDT地址和配图信息！');
  } catch (error) {
    console.error('Error in handleRemoveUsdtCommand:', error);
    bot.sendMessage(msg.chat.id, '清空USDT信息时出错，请稍后再试。');
  }
};

module.exports = {
  handleListUsersCommand,
  handleCurrencyUnitCommand,
  handleSetUsdtAddressCommand,
  handleGetUsdtAddressCommand,
  handleSetOwnerCommand,
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
  handleInlineButtonCallback,
  displayInlineButtons,
  handleEnableButtonsCommand,
  handleDisableButtonsCommand,
  getButtonsStatus,
  getInlineKeyboard,
  handleAddInline2Command,
  handleRemoveInline2Command,
  handleButtons2Command,
  handleChatWithButtons2Command,
  handleUsdtConfirmCommand,
  handleUsdtRemoveConfirmCommand,
  handleRemoveUsdtCommand
}; 