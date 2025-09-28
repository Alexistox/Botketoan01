const UsdtMedia = require('../models/UsdtMedia');

/**
 * Xử lý lưu trữ và hiển thị media cho USDT
 */
class UsdtMediaHandler {
  /**
   * Lưu USDT address và media files
   */
  async saveUsdtMedia(chatId, usdtAddress, mediaFiles, senderId, senderName) {
    try {
      // Tìm USDT media hiện tại của chat
      let usdtMedia = await UsdtMedia.findOne({ 
        chatId: chatId.toString(), 
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
          chatId: chatId.toString(),
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
      const usdtMedia = await UsdtMedia.findOne({ 
        chatId: chatId.toString(), 
        isActive: true 
      });
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
      await UsdtMedia.updateOne(
        { chatId: chatId.toString(), isActive: true },
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

      const mediaGroup = [];
      const caption = usdtMedia.usdtAddress;

      // Chuẩn bị media group
      for (const mediaFile of usdtMedia.mediaFiles) {
        const mediaItem = {
          type: mediaFile.fileType,
          media: mediaFile.fileId,
          caption: mediaFile.caption || ''
        };
        mediaGroup.push(mediaItem);
      }

      // Gửi media group với caption chính
      const result = await bot.sendMediaGroup(chatId, mediaGroup, {
        caption: caption
      });

      return result;
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
