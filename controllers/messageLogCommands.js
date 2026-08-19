const crypto = require('crypto');
const MessageLog = require('../models/MessageLog');
const MessageLogsAuth = require('../models/MessageLogsAuth');
const { isUserAdmin, isUserOwner } = require('../utils/permissions');

function getBaseUrl() {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, '');
  }
  if (process.env.HEROKU_APP_NAME) {
    return `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
  }
  // Production VPS mặc định
  return 'http://159.223.49.204:3001';
}

/**
 * /messagelogs — Admin/Owner: tạo token 24h và gửi link dashboard
 */
const handleMessageLogsCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    if (!(await isUserAdmin(userId)) && !(await isUserOwner(userId))) {
      bot.sendMessage(chatId, '❌ Chỉ Admin/Owner mới dùng được lệnh này.');
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await MessageLogsAuth.findOneAndUpdate(
      { key: 'default' },
      { token, tokenExpiry },
      { upsert: true, new: true }
    );

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/messagelogs?token=${token}`;

    const groupCount = (await MessageLog.distinct('chatId')).length;
    const messageCount = await MessageLog.countDocuments();

    const message =
      `📋 *Message Logs Dashboard*\n\n` +
      `🔗 Link: ${url}\n` +
      `👥 Số nhóm/chat: ${groupCount}\n` +
      `💬 Tổng tin đã ghi: ${messageCount}\n` +
      `⏰ Link có hiệu lực: 24 giờ\n` +
      `🔒 Chỉ người có link mới xem được`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in handleMessageLogsCommand:', error);
    bot.sendMessage(msg.chat.id, '❌ Lỗi khi tạo link Message Logs. Thử lại sau.');
  }
};

module.exports = {
  handleMessageLogsCommand,
  getBaseUrl
};
