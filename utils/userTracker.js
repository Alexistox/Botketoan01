const User = require('../models/User');

/**
 * Theo dõi và cập nhật thông tin user khi có thay đổi tên hoặc username
 */
class UserTracker {
  constructor() {
    // Cache để lưu thông tin user cũ để so sánh
    this.userCache = new Map();
  }

  /**
   * Kiểm tra và cập nhật thông tin user nếu có thay đổi
   */
  async checkAndUpdateUser(bot, msg) {
    try {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const currentFirstName = msg.from.first_name || '';
      const currentLastName = msg.from.last_name || '';
      const currentUsername = msg.from.username || '';
      
      // Tạo tên đầy đủ hiện tại
      const currentFullName = `${currentFirstName} ${currentLastName}`.trim();
      
      // Lấy thông tin user từ database
      let user = await User.findOne({ userId: userId.toString() });
      
      if (!user) {
        // Nếu user chưa tồn tại, tạo mới
        user = new User({
          userId: userId.toString(),
          firstName: currentFirstName,
          lastName: currentLastName,
          username: currentUsername,
          fullName: currentFullName,
          chatId: chatId.toString(),
          lastSeen: new Date()
        });
        await user.save();
        
        // Thêm vào cache
        this.userCache.set(`${chatId}-${userId}`, {
          firstName: currentFirstName,
          lastName: currentLastName,
          username: currentUsername,
          fullName: currentFullName
        });
        
        return null; // Không có thay đổi gì
      }
      
      // Lấy thông tin cũ từ cache hoặc database
      const cachedInfo = this.userCache.get(`${chatId}-${userId}`);
      const oldFirstName = cachedInfo ? cachedInfo.firstName : user.firstName;
      const oldLastName = cachedInfo ? cachedInfo.lastName : user.lastName;
      const oldUsername = cachedInfo ? cachedInfo.username : user.username;
      const oldFullName = cachedInfo ? cachedInfo.fullName : user.fullName;
      
      // Kiểm tra có thay đổi không
      const nameChanged = (currentFirstName !== oldFirstName) || (currentLastName !== oldLastName);
      const usernameChanged = currentUsername !== oldUsername;
      
      if (nameChanged || usernameChanged) {
        // Có thay đổi, cập nhật database
        user.firstName = currentFirstName;
        user.lastName = currentLastName;
        user.username = currentUsername;
        user.fullName = currentFullName;
        user.lastSeen = new Date();
        await user.save();
        
        // Cập nhật cache
        this.userCache.set(`${chatId}-${userId}`, {
          firstName: currentFirstName,
          lastName: currentLastName,
          username: currentUsername,
          fullName: currentFullName
        });
        
        // Tạo thông báo thay đổi
        const changeMessage = this.createChangeMessage(
          oldFullName, currentFullName,
          oldUsername, currentUsername,
          nameChanged, usernameChanged,
          userId
        );
        
        return {
          hasChanged: true,
          message: changeMessage,
          user: user
        };
      }
      
      // Cập nhật lastSeen
      user.lastSeen = new Date();
      await user.save();
      
      // Cập nhật cache
      this.userCache.set(`${chatId}-${userId}`, {
        firstName: currentFirstName,
        lastName: currentLastName,
        username: currentUsername,
        fullName: currentFullName
      });
      
      return null; // Không có thay đổi
      
    } catch (error) {
      console.error('Error in checkAndUpdateUser:', error);
      return null;
    }
  }

  /**
   * Tạo thông báo thay đổi thông tin user
   */
  createChangeMessage(oldFullName, newFullName, oldUsername, newUsername, nameChanged, usernameChanged, userId) {
    let message = `用户信息变更通知: ${userId}\n`;
    
    if (nameChanged) {
      message += `👤 姓名:`;
      message += `${oldFullName || '无'}=> `;
      message += `${newFullName || '无'}\n`;
    }
    
    if (usernameChanged) {
      message += `🏷️ 用户名:`;
      message += `${oldUsername ? '@' + oldUsername : '无'}=> `;
      message += `${newUsername ? '@' + newUsername : '无'}`;
    }
    
    
    return message;
  }

  /**
   * Làm sạch cache cho một chat cụ thể
   */
  clearCacheForChat(chatId) {
    const keysToDelete = [];
    for (const key of this.userCache.keys()) {
      if (key.startsWith(`${chatId}-`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.userCache.delete(key));
  }

  /**
   * Lấy thông tin user từ cache
   */
  getCachedUser(chatId, userId) {
    return this.userCache.get(`${chatId}-${userId}`);
  }
}

// Export singleton instance
module.exports = new UserTracker();
