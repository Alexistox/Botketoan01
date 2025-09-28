const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  isOwner: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  allowedGroups: {
    type: [String],
    default: []
  },
  firstName: {
    type: String,
    default: ''
  },
  lastName: {
    type: String,
    default: ''
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  groupPermissions: [{
    chatId: String,
    isOperator: { type: Boolean, default: false },
    numberFormat: {
      type: String,
      enum: ['default', 'formatted'],
      default: 'default'
    }
  }]
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

module.exports = User;

// Kiểm tra quyền Owner
const isUserOwner = async (userId) => {
  const user = await User.findOne({ userId: userId.toString() });
  return user && user.isOwner;
};

// Kiểm tra quyền Admin
const isUserAdmin = async (userId) => {
  const user = await User.findOne({ userId: userId.toString() });
  return (user && user.isAdmin) || (user && user.isOwner);
};

// Kiểm tra quyền Operator trong nhóm cụ thể
const isUserOperator = async (userId, chatId) => {
  // Kiểm tra Owner và Admin (có quyền toàn hệ thống)
  if (await isUserAdmin(userId)) return true;
  
  // Kiểm tra Operator trong nhóm
  const group = await Group.findOne({ chatId: chatId.toString() });
  if (group && group.operators) {
    return group.operators.some(op => op.userId === userId.toString());
  }
  
  return false;
};

// Hàm kiểm tra phân quyền tổng quát
const checkPermission = async (userId, chatId, permissionLevel) => {
  switch(permissionLevel) {
    case 'owner':
      return await isUserOwner(userId);
    case 'admin':
      return await isUserAdmin(userId);
    case 'operator':
      return await isUserOperator(userId, chatId);
    case 'user':
      return true; // Tất cả đều là user
    default:
      return false;
  }
};

// Thêm Admin (chỉ Owner có quyền)
const handleAddAdminCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const messageText = msg.text;
  
  // Chỉ Owner mới có quyền thêm Admin
  if (!await isUserOwner(userId)) {
    bot.sendMessage(chatId, "⛔ 只有机器人所有者才能添加管理员");
    return;
  }
  
  // Phân tích username hoặc ID người dùng
  const parts = messageText.split('/addadmin ');
  if (parts.length !== 2) {
    bot.sendMessage(chatId, "语法无效。例如: /addadmin @username 或 /addadmin 123456789");
    return;
  }
  
  const targetUser = await extractUserFromCommand(parts[1]);
  if (!targetUser) {
    bot.sendMessage(chatId, "未找到用户。请确保用户名或ID正确。");
    return;
  }
  
  // Cập nhật quyền Admin
  targetUser.isAdmin = true;
  await targetUser.save();
  
  bot.sendMessage(chatId, `✅ 用户 ${targetUser.username || targetUser.userId} 已被设置为管理员`);
};

// Thêm Operator (Owner và Admin có quyền)
const handleAddOperatorCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name;
  const messageText = msg.text;
  
  // Chỉ Owner và Admin có quyền thêm Operator
  if (!await isUserAdmin(userId)) {
    bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能添加操作员");
    return;
  }
  
  // Phân tích username hoặc ID người dùng
  const parts = messageText.split('加操作人 ');
  if (parts.length !== 2) {
    bot.sendMessage(chatId, "语法无效。例如: 加操作人 @username 或 加操作人 123456789");
    return;
  }
  
  const targetUser = await extractUserFromCommand(parts[1]);
  if (!targetUser) {
    bot.sendMessage(chatId, "未找到用户。请确保用户名或ID正确。");
    return;
  }
  
  // Tìm nhóm hiện tại
  let group = await Group.findOne({ chatId: chatId.toString() });
  if (!group) {
    group = new Group({
      chatId: chatId.toString(),
      operators: []
    });
  }
  
  // Kiểm tra người dùng đã là operator chưa
  const existingOperator = group.operators.find(op => op.userId === targetUser.userId);
  if (existingOperator) {
    bot.sendMessage(chatId, `用户 ${targetUser.username || targetUser.userId} 已经是操作员`);
    return;
  }
  
  // Thêm người dùng vào danh sách operator
  group.operators.push({
    userId: targetUser.userId,
    username: targetUser.username || targetUser.firstName,
    addedBy: username,
    addedAt: new Date()
  });
  
  await group.save();
  
  // Cập nhật quyền trong user document
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
  
  bot.sendMessage(chatId, `✅ 用户 ${targetUser.username || targetUser.userId} 已被添加为此群组的操作员`);
};

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
        isOwner: isFirstUser,
        isAdmin: isFirstUser,
        groupPermissions: []
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

// Phân loại các lệnh theo cấp độ quyền
const commandPermissions = {
  // Owner commands
  '/setowner': 'owner',
  '/addadmin': 'owner',
  '/removeadmin': 'owner',
  
  // Admin commands
  '/usdt': 'admin',
  '/migrate': 'admin',
  
  // Operator commands
  '设置费率': 'operator',
  '设置汇率': 'operator',
  '下发': 'operator',
  '上课': 'operator',
  '+': 'operator',
  '-': 'operator',
  '/x': 'operator',
  '/sx': 'operator',
  '/delete': 'operator',
  '/d': 'operator',
  '/qr': 'operator',
  '/hiddenCards': 'operator',
  '/m': 'operator',
  
  // User commands - anyone can use
  '/t': 'user',
  '/v': 'user',
  '/u': 'user',
  '/help': 'user',
  '/start': 'user',
  '/off': 'user',
  '/report': 'user',
  '结束': 'user'
};

// Hàm xử lý tin nhắn với kiểm tra quyền
const handleMessage = async (bot, msg, cache) => {
  try {
    // ... code hiện tại ...
    
    // Kiểm tra quyền cho các lệnh
    let command = '';
    let requiredPermission = 'user';
    
    if (messageText.startsWith('/')) {
      // Lấy phần lệnh (ví dụ: "/usdt" từ "/usdt address")
      command = messageText.split(' ')[0];
      requiredPermission = commandPermissions[command] || 'operator';
    } else if (messageText.startsWith('+') || messageText.startsWith('-')) {
      // Lệnh + hoặc -
      command = messageText[0];
      requiredPermission = commandPermissions[command] || 'operator';
    } else {
      // Lệnh tiếng Trung
      for (const cmd of Object.keys(commandPermissions)) {
        if (messageText.startsWith(cmd)) {
          command = cmd;
          requiredPermission = commandPermissions[cmd];
          break;
        }
      }
    }
    
    // Kiểm tra quyền nếu không phải lệnh dành cho user
    if (requiredPermission !== 'user' && !await checkPermission(userId, chatId, requiredPermission)) {
      const permissionMessages = {
        'owner': '⛔ 只有机器人所有者才能使用此命令',
        'admin': '⛔ 只有管理员才能使用此命令',
        'operator': '⛔ 只有操作员才能使用此命令'
      };
      
      bot.sendMessage(chatId, permissionMessages[requiredPermission]);
      return;
    }
    
    // Tiếp tục xử lý tin nhắn như hiện tại
    // ...
  } catch (error) {
    console.error('Error in handleMessage:', error);
  }
};

// Liệt kê admins
const handleListAdminsCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  const admins = await User.find({ isAdmin: true });
  if (!admins || admins.length === 0) {
    bot.sendMessage(chatId, "没有管理员");
    return;
  }
  
  let message = "📊 *管理员列表*\n\n";
  admins.forEach((admin, index) => {
    message += `${index + 1}. ${admin.username || admin.firstName}: ${admin.userId}${admin.isOwner ? ' (所有者)' : ''}\n`;
  });
  
  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
};

// Liệt kê operators trong nhóm
const handleListOperatorsCommand = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  const group = await Group.findOne({ chatId: chatId.toString() });
  if (!group || !group.operators || group.operators.length === 0) {
    bot.sendMessage(chatId, "此群组没有操作员");
    return;
  }
  
  let message = "📊 *此群组的操作员列表*\n\n";
  group.operators.forEach((operator, index) => {
    message += `${index + 1}. ${operator.username}: ${operator.userId}\n`;
  });
  
  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}; 