const axios = require('axios');
const { findBankCode } = require('../utils/bankMapping');
const { parseSpecialNumber, formatSmart } = require('../utils/formatter');
const { parseBankInfoFromLabels } = require('../utils/qrBankKeywords');

/**
 * Xử lý lệnh bật/tắt chức năng QR (/qr on/off)
 */
const handleQrToggleCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Trích xuất tham số
    const param = messageText.substring(4).trim().toLowerCase();
    
    if (param === 'on') {
      // Lưu vào in-memory storage
      qrModeStorage.set(chatId, true);
      
      // Cố gắng lưu vào database (không bắt lỗi)
      try {
        const Config = require('../models/Config');
        let qrConfig = await Config.findOne({ key: `QR_MODE_${chatId}` });
        if (!qrConfig) {
          qrConfig = new Config({
            key: `QR_MODE_${chatId}`,
            value: 'true'
          });
        } else {
          qrConfig.value = 'true';
        }
        await qrConfig.save();
      } catch (dbError) {
        console.log('Database save failed, using in-memory storage only');
      }
      
      bot.sendMessage(chatId, "✅ QR模式已开启！现在可以发送银行信息来生成QR码。\n\n格式：\n账号\n持卡人姓名\n银行名称\n金额\n备注（可选）");
      
    } else if (param === 'off') {
      // Lưu vào in-memory storage
      qrModeStorage.set(chatId, false);
      
      // Cố gắng lưu vào database (không bắt lỗi)
      try {
        const Config = require('../models/Config');
        let qrConfig = await Config.findOne({ key: `QR_MODE_${chatId}` });
        if (!qrConfig) {
          qrConfig = new Config({
            key: `QR_MODE_${chatId}`,
            value: 'false'
          });
        } else {
          qrConfig.value = 'false';
        }
        await qrConfig.save();
      } catch (dbError) {
        console.log('Database save failed, using in-memory storage only');
      }
      
      bot.sendMessage(chatId, "❌ QR模式已关闭");
      
    } else {
      bot.sendMessage(chatId, "语法无效。使用 /qr on 开启QR模式，/qr off 关闭QR模式");
    }
    
  } catch (error) {
    console.error('Error in handleQrToggleCommand:', error);
    bot.sendMessage(msg.chat.id, "处理QR命令时出错。请稍后再试。");
  }
};

// In-memory storage for QR mode (temporary solution)
const qrModeStorage = new Map();

/**
 * Kiểm tra xem QR mode có được bật không
 */
const isQrModeEnabled = async (chatId) => {
  try {
    // First check in-memory storage
    if (qrModeStorage.has(chatId)) {
      return qrModeStorage.get(chatId);
    }
    
    // Fallback to database with timeout
    const Config = require('../models/Config');
    const qrConfig = await Promise.race([
      Config.findOne({ key: `QR_MODE_${chatId}` }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 3000))
    ]);
    
    const isEnabled = qrConfig ? qrConfig.value === 'true' : false;
    qrModeStorage.set(chatId, isEnabled);
    return isEnabled;
  } catch (error) {
    console.error('Error checking QR mode:', error.message);
    return false;
  }
};

/**
 * Parse thông tin ngân hàng — heuristic theo dòng (không có nhãn key:value)
 */
const parseBankInfoHeuristic = (messageText) => {
  const lines = messageText.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length < 3) {
    return null;
  }
  
  let accountNumber = '';
  let accountName = '';
  let bankName = '';
  let amount = 0;
  let note = '';

  const isStkLabeledLine = (line) =>
    /^(stk|số\s*tk|so\s*tk|số\s*tài\s*khoản|so\s*tai\s*khoan)\s+/i.test(line);

  // Bước 1a: STK từ dòng "stk 2349785" (tránh lấy số tiền làm STK)
  for (const line of lines) {
    const m = line.match(/^(stk|số\s*tk|so\s*tk|số\s*tài\s*khoản|so\s*tai\s*khoan)\s+(.+)$/i);
    if (!m) continue;
    const digits = m[2].replace(/\D/g, '');
    if (digits.length >= 6 && digits.length <= 16) {
      accountNumber = digits;
      break;
    }
  }

  // Bước 1b: Dòng chỉ chứa số (fallback)
  if (!accountNumber) {
    for (const line of lines) {
      if (/^\d{6,16}$/.test(line)) {
        accountNumber = line;
        break;
      }
    }
  }
  
  // Bước 2: Tìm tên ngân hàng
  for (const line of lines) {
    const foundBankCode = findBankCode(line);
    if (foundBankCode) {
      bankName = line;
      break;
    }
  }
  
  // Bước 3: Tìm số tiền (chứa số và có thể có dấu phẩy/chấm, nhưng không phải số tài khoản)
  for (const line of lines) {
    if (line === accountNumber) continue; // Bỏ qua số tài khoản
    if (isStkLabeledLine(line)) continue; // Không lấy "stk ..." làm số tiền

    // Kiểm tra xem có phải số tiền không (có chứa dấu phẩy, chấm, hoặc ký tự đặc biệt)
    if (/[,\d]/.test(line) && !/^\d{6,16}$/.test(line)) {
      const parsedAmount = parseSpecialNumber(line);
      if (!isNaN(parsedAmount) && parsedAmount > 0) {
        amount = parsedAmount;
        break;
      }
    }
  }
  
  // Bước 4: Tìm tên chủ tài khoản và ghi chú
  const remainingLines = lines.filter(line => {
    if (line === accountNumber || line === bankName) return false;
    if (isStkLabeledLine(line)) return false;

    // Kiểm tra xem có phải số tiền không
    if (/[,\d]/.test(line) && !/^\d{6,16}$/.test(line)) {
      const parsedAmount = parseSpecialNumber(line);
      if (!isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount === amount) {
        return false;
      }
    }
    
    return true;
  });
  
  if (remainingLines.length > 0) {
    accountName = remainingLines[0];
    if (remainingLines.length > 1) {
      note = remainingLines.slice(1).join(' ');
    }
  }
  
  // Kiểm tra xem có đủ thông tin cơ bản không
  if (!accountNumber || !accountName || !bankName) {
    return null;
  }
  
  return {
    accountNumber,
    accountName,
    bankName,
    amount,
    note
  };
};

/**
 * Parse thông tin ngân hàng: ưu tiên nhãn key:value đa ngôn ngữ, sau đó heuristic theo dòng.
 */
const parseBankInfo = (messageText) => {
  const fromLabels = parseBankInfoFromLabels(messageText);
  if (fromLabels) {
    return fromLabels;
  }
  return parseBankInfoHeuristic(messageText);
};

/**
 * Tạo mã QR từ thông tin ngân hàng sử dụng VietQR API
 */
const generateQRCode = async (bankInfo) => {
  try {
    // Tìm mã bank code
    const bankCode = findBankCode(bankInfo.bankName);
    
    if (!bankCode) {
      throw new Error(`Không tìm thấy mã ngân hàng cho: ${bankInfo.bankName}`);
    }
    
    // Tạo URL VietQR API
    let vietqrUrl = `https://img.vietqr.io/image/${bankCode}-${bankInfo.accountNumber}-compact2.jpg`;
    
    // Thêm tham số amount nếu có
    if (bankInfo.amount > 0) {
      vietqrUrl += `?amount=${bankInfo.amount}`;
      
      // Thêm thông tin bổ sung nếu có
      if (bankInfo.note) {
        const encodedNote = encodeURIComponent(bankInfo.note);
        const encodedAccountName = encodeURIComponent(bankInfo.accountName);
        vietqrUrl += `&addInfo=${encodedNote}&accountName=${encodedAccountName}`;
      } else {
        const encodedAccountName = encodeURIComponent(bankInfo.accountName);
        vietqrUrl += `&accountName=${encodedAccountName}`;
      }
    } else {
      // Nếu không có amount, vẫn thêm accountName
      const encodedAccountName = encodeURIComponent(bankInfo.accountName);
      vietqrUrl += `?accountName=${encodedAccountName}`;
      
      if (bankInfo.note) {
        const encodedNote = encodeURIComponent(bankInfo.note);
        vietqrUrl += `&addInfo=${encodedNote}`;
      }
    }
    
    // Tải ảnh QR từ VietQR API
    const response = await axios.get(vietqrUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    const qrCodeBuffer = Buffer.from(response.data);
    
    // Tạo nội dung QR theo định dạng VietQR (để hiển thị)
    let qrContent = `${bankCode}|${bankInfo.accountNumber}|${bankInfo.accountName}`;
    
    if (bankInfo.amount > 0) {
      qrContent += `|${bankInfo.amount}`;
      
      if (bankInfo.note) {
        qrContent += `|${bankInfo.note}`;
      }
    } else if (bankInfo.note) {
      qrContent += `||${bankInfo.note}`;
    }
    
    return {
      qrCodeBuffer,
      qrContent,
      bankCode,
      bankName: bankInfo.bankName,
      vietqrUrl
    };
    
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

/**
 * Xử lý tin nhắn QR
 */
const handleQrMessage = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    console.log('🔍 Checking QR message:', messageText);
    
    // Kiểm tra QR mode có được bật không
    const isQrEnabled = await isQrModeEnabled(chatId);
    console.log('QR mode enabled for chat', chatId, ':', isQrEnabled);
    
    if (!isQrEnabled) {
      return false;
    }
    
    // Parse thông tin ngân hàng
    const bankInfo = parseBankInfo(messageText);
    if (!bankInfo) {
      return false;
    }
    
    // Tạo QR code
    const qrResult = await generateQRCode(bankInfo);
    
     // Tạo caption cho ảnh QR
     let caption = '';
     
     if (bankInfo.note) {
       caption = `📝 *${bankInfo.note}*`;
     }
    
    
    // Gửi QR code với reply vào tin nhắn gốc
    await bot.sendPhoto(chatId, qrResult.qrCodeBuffer, {
      caption: caption,
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id
    }, {
      filename: 'qrcode.png',
      contentType: 'image/png'
    });
    
    return true;
    
  } catch (error) {
    console.error('Error in handleQrMessage:', error);
    
    if (error.message.includes('Không tìm thấy mã ngân hàng')) {
      bot.sendMessage(msg.chat.id, `❌ 无法识别银行名称: ${error.message.split(': ')[1]}\n\n请检查银行名称是否正确。`);
    } else {
      bot.sendMessage(msg.chat.id, "❌ 生成QR码时出错。请检查信息格式是否正确。");
    }
    
    return true; // Đã xử lý tin nhắn
  }
};

module.exports = {
  handleQrToggleCommand,
  isQrModeEnabled,
  handleQrMessage,
  parseBankInfo,
  parseBankInfoHeuristic,
  generateQRCode
};
