const axios = require('axios');
const NodeCache = require('node-cache');

// Cache for file URLs (6 hours lifespan)
const fileCache = new NodeCache({ stdTTL: 21600 });

/**
 * Get direct download link for a file from Telegram
 * @param {string} fileId - Telegram file ID
 * @param {string} botToken - Telegram bot token
 * @returns {Promise<string>} - Direct download URL
 */
const getDownloadLink = async (fileId, botToken) => {
  try {
    // Check cache first
    const cachedUrl = fileCache.get(fileId);
    if (cachedUrl) return cachedUrl;

    // Get file path from Telegram
    const fileInfoUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const response = await axios.get(fileInfoUrl);

    if (response.data && response.data.ok && response.data.result.file_path) {
      const filePath = response.data.result.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

      // Cache the URL
      fileCache.set(fileId, downloadUrl);

      return downloadUrl;
    }

    throw new Error('Invalid response from Telegram API');
  } catch (error) {
    console.error('Error getting download link:', error.message);
    return '';
  }
};

/**
 * Log message to database (user + bot + sticker/media).
 * @param {Object} msg - Telegram message object
 * @param {string} botToken - Telegram bot token
 * @param {Object} MessageLog - Mongoose model for message logs
 * @param {{ forceBot?: boolean }} [options]
 */
const logMessage = async (msg, botToken, MessageLog, options = {}) => {
  try {
    if (!msg) return;

    // Extract basic message info
    const chat = msg.chat || {};
    const from = msg.from || {};
    const isBot = options.forceBot === true || !!from.is_bot;

    let content = msg.text || msg.caption || '';
    if (!content && msg.sticker) {
      content = msg.sticker.emoji ? `${msg.sticker.emoji} [sticker]` : '[sticker]';
    }
    if (!content && msg.animation) content = '[GIF]';
    if (!content && msg.photo) content = '[photo]';
    if (!content && msg.video) content = '[video]';
    if (!content && (msg.voice || msg.audio)) content = '[voice]';
    if (!content && msg.document) {
      content = msg.document.file_name
        ? `[file] ${msg.document.file_name}`
        : '[file]';
    }
    if (!content && msg.contact) content = '[contact]';
    if (!content && msg.location) content = '[location]';
    if (!content && msg.venue) content = '[venue]';
    if (!content && msg.poll) content = `[poll] ${msg.poll.question || ''}`.trim();
    if (!content && msg.new_chat_members) content = '[members joined]';
    if (!content && msg.left_chat_member) content = '[member left]';
    if (!content && msg.new_chat_title) content = `[title] ${msg.new_chat_title}`;
    if (!content && msg.pinned_message) content = '[pinned]';

    const messageLog = new MessageLog({
      groupName: chat.title || (chat.type === 'private' ? 'Private' : ''),
      chatId: chat.id != null ? String(chat.id) : '',
      chatType: chat.type || '',
      senderId: from.id != null ? String(from.id) : '',
      senderName:
        `${from.first_name || ''} ${from.last_name || ''}`.trim() ||
        (isBot ? 'Bot' : ''),
      username: from.username || '',
      timestamp: msg.date ? new Date(msg.date * 1000) : new Date(),
      content,
      isBot,
      messageId: msg.message_id != null ? String(msg.message_id) : ''
    });

    if (!messageLog.chatId) return;

    // Handle photo
    if (msg.photo && msg.photo.length > 0) {
      const photoFileId = msg.photo[msg.photo.length - 1].file_id;
      messageLog.photoFileId = photoFileId;
      messageLog.photoUrl = await getDownloadLink(photoFileId, botToken);
    }

    // Handle video
    if (msg.video) {
      messageLog.videoFileId = msg.video.file_id;
      messageLog.videoUrl = await getDownloadLink(msg.video.file_id, botToken);
    }

    // Handle voice / audio
    if (msg.voice) {
      messageLog.voiceFileId = msg.voice.file_id;
      messageLog.voiceUrl = await getDownloadLink(msg.voice.file_id, botToken);
    } else if (msg.audio) {
      messageLog.voiceFileId = msg.audio.file_id;
      messageLog.voiceUrl = await getDownloadLink(msg.audio.file_id, botToken);
    }

    // Handle document
    if (msg.document) {
      messageLog.documentFileId = msg.document.file_id;
      messageLog.documentUrl = await getDownloadLink(msg.document.file_id, botToken);
    }

    // Handle sticker (static webp / thumb; animated still shows thumb if any)
    if (msg.sticker) {
      const thumbId =
        (msg.sticker.thumbnail && msg.sticker.thumbnail.file_id) ||
        (msg.sticker.thumb && msg.sticker.thumb.file_id) ||
        null;
      const fileId = thumbId || msg.sticker.file_id;
      messageLog.stickerFileId = msg.sticker.file_id || fileId;
      messageLog.stickerUrl = await getDownloadLink(fileId, botToken);
    }

    // Handle animation / GIF
    if (msg.animation) {
      messageLog.animationFileId = msg.animation.file_id;
      messageLog.animationUrl = await getDownloadLink(
        msg.animation.file_id,
        botToken
      );
    }

    await messageLog.save();
  } catch (error) {
    console.error('Error logging message:', error);
  }
};

module.exports = {
  getDownloadLink,
  logMessage
};
