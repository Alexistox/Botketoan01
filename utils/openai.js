const axios = require('axios');
const { Readable } = require('stream');

/**
 * Trích xuất thông tin ngân hàng từ ảnh sử dụng OpenAI API
 * @param {Buffer} imageBuffer - Buffer chứa dữ liệu ảnh
 * @returns {Object|null} - Thông tin ngân hàng trích xuất được hoặc null nếu thất bại
 */
const extractBankInfoFromImage = async (imageBuffer) => {
  try {
    // Chuyển đổi buffer ảnh thành base64
    const base64Image = imageBuffer.toString('base64');
    const base64Url = `data:image/jpeg;base64,${base64Image}`;
    
    // Chuẩn bị prompt để gửi đến OpenAI
    const prompt = "Trích xuất thông tin tài khoản ngân hàng từ hình ảnh này. Hãy xác định: tên ngân hàng (ngôn ngữ gốc), tên ngân hàng bằng tiếng Anh, số tài khoản, và tên chủ tài khoản. Trả về kết quả dưới dạng JSON với các trường: bankName, bankNameEnglish, accountNumber, accountName. Nếu không tìm thấy thông tin, hãy trả về trường đó là null.";
    
    // Tạo yêu cầu gửi đến OpenAI API
    const openAiUrl = "https://api.openai.com/v1/chat/completions";
    const requestBody = {
      "model": "gpt-4o", // Sử dụng GPT-4 Vision
      "messages": [
        {
          "role": "user",
          "content": [
            {"type": "text", "text": prompt},
            {
              "type": "image_url",
              "image_url": {
                "url": base64Url
              }
            }
          ]
        }
      ],
      "max_tokens": 300
    };
    
    const options = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    };
    
    // Gửi yêu cầu đến OpenAI API
    const response = await axios.post(openAiUrl, requestBody, options);
    
    // Kiểm tra phản hồi từ API
    if (!response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      console.error('Invalid response from OpenAI API');
      return null;
    }
    
    // Phân tích kết quả từ OpenAI
    const content = response.data.choices[0].message.content;
    
    try {
      // Tìm đoạn JSON trong phản hồi
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const bankInfo = JSON.parse(jsonStr);
        return bankInfo;
      } else {
        // Nếu không tìm thấy JSON, tạo đối tượng và trích xuất thông tin bằng cách phân tích văn bản
        const bankInfo = {
          bankName: null,
          bankNameEnglish: null,
          accountNumber: null,
          accountName: null
        };
        
        // Tìm thông tin ngân hàng từ văn bản
        if (content.includes("银行") || content.includes("bank")) {
          const bankMatch = content.match(/(?:ngân hàng|bank)[:\s]+([^\n.,]+)/i);
          if (bankMatch) bankInfo.bankName = bankMatch[1].trim();
        }
        
        // Tìm tên ngân hàng tiếng Anh
        if (content.includes("英文") || content.includes("English")) {
          const bankEnglishMatch = content.match(/(?:tiếng Anh|English)[:\s]+([^\n.,]+)/i);
          if (bankEnglishMatch) bankInfo.bankNameEnglish = bankEnglishMatch[1].trim();
        }
        
        // Tìm số tài khoản
        const accountMatch = content.match(/(?:số tài khoản|số tk|account number|account no)[:\s]+([0-9\s-]+)/i);
        if (accountMatch) bankInfo.accountNumber = accountMatch[1].replace(/\s+/g, '').trim();
        
        // Tìm tên chủ tài khoản
        const nameMatch = content.match(/(?:tên|chủ tài khoản|tên tk|account name|beneficiary)[:\s]+([^\n.,]+)/i);
        if (nameMatch) bankInfo.accountName = nameMatch[1].trim();
        
        return bankInfo;
      }
    } catch (error) {
      console.error('Error parsing OpenAI response:', error.message);
      return null;
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error.message);
    return null;
  }
};

/**
 * Trích xuất số tiền từ ảnh sử dụng OpenAI API (cho lệnh /12)
 * @param {Buffer} imageBuffer - Buffer chứa dữ liệu ảnh
 * @returns {Number|null} - Số tiền trích xuất được hoặc null nếu thất bại
 */
const extractMoneyAmountFromImage = async (imageBuffer) => {
  try {
    // Chuyển đổi buffer ảnh thành base64
    const base64Image = imageBuffer.toString('base64');
    const base64Url = `data:image/jpeg;base64,${base64Image}`;
    
    // Chuẩn bị prompt để gửi đến OpenAI
    const prompt = "Tìm và trích xuất số tiền từ hình ảnh này. Hãy tìm các số tiền có thể có trong ảnh (có thể là USDT, USD, VND, hoặc các đơn vị tiền tệ khác). Trả về CHÍNH XÁC chỉ một số (không có đơn vị, không có ký tự đặc biệt, chỉ số thập phân). Nếu có nhiều số tiền, hãy trả về số lớn nhất. Nếu không tìm thấy số tiền nào, trả về 'null'. Ví dụ: nếu thấy '$100.50' thì chỉ trả về '100.5', nếu thấy '1,000 USDT' thì chỉ trả về '1000'.";
    
    // Tạo yêu cầu gửi đến OpenAI API
    const openAiUrl = "https://api.openai.com/v1/chat/completions";
    const requestBody = {
      "model": "gpt-4o", // Sử dụng GPT-4 Vision
      "messages": [
        {
          "role": "user",
          "content": [
            {"type": "text", "text": prompt},
            {
              "type": "image_url",
              "image_url": {
                "url": base64Url
              }
            }
          ]
        }
      ],
      "max_tokens": 100
    };
    
    const options = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    };
    
    // Gửi yêu cầu đến OpenAI API
    const response = await axios.post(openAiUrl, requestBody, options);
    
    // Kiểm tra phản hồi từ API
    if (!response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      console.error('Invalid response from OpenAI API');
      return null;
    }
    
    // Phân tích kết quả từ OpenAI
    const content = response.data.choices[0].message.content.trim();
    
    // Kiểm tra nếu trả về null
    if (content.toLowerCase() === 'null' || content.toLowerCase() === 'không tìm thấy') {
      return null;
    }
    
    // Trích xuất số từ phản hồi
    const numberMatch = content.match(/[\d,]+\.?\d*/);
    if (numberMatch) {
      const numberStr = numberMatch[0].replace(/,/g, ''); // Loại bỏ dấu phẩy
      const amount = parseFloat(numberStr);
      return isNaN(amount) ? null : amount;
    }
    
    // Thử parse trực tiếp content như một số
    const directAmount = parseFloat(content.replace(/,/g, ''));
    return isNaN(directAmount) ? null : directAmount;
    
  } catch (error) {
    console.error('Error calling OpenAI API for money extraction:', error.message);
    return null;
  }
};

module.exports = {
  extractBankInfoFromImage,
  extractMoneyAmountFromImage
}; 