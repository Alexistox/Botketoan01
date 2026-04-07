const { parseSpecialNumber } = require('./formatter');

/**
 * Trích xuất số tiền từ text
 * @param {string} text - Text cần phân tích
 * @returns {Number|null} - Số tiền trích xuất được hoặc null nếu thất bại
 */
const extractMoneyFromText = (text) => {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Loại bỏ các ký tự không cần thiết và chuẩn hóa text
  const cleanText = text.trim();
  
  // Các pattern để tìm số tiền (hỗ trợ đa định dạng số)
  const patterns = [
    // Biên lai tiếng Trung: "- 入款: +600,000 đ"
    /(?:^|\n)\s*[-–•]?\s*入款\s*[:：]\s*\+?\s*(\d{1,3}(?:[,.]\d{3})*(?:\.\d{1,2})?)\s*(?:đ|vnd|vnđ)\b/gi,

    // Pattern cao ưu tiên cho "SỐ TIỀN GIAO DỊCH" và các từ khóa chính xác
    /(?:số tiền giao dịch|số tiền|amount|total|transaction amount|金额)\s*[:\-：]?\s*(\d{1,3}(?:[,]\d{3})+(?:\.\d{1,2})?)\s*(?:vnd|vnđ|đ|usd|usdt)/gi,
    
    // Số có đơn vị tiền tệ (ưu tiên số lớn có nhiều dấu phẩy)
    /(\d{1,3}(?:[,]\d{3}){2,}(?:\.\d{1,2})?)\s*(?:usdt|usd|vnd|vnđ|đ|dollars?|dollar|yuan|rmb|元)/gi,
    
    // Số có đơn vị tiền tệ (định dạng Châu Âu)
    /(\d{1,3}(?:[.]\d{3}){2,}(?:,\d{1,2})?)\s*(?:usdt|usd|vnd|vnđ|đ|eur|euros?|euro)/gi,
    
    // Số có đơn vị tiền tệ (hỗ trợ định dạng khác)
    /(\d{1,3}(?:[,.]?\d{3})*(?:[,.]?\d{1,2})?)\s*(?:usdt|usd|vnd|vnđ|đ|dollars?|dollar|bucks|us\$|us dollars|元|人民币|rmb|원|won|円|yen|บาท|baht|aud|au\$|krw|jpy|thb)/gi,
    
    // Số có ký hiệu tiền tệ phía trước
    /[đ$¥€£￥₩฿]\s*(\d{1,3}(?:[,.]?\d{3})*(?:[,.]?\d{1,2})?)/gi,
    
    // Số có từ khóa liên quan đến tiền với độ ưu tiên cao hơn
    /(?:số tiền|amount|money|tiền|total|tổng|transfer|chuyển|payment|thanh toán|收款|余额|balance|金额|钱|转账|付款|总计|金钱|支付|汇款)\s*[:\-：]?\s*(\d{1,3}(?:[,]\d{3})+(?:\.\d{1,2})?)/gi,
    
    // Số lớn có dấu phân cách (định dạng Mỹ: 1,000,000 hoặc Châu Âu: 1.000.000)
    /(\d{1,3}(?:[,]\d{3}){2,}(?:\.\d{1,2})?|\d{1,3}(?:[.]\d{3}){2,}(?:,\d{1,2})?)/g,
    
    // Các số đơn giản lớn (ít nhất 6 chữ số để tránh nhận dạng sai)
    /\b(\d{6,}(?:[,.]?\d{1,2})?)\b/g
  ];

  const foundNumbers = [];

  // Tìm tất cả các số phù hợp với patterns
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const matches = cleanText.match(pattern);
    
    if (matches) {
      for (const match of matches) {
        // Trích xuất số từ match
        const numberMatch = match.match(/(\d+(?:[,.]?\d{3})*(?:[,.]?\d{1,2})?)/);
        if (numberMatch) {
          const numberStr = numberMatch[1];
          
          // Sử dụng function parseSpecialNumber để xử lý tất cả định dạng số
          const num = parseSpecialNumber(numberStr);
          if (!isNaN(num) && num > 0) {
            foundNumbers.push({
              value: num,
              original: numberStr,
              priority: i // Pattern có index thấp hơn có độ ưu tiên cao hơn
            });
          }
        }
      }
    }
  }

  if (foundNumbers.length === 0) {
    return null;
  }

  // Sắp xếp theo độ ưu tiên (pattern index thấp hơn có độ ưu tiên cao hơn)
  // Sau đó theo giá trị lớn hơn
  foundNumbers.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.value - a.value;
  });

  return foundNumbers[0].value;
};

/**
 * Trích xuất số tiền từ thông báo ngân hàng (ưu tiên "tiền vào" thay vì "số dư")
 * @param {string} text - Text thông báo ngân hàng
 * @returns {Number|null} - Số tiền trích xuất được hoặc null nếu thất bại
 */
const extractMoneyFromBankNotification = (text) => {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const cleanText = text.trim();
  const foundNumbers = [];

  // Patterns ưu tiên cao cho "tiền vào/nhận" (tránh "số dư")
  const highPriorityPatterns = [
    // Biên lai: đầu dòng "- 入款: +600,000 đ" / "入款：600.000 đ"
    /(?:^|\n)\s*[-–•]?\s*入款\s*[:：]\s*\+?\s*(\d{1,3}(?:[,.]\d{3})*(?:\.\d{1,2})?)\s*(?:đ|vnd|vnđ)\b/gi,

    // Tiền vào với dấu + (VN)
    /(?:tiền vào|tiền nhận|tiền đến|nhận tiền|tiền chuyển đến|tiền chuyển vào|credited|received|deposit|income|incoming)\s*[:\-]?\s*\+?\s*(\d{1,3}(?:[,.]?\d{3})*(?:\.\d{1,2})?)\s*(?:đ|vnd|vnđ|usd|usdt|dollars?)/gi,
    
    // Format với dấu + đầu tin nhắn
    /^\s*\+\s*(\d{1,3}(?:[,.]?\d{3})*(?:\.\d{1,2})?)\s*(?:đ|vnd|vnđ|usd|usdt|dollars?)/gi,
    
    // Tiền vào tiếng Trung (入账 / 入款 + VND hoặc CNY)
    /(?:入账|入款|收款|到账|转入|存入)\s*[:\-]?\s*\+?\s*(\d{1,3}(?:[,.]?\d{3})*(?:\.\d{1,2})?)\s*(?:元|人民币|rmb|usd|usdt|đ|vnd|vnđ)\b/gi,
    
    // Credit/Deposit trong tiếng Anh
    /(?:credited with|received|deposit of|incoming)\s*[:\-]?\s*\$?\s*(\d{1,3}(?:[,.]?\d{3})*(?:\.\d{1,2})?)/gi
  ];

  // Tìm trong patterns ưu tiên cao trước
  for (let i = 0; i < highPriorityPatterns.length; i++) {
    const pattern = highPriorityPatterns[i];
    const matches = cleanText.match(pattern);
    
    if (matches) {
      for (const match of matches) {
        const numberMatch = match.match(/(\d{1,3}(?:[,.]?\d{3})*(?:\.\d{1,2})?)/);
        if (numberMatch) {
          const numberStr = numberMatch[1];
          
          // Sử dụng function parseSpecialNumber để xử lý tất cả định dạng số
          const num = parseSpecialNumber(numberStr);
          if (!isNaN(num) && num > 0) {
            foundNumbers.push({
              value: num,
              original: numberStr,
              priority: i, // Ưu tiên cao nhất
              isHighPriority: true
            });
          }
        }
      }
    }
  }

  // Nếu tìm thấy trong patterns ưu tiên cao, trả về ngay
  if (foundNumbers.length > 0) {
    foundNumbers.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.value - a.value;
    });
    return foundNumbers[0].value;
  }

  // Nếu không tìm thấy, dùng patterns thông thường nhưng tránh "số dư"
  const regularPatterns = [
    // Số có đơn vị tiền tệ (loại bỏ context số dư)
    /(\d{1,3}(?:[,.]?\d{3})*(?:\.\d{1,2})?)\s*(?:usdt|usd|vnd|vnđ|đ|dollars?|dollar|yuan|rmb|元)/gi,
    
    // Số có ký hiệu tiền tệ phía trước
    /[đ$¥€£￥₩฿]\s*(\d{1,3}(?:[,.]?\d{3})*(?:\.\d{1,2})?)/gi,
    
    // Số có từ khóa tiền NHƯNG KHÔNG phải số dư
    /(?:số tiền|amount|money|tiền|transfer|chuyển|payment|thanh toán|收款|金额|钱|转账|付款|支付|汇款)\s*[:\-：]?\s*(\d+(?:[,.]?\d{3})*(?:\.\d{1,2})?)/gi,
    
    // Số lớn có dấu phân cách
    /(\d{1,3}(?:[,]\d{3}){2,}|\d{1,3}(?:[.]\d{3}){2,})/g
  ];

  // Tìm trong patterns thông thường
  for (let i = 0; i < regularPatterns.length; i++) {
    const pattern = regularPatterns[i];
    const matches = cleanText.match(pattern);
    
    if (matches) {
      for (const match of matches) {
        // Kiểm tra xem context có phải là số dư không
        const contextStart = Math.max(0, cleanText.indexOf(match) - 20);
        const contextEnd = Math.min(cleanText.length, cleanText.indexOf(match) + match.length + 20);
        const context = cleanText.substring(contextStart, contextEnd).toLowerCase();
        
        // Bỏ qua nếu context chứa từ khóa số dư
        if (context.includes('số dư') || context.includes('balance') || context.includes('余额') || context.includes('available')) {
          continue;
        }
        
        const numberMatch = match.match(/(\d{1,3}(?:[,.]?\d{3})*(?:[,.]?\d{1,2})?)/);
        if (numberMatch) {
          const numberStr = numberMatch[1];
          
          // Sử dụng function parseSpecialNumber để xử lý tất cả định dạng số
          const num = parseSpecialNumber(numberStr);
          if (!isNaN(num) && num > 0) {
            foundNumbers.push({
              value: num,
              original: numberStr,
              priority: i + 100, // Ưu tiên thấp hơn
              isHighPriority: false
            });
          }
        }
      }
    }
  }

  if (foundNumbers.length === 0) {
    return null;
  }

  // Sắp xếp theo độ ưu tiên
  foundNumbers.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.value - a.value;
  });

  return foundNumbers[0].value;
};

/**
 * Kiểm tra xem text có chứa số tiền không
 * @param {string} text - Text cần kiểm tra
 * @returns {boolean} - True nếu có số tiền
 */
const hasMoneyInText = (text) => {
  return extractMoneyFromText(text) !== null;
};

module.exports = {
  extractMoneyFromText,
  extractMoneyFromBankNotification,
  hasMoneyInText
}; 