const UsdtMedia = require('../models/UsdtMedia');
const GLOBAL_USDT_SCOPE = 'GLOBAL';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Xử lý lưu trữ và hiển thị media cho USDT
 */
class UsdtMediaHandler {
  /**
   * Lưu USDT address và media files
   */
  async saveUsdtMedia(chatId, usdtAddress, mediaFiles, senderId, senderName) {
    try {
      // Lưu global cho toàn bộ bot (không theo từng nhóm)
      let usdtMedia = await UsdtMedia.findOne({ 
        chatId: GLOBAL_USDT_SCOPE,
        isActive: true 
      });

      if (usdtMedia) {
        // Cập nhật USDT address và media files
        usdtMedia.usdtAddress = usdtAddress;
        usdtMedia.mediaFiles = mediaFiles;
        usdtMedia.senderId = senderId;
        usdtMedia.senderName = senderName;
        usdtMedia.createdAt = new Date();
      } else {
        // Tạo mới
        usdtMedia = new UsdtMedia({
          chatId: GLOBAL_USDT_SCOPE,
          usdtAddress: usdtAddress,
          mediaFiles: mediaFiles,
          senderId: senderId,
          senderName: senderName
        });
      }

      await usdtMedia.save();
      return usdtMedia;
    } catch (error) {
      console.error('Error saving USDT media:', error);
      throw error;
    }
  }

  /**
   * Lấy USDT media của chat
   */
  async getUsdtMedia(chatId) {
    try {
      // Ưu tiên bản global
      let usdtMedia = await UsdtMedia.findOne({
        chatId: GLOBAL_USDT_SCOPE,
        isActive: true 
      });
      if (!usdtMedia && chatId !== undefined && chatId !== null) {
        // Fallback dữ liệu cũ theo chat để không mất dữ liệu hiện có
        usdtMedia = await UsdtMedia.findOne({
          chatId: chatId.toString(),
          isActive: true
        });
      }
      return usdtMedia;
    } catch (error) {
      console.error('Error getting USDT media:', error);
      return null;
    }
  }

  /**
   * Xóa USDT media của chat
   */
  async clearUsdtMedia(chatId) {
    try {
      // Xóa cả global lẫn dữ liệu legacy theo chat (nếu có)
      await UsdtMedia.updateMany(
        {
          isActive: true,
          $or: [{ chatId: GLOBAL_USDT_SCOPE }, { chatId: chatId?.toString?.() || '' }]
        },
        { isActive: false }
      );
      return true;
    } catch (error) {
      console.error('Error clearing USDT media:', error);
      return false;
    }
  }

  /**
   * Gửi USDT media với caption
   */
  async sendUsdtMedia(bot, chatId, usdtMedia) {
    try {
      if (!usdtMedia || !usdtMedia.mediaFiles || usdtMedia.mediaFiles.length === 0) {
        return false;
      }

      // Gửi từng media để hỗ trợ chắc chắn photo/video/animation/document
      // và tránh giới hạn type khi sendMediaGroup.
      for (let i = 0; i < usdtMedia.mediaFiles.length; i += 1) {
        const mediaFile = usdtMedia.mediaFiles[i];
        const caption = i === 0 ? `<code>${escapeHtml(usdtMedia.usdtAddress)}</code>` : undefined;
        if (mediaFile.fileType === 'photo') {
          await bot.sendPhoto(chatId, mediaFile.fileId, caption ? { caption, parse_mode: 'HTML' } : {});
        } else if (mediaFile.fileType === 'video') {
          await bot.sendVideo(chatId, mediaFile.fileId, caption ? { caption, parse_mode: 'HTML' } : {});
        } else if (mediaFile.fileType === 'animation') {
          await bot.sendAnimation(chatId, mediaFile.fileId, caption ? { caption, parse_mode: 'HTML' } : {});
        } else if (mediaFile.fileType === 'document') {
          await bot.sendDocument(chatId, mediaFile.fileId, caption ? { caption, parse_mode: 'HTML' } : {});
        }
      }

      return true;
    } catch (error) {
      console.error('Error sending USDT media:', error);
      throw error;
    }
  }

  /**
   * Xử lý media từ message
   */
  processMediaFromMessage(msg) {
    const mediaFiles = [];

    // Xử lý ảnh
    if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1]; // Lấy ảnh chất lượng cao nhất
      mediaFiles.push({
        fileId: photo.file_id,
        fileType: 'photo',
        caption: msg.caption || '',
        messageId: msg.message_id
      });
    }

    // Xử lý video
    if (msg.video) {
      mediaFiles.push({
        fileId: msg.video.file_id,
        fileType: 'video',
        caption: msg.caption || '',
        messageId: msg.message_id
      });
    }

    // Xử lý animation (GIF)
    if (msg.animation) {
      mediaFiles.push({
        fileId: msg.animation.file_id,
        fileType: 'animation',
        caption: msg.caption || '',
        messageId: msg.message_id
      });
    }

    // Xử lý document
    if (msg.document) {
      mediaFiles.push({
        fileId: msg.document.file_id,
        fileType: 'document',
        caption: msg.caption || '',
        messageId: msg.message_id
      });
    }

    return mediaFiles;
  }

  /**
   * Kiểm tra xem message có chứa media không
   */
  hasMedia(msg) {
    return !!(msg.photo || msg.video || msg.animation || msg.document);
  }
}

module.exports = new UsdtMediaHandler();
