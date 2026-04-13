/**
 * Định dạng số thông minh: không có dấu phẩy phần nghìn, dấu chấm phần thập phân
 * @param {Number} num - Số cần định dạng
 * @param {String} format - Loại format ('default' hoặc 'formatted')
 * @returns {String} - Chuỗi đã định dạng
 */
const formatSmart = (num, format = 'formatted') => {
  if (format === 'formatted') {
    return formatNumberWithCommas(num);
  }
  
  const floorVal = Math.floor(Math.abs(num));
  const fraction = Math.abs(num) - floorVal;
  
  if (fraction < 1e-9) {
    // Số nguyên: chỉ hiển thị số không có định dạng
    return Math.round(num).toString();
  } else {
    // Số thập phân: hiển thị với 2 chữ số sau dấu chấm
    return num.toFixed(2);
  }
};

/**
 * Định dạng số có dấu phẩy ngăn cách hàng nghìn và dấu chấm thập phân
 * @param {Number} num - Số cần định dạng
 * @returns {String} - Chuỗi đã định dạng với dấu phẩy
 */
const formatNumberWithCommas = (num) => {
  const floorVal = Math.floor(Math.abs(num));
  const fraction = Math.abs(num) - floorVal;
  
  let result = '';
  
  if (fraction < 1e-9) {
    // Số nguyên: thêm dấu phẩy ngăn cách hàng nghìn
    result = Math.round(num).toLocaleString('en-US');
  } else {
    // Số thập phân: thêm dấu phẩy và hiển thị 2 chữ số sau dấu chấm
    result = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  
  return result;
};

/**
 * Định dạng giá trị tỷ lệ (rate)
 * @param {Number} num - Số cần định dạng
 * @returns {String} - Chuỗi đã định dạng với dấu chấm thập phân
 */
const formatRateValue = (num) => {
  // Đảm bảo num là số
  num = parseFloat(num);
  if (isNaN(num)) {
    return "0";
  }
  
  // Nếu là số nguyên, trả về không có số thập phân
  if (Number.isInteger(num)) {
    return num.toString();
  }
  
  // Nếu là số thập phân, đảm bảo sử dụng dấu chấm và loại bỏ các số 0 ở cuối
  return num.toString().replace(/\.?0+$/, '');
};

/**
 * Chuyển giá trị báo cáo (số thô hoặc chuỗi đã format có dấu phẩy nghìn) sang số.
 * parseFloat("5,186,000") chỉ được 5 — gây sai tổng 总入款/总出款.
 */
const coerceReportNumber = (value) => {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value).replace(/,/g, '').trim();
  if (s === '') return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const escapeTelegramMarkdownLinkText = (text) =>
  String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/`/g, '\\`');

const escapeTelegramMarkdownCodeContent = (text) => String(text).replace(/`/g, "'");

/**
 * Tên người gửi trong báo cáo (Markdown): chỉ chữ, không dùng mention/link Telegram.
 */
const formatSenderForReportMarkdown = (displayName, _telegramUserId, _telegramUsername) => {
  const raw = displayName == null ? '' : String(displayName).trim();
  const label = raw || '用户';
  return escapeTelegramMarkdownLinkText(label);
};

/**
 * Kiểm tra xem chuỗi có phải biểu thức toán học hợp lệ không
 * @param {String} msg - Chuỗi cần kiểm tra
 * @returns {Boolean} - true nếu là biểu thức toán học
 */
const isMathExpression = (msg) => {
  // Hỗ trợ số đặc biệt: m, k, w, 万, y, 个亿 và dấu phẩy/phân cách thập phân
  const mathRegex = /^[0-9+\-*/(),.\s万个亿mkwy]+$/;
  return mathRegex.test(msg);
};

/**
 * Kiểm tra xem chuỗi có phải là một số đơn giản không
 * Bao gồm cả các số với ký hiệu đặc biệt như 12w, 545w, 1m, 2k, 3万, 1个亿, 1y
 * @param {String} msg - Chuỗi cần kiểm tra
 * @returns {Boolean} - true nếu là số đơn giản (không cần tính toán)
 */
const isSingleNumber = (msg) => {
  const trimmedMsg = msg.trim();
  
  // Kiểm tra số thông thường (123, 123.45, -123.45)
  const regularNumberRegex = /^-?\d+(\.\d+)?$/;
  if (regularNumberRegex.test(trimmedMsg)) {
    return true;
  }
  
  // Kiểm tra số với ký hiệu đặc biệt đơn giản (không có phép toán)
  // Các pattern: 12w, 545w, 1m, 2k, 3万, 1个亿, 1y, 12w5, 1m2, 3万4, etc.
  const specialNumberRegex = /^-?\d*\.?\d*[mkwy万个亿]$/;
  if (specialNumberRegex.test(trimmedMsg)) {
    return true;
  }
  
  // Kiểm tra số với 个亿 đơn giản
  const yiNumberRegex = /^-?\d*\.?\d*个亿$/;
  if (yiNumberRegex.test(trimmedMsg)) {
    return true;
  }
  
  // Kiểm tra số ghép đơn giản (12w5, 1m2, 3万4, 1个亿2, 1y3)
  const compoundNumberRegex = /^-?\d+[mkwy万个亿]\d+$/;
  if (compoundNumberRegex.test(trimmedMsg)) {
    return true;
  }
  
  // Kiểm tra số ghép với 个亿 (1个亿2, 2个亿5)
  const yiCompoundRegex = /^-?\d+个亿\d+$/;
  if (yiCompoundRegex.test(trimmedMsg)) {
    return true;
  }
  
  return false;
};

/**
 * Kiểm tra xem chuỗi có thể parse thành số không (bao gồm các định dạng đặc biệt)
 * @param {String} msg - Chuỗi cần kiểm tra
 * @returns {Boolean} - true nếu có thể parse thành số
 */
const isValidNumber = (msg) => {
  // Kiểm tra xem có chứa các ký tự số đặc biệt không
  const specialNumberRegex = /^[0-9+\-*/().\s万个亿mkwy,]+$/;
  if (!specialNumberRegex.test(msg)) {
    return false;
  }
  
  const parsed = parseSpecialNumber(msg);
  return !isNaN(parsed) && isFinite(parsed);
};

/**
 * Chuẩn hóa định dạng số với các dấu phân cách khác nhau
 * Hỗ trợ các định dạng số của các nước khác nhau:
 * - US: 1,234,567.89 (dấu phẩy phân cách hàng nghìn, dấu chấm thập phân)
 * - EU: 1.234.567,89 (dấu chấm phân cách hàng nghìn, dấu phẩy thập phân)
 * - Mixed: 2,765,566+3.454.635 (hỗn hợp trong cùng một biểu thức)
 * @param {String} str - Chuỗi số cần chuẩn hóa
 * @returns {String} - Chuỗi số đã được chuẩn hóa
 */
const normalizeNumberFormat = (str) => {
  // Tìm tất cả dấu phân cách (. và ,)
  const commaCount = (str.match(/,/g) || []).length;
  const dotCount = (str.match(/\./g) || []).length;
  
  // Nếu không có dấu phân cách nào, return nguyên
  if (commaCount === 0 && dotCount === 0) {
    return str;
  }
  
  // Logic xử lý dựa trên số lượng dấu phân cách
  
  // Trường hợp 1: Chỉ có dấu phẩy
  if (commaCount > 0 && dotCount === 0) {
    // Nếu có nhiều dấu phẩy, chắc chắn là phân cách hàng nghìn (US format)
    if (commaCount > 1) {
      return str.replace(/,/g, '');
    }
    
    // Nếu chỉ có 1 dấu phẩy, kiểm tra vị trí và context
    const commaPos = str.lastIndexOf(',');
    const afterComma = str.substring(commaPos + 1);
    const beforeComma = str.substring(0, commaPos);
    
    // Nếu sau dấu phẩy có đúng 3 chữ số, rất có khả năng là phân cách hàng nghìn
    if (afterComma.length === 3 && /^\d+$/.test(afterComma)) {
      return str.replace(/,/g, '');
    }
    
    // Nếu sau dấu phẩy có 1-2 chữ số, thường là thập phân (EU format)
    if (afterComma.length <= 2 && /^\d+$/.test(afterComma) && beforeComma.length >= 1) {
      // Chuyển thành dấu chấm cho thập phân
      return str.replace(',', '.');
    }
    
    // Các trường hợp khác, loại bỏ dấu phẩy
    return str.replace(/,/g, '');
  }
  
  // Trường hợp 2: Chỉ có dấu chấm
  if (dotCount > 0 && commaCount === 0) {
    // Nếu có nhiều dấu chấm, chắc chắn là phân cách hàng nghìn (EU format)
    if (dotCount > 1) {
      return str.replace(/\./g, '');
    }
    
    // Nếu chỉ có 1 dấu chấm, kiểm tra vị trí và context
    const dotPos = str.lastIndexOf('.');
    const afterDot = str.substring(dotPos + 1);
    const beforeDot = str.substring(0, dotPos);
    
    // Nếu sau dấu chấm có <= 3 chữ số và toàn bộ là số, có thể là thập phân
    if (afterDot.length <= 3 && /^\d+$/.test(afterDot)) {
      // Nếu số trước dấu chấm >= 4 chữ số VÀ sau dấu chấm có đúng 3 chữ số, có thể là phân cách hàng nghìn
      if (beforeDot.length >= 4 && afterDot.length === 3) {
        return str.replace(/\./g, '');
      }
      // Ngược lại, giữ nguyên như thập phân (US format)
      return str;
    }
    // Các trường hợp khác, loại bỏ dấu chấm
    return str.replace(/\./g, '');
  }
  
  // Trường hợp 3: Có cả dấu chấm và phẩy (Mixed format)
  if (commaCount > 0 && dotCount > 0) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    // Dấu nào xuất hiện sau cùng là dấu thập phân
    if (lastComma > lastDot) {
      // Dấu phẩy là thập phân (EU format), dấu chấm là phân cách hàng nghìn
      return str.replace(/\./g, '').replace(',', '.');
    } else {
      // Dấu chấm là thập phân (US format), dấu phẩy là phân cách hàng nghìn
      return str.replace(/,/g, '');
    }
  }
  
  return str;
};

/**
 * Parse số với các định dạng đặc biệt
 * @param {String} input - Chuỗi số cần parse
 * @returns {Number} - Số đã được chuyển đổi
 * 
 * Examples:
 * 1m = 1,000,000
 * 1m2 = 1,200,000  
 * 1m24 = 1,240,000
 * 1m269 = 1,269,000
 * 5m6 = 5,600,000 (NEW: 5×1,000,000 + 6×100,000)
 * 5m63 = 5,630,000 (NEW: 5×1,000,000 + 63×10,000)
 * 5m634 = 5,634,000 (NEW: 5×1,000,000 + 634×1,000)
 * 1k = 1,000
 * 1k2 = 1,200
 * 1k24 = 1,240
 * 7k8 = 7,800 (NEW: 7×1,000 + 8×100)
 * 7k83 = 7,830 (NEW: 7×1,000 + 83×10)
 * 7k834 = 7,834 (NEW: 7×1,000 + 834×1)
 * 2m5k = 2,005,000
 * 1w = 10,000
 * 3w4 = 34,000 (NEW: 3×10,000 + 4×1,000)
 * 3w32 = 33,200 (NEW: 3×10,000 + 32×100)
 * 3w324 = 33,240 (NEW: 3×10,000 + 324×10)
 * 1000w = 10,000,000
 * 1万 = 10,000
 * 3万4 = 34,000 (NEW: 3×10,000 + 4×1,000)
 * 3万32 = 33,200 (NEW: 3×10,000 + 32×100)
 * 3万324 = 33,240 (NEW: 3×10,000 + 324×10)
 * 1个亿 = 100,000,000
 * 1亿 = 100,000,000 (亿 = y)
 * 3个亿4 = 340,000,000 (NEW: 3×100,000,000 + 4×10,000,000)
 * 3个亿45 = 345,000,000 (NEW: 3×100,000,000 + 45×1,000,000)
 * 2亿35 = 235,000,000 (ghép, giống 2个亿35)
 * 1y = 100,000,000
 * 3y4 = 340,000,000 (NEW: 3×100,000,000 + 4×10,000,000)
 * 3y45 = 345,000,000 (NEW: 3×100,000,000 + 45×1,000,000)
 * 1,000,000 = 1,000,000
 * 1.000.000 = 1,000,000 (European format)
 * 1.000.000,2 = 1,000,000.2 (European decimal)
 * 1,000,000.3 = 1,000,000.3 (US decimal)
 */
const parseSpecialNumber = (input) => {
  if (!input) return NaN;
  
  let str = input.toString().trim().toLowerCase();
  
  // Xử lý định dạng số với dấu phân cách phức tạp
  str = normalizeNumberFormat(str);
  
  // Nếu là số bình thường, return luôn
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return parseFloat(str);
  }
  
  let result = 0;
  let processed = str;
  
  // Xử lý 个亿 với logic đặc biệt (3个亿4 = 3,400,000,000)
  const yiMatches = processed.match(/(\d+)个亿(\d+)/g);
  if (yiMatches) {
    yiMatches.forEach(match => {
      const parts = match.match(/(\d+)个亿(\d+)/);
      if (parts) {
        const beforeYi = parseFloat(parts[1]); // 3
        const afterYi = parts[2]; // 4, 40, 400...
        let value = beforeYi * 100000000; // 3 * 100,000,000 = 300,000,000
        
        if (afterYi) {
          const digits = afterYi.length;
          const multiplier = Math.pow(10, Math.max(0, 8 - digits)); // 8-1=7, 8-2=6, 8-3=5
          value += parseFloat(afterYi) * multiplier; // 4*10000000, 40*1000000, 400*100000
        }
        
        result += value;
        processed = processed.replace(match, '');
      }
    });
  }
  
  // Xử lý 个亿 đơn lẻ
  const yiSingleMatches = processed.match(/(\d*\.?\d*)个亿/g);
  if (yiSingleMatches) {
    yiSingleMatches.forEach(match => {
      const num = parseFloat(match.replace('个亿', '')) || 1;
      result += num * 100000000;
      processed = processed.replace(match, '');
    });
  }
  
  // Xử lý 亿 ghép không có chữ 个 (3亿4 giống 3个亿4)
  const yiShortGhepMatches = processed.match(/(\d+)亿(\d+)/g);
  if (yiShortGhepMatches) {
    yiShortGhepMatches.forEach(match => {
      const parts = match.match(/(\d+)亿(\d+)/);
      if (parts) {
        const beforeYi = parseFloat(parts[1]);
        const afterYi = parts[2];
        let value = beforeYi * 100000000;
        if (afterYi) {
          const digits = afterYi.length;
          const multiplier = Math.pow(10, Math.max(0, 8 - digits));
          value += parseFloat(afterYi) * multiplier;
        }
        result += value;
        processed = processed.replace(match, '');
      }
    });
  }
  
  // Xử lý 亿 đơn lẻ: y=亿, ví dụ 1亿 = 100,000,000 (không trùng 1个亿 đã xử lý trên)
  const yiShortSingleMatches = processed.match(/(\d*\.?\d*)亿/g);
  if (yiShortSingleMatches) {
    yiShortSingleMatches.forEach(match => {
      const num = parseFloat(match.replace('亿', '')) || 1;
      result += num * 100000000;
      processed = processed.replace(match, '');
    });
  }
  
  // Xử lý y với logic đặc biệt (3y4 = 3,400,000,000); y = 亿
  const yGhepMatches = processed.match(/(\d+)y(\d+)/g);
  if (yGhepMatches) {
    yGhepMatches.forEach(match => {
      const parts = match.match(/(\d+)y(\d+)/);
      if (parts) {
        const beforeY = parseFloat(parts[1]); // 3
        const afterY = parts[2]; // 4, 40, 400...
        let value = beforeY * 100000000; // 3 * 100,000,000 = 300,000,000
        
        if (afterY) {
          const digits = afterY.length;
          const multiplier = Math.pow(10, Math.max(0, 8 - digits)); // 8-1=7, 8-2=6, 8-3=5
          value += parseFloat(afterY) * multiplier; // 4*10000000, 40*1000000, 400*100000
        }
        
        result += value;
        processed = processed.replace(match, '');
      }
    });
  }
  
  // Xử lý y đơn lẻ (亿 = 100,000,000)
  const yMatches = processed.match(/(\d*\.?\d*)y/g);
  if (yMatches) {
    yMatches.forEach(match => {
      const num = parseFloat(match.replace('y', '')) || 1;
      result += num * 100000000;
      processed = processed.replace(match, '');
    });
  }
  
  // Xử lý 万 với logic đặc biệt (3万4 = 34,000)
  const wanGhepMatches = processed.match(/(\d+)万(\d+)/g);
  if (wanGhepMatches) {
    wanGhepMatches.forEach(match => {
      const parts = match.match(/(\d+)万(\d+)/);
      if (parts) {
        const beforeWan = parseFloat(parts[1]); // 3
        const afterWan = parts[2]; // 4, 32, 324...
        let value = beforeWan * 10000; // 3 * 10,000 = 30,000
        
        if (afterWan) {
          const digits = afterWan.length;
          const multiplier = Math.pow(10, Math.max(0, 4 - digits)); // 4-1=3, 4-2=2, 4-3=1
          value += parseFloat(afterWan) * multiplier; // 4*1000, 32*100, 324*10
        }
        
        result += value;
        processed = processed.replace(match, '');
      }
    });
  }
  
  // Xử lý 万 đơn lẻ (10,000)
  const wanMatches = processed.match(/(\d*\.?\d*)万/g);
  if (wanMatches) {
    wanMatches.forEach(match => {
      const num = parseFloat(match.replace('万', '')) || 1;
      result += num * 10000;
      processed = processed.replace(match, '');
    });
  }
  
  // Xử lý w với logic đặc biệt (3w4 = 34,000)
  const wGhepMatches = processed.match(/(\d+)w(\d+)/g);
  if (wGhepMatches) {
    wGhepMatches.forEach(match => {
      const parts = match.match(/(\d+)w(\d+)/);
      if (parts) {
        const beforeW = parseFloat(parts[1]); // 3
        const afterW = parts[2]; // 4, 32, 324...
        let value = beforeW * 10000; // 3 * 10,000 = 30,000
        
        if (afterW) {
          const digits = afterW.length;
          const multiplier = Math.pow(10, Math.max(0, 4 - digits)); // 4-1=3, 4-2=2, 4-3=1
          value += parseFloat(afterW) * multiplier; // 4*1000, 32*100, 324*10
        }
        
        result += value;
        processed = processed.replace(match, '');
      }
    });
  }
  
  // Xử lý w đơn lẻ (wan = 10,000)
  const wMatches = processed.match(/(\d*\.?\d*)w/g);
  if (wMatches) {
    wMatches.forEach(match => {
      const num = parseFloat(match.replace('w', '')) || 1;
      result += num * 10000;
      processed = processed.replace(match, '');
    });
  }
  
  // Xử lý m với logic đặc biệt (5m6 = 5,600,000)
  const mGhepMatches = processed.match(/(\d+)m(\d+)/g);
  if (mGhepMatches) {
    mGhepMatches.forEach(match => {
      const parts = match.match(/(\d+)m(\d+)/);
      if (parts) {
        const beforeM = parseFloat(parts[1]); // 5
        const afterM = parts[2]; // 6, 63, 634...
        let value = beforeM * 1000000; // 5 * 1,000,000 = 5,000,000
        
        if (afterM) {
          const digits = afterM.length;
          const multiplier = Math.pow(10, Math.max(0, 6 - digits)); // 6-1=5, 6-2=4, 6-3=3
          value += parseFloat(afterM) * multiplier; // 6*100000, 63*10000, 634*1000
        }
        
        result += value;
        processed = processed.replace(match, '');
      }
    });
  }
  
  // Xử lý m đơn lẻ với logic cũ (1m2 = 1,200,000)
  const mMatches = processed.match(/(\d*\.?\d*)m(\d*)/g);
  if (mMatches) {
    mMatches.forEach(match => {
      const parts = match.match(/(\d*\.?\d*)m(\d*)/);
      if (parts) {
        const beforeM = parseFloat(parts[1]) || 1;
        let mValue = beforeM * 1000000;
        
        // Xử lý phần sau m (như 1m2 = 1,200,000)
        const afterM = parts[2];
        if (afterM && /^\d+$/.test(afterM)) {
          const digits = afterM.length;
          const multiplier = Math.pow(10, Math.max(0, 6 - digits));
          mValue += parseFloat(afterM) * multiplier;
        }
        
        result += mValue;
        processed = processed.replace(match, '');
      }
    });
  }
  
  // Xử lý k với logic đặc biệt (7k8 = 7,800)
  const kGhepMatches = processed.match(/(\d+)k(\d+)/g);
  if (kGhepMatches) {
    kGhepMatches.forEach(match => {
      const parts = match.match(/(\d+)k(\d+)/);
      if (parts) {
        const beforeK = parseFloat(parts[1]); // 7
        const afterK = parts[2]; // 8, 83, 834...
        let value = beforeK * 1000; // 7 * 1,000 = 7,000
        
        if (afterK) {
          const digits = afterK.length;
          const multiplier = Math.pow(10, Math.max(0, 3 - digits)); // 3-1=2, 3-2=1, 3-3=0
          value += parseFloat(afterK) * multiplier; // 8*100, 83*10, 834*1
        }
        
        result += value;
        processed = processed.replace(match, '');
      }
    });
  }
  
  // Xử lý k đơn lẻ với logic cũ (1k2 = 1,200)
  const kMatches = processed.match(/(\d*\.?\d*)k(\d*)/g);
  if (kMatches) {
    kMatches.forEach(match => {
      const parts = match.match(/(\d*\.?\d*)k(\d*)/);
      if (parts) {
        const beforeK = parseFloat(parts[1]) || 1;
        let kValue = beforeK * 1000;
        
        // Xử lý phần sau k (như 1k2 = 1,200)
        const afterK = parts[2];
        if (afterK && /^\d+$/.test(afterK)) {
          const digits = afterK.length;
          const multiplier = Math.pow(10, Math.max(0, 3 - digits));
          kValue += parseFloat(afterK) * multiplier;
        }
        
        result += kValue;
        processed = processed.replace(match, '');
      }
    });
  }
  
  // Xử lý số còn lại
  const remaining = processed.replace(/[^\d.]/g, '');
  if (remaining && !isNaN(parseFloat(remaining))) {
    result += parseFloat(remaining);
  }
  
  return result;
};

/**
 * Evaluate biểu thức toán học với các định dạng số đặc biệt
 * Hỗ trợ các định dạng số của các nước khác nhau trong cùng một biểu thức
 * @param {String} expr - Biểu thức cần tính
 * @returns {Number} - Kết quả tính toán
 */
const evaluateSpecialExpression = (expr) => {
  if (!expr) return NaN;
  
  let processedExpr = expr.toString().trim();
  
  // Thay thế từng pattern theo thứ tự ưu tiên
  // Ghép số patterns (ưu tiên cao)
  processedExpr = processedExpr.replace(/(\d+)个亿(\d+)/g, (match, p1, p2) => {
    const beforeYi = parseFloat(p1);
    let value = beforeYi * 100000000;
    if (p2) {
      const digits = p2.length;
      const multiplier = Math.pow(10, Math.max(0, 8 - digits));
      value += parseFloat(p2) * multiplier;
    }
    return value.toString();
  });
  
  processedExpr = processedExpr.replace(/(\d+)亿(\d+)/g, (match, p1, p2) => {
    const beforeYi = parseFloat(p1);
    let value = beforeYi * 100000000;
    if (p2) {
      const digits = p2.length;
      const multiplier = Math.pow(10, Math.max(0, 8 - digits));
      value += parseFloat(p2) * multiplier;
    }
    return value.toString();
  });
  
  processedExpr = processedExpr.replace(/(\d+)y(\d+)/g, (match, p1, p2) => {
    const beforeY = parseFloat(p1);
    let value = beforeY * 100000000;
    if (p2) {
      const digits = p2.length;
      const multiplier = Math.pow(10, Math.max(0, 8 - digits));
      value += parseFloat(p2) * multiplier;
    }
    return value.toString();
  });
  
  processedExpr = processedExpr.replace(/(\d+)万(\d+)/g, (match, p1, p2) => {
    const beforeWan = parseFloat(p1);
    let value = beforeWan * 10000;
    if (p2) {
      const digits = p2.length;
      const multiplier = Math.pow(10, Math.max(0, 4 - digits));
      value += parseFloat(p2) * multiplier;
    }
    return value.toString();
  });
  
  processedExpr = processedExpr.replace(/(\d+)w(\d+)/g, (match, p1, p2) => {
    const beforeW = parseFloat(p1);
    let value = beforeW * 10000;
    if (p2) {
      const digits = p2.length;
      const multiplier = Math.pow(10, Math.max(0, 4 - digits));
      value += parseFloat(p2) * multiplier;
    }
    return value.toString();
  });
  
  processedExpr = processedExpr.replace(/(\d+)m(\d+)/g, (match, p1, p2) => {
    const beforeM = parseFloat(p1);
    let value = beforeM * 1000000;
    if (p2) {
      const digits = p2.length;
      const multiplier = Math.pow(10, Math.max(0, 6 - digits));
      value += parseFloat(p2) * multiplier;
    }
    return value.toString();
  });
  
  processedExpr = processedExpr.replace(/(\d+)k(\d+)/g, (match, p1, p2) => {
    const beforeK = parseFloat(p1);
    let value = beforeK * 1000;
    if (p2) {
      const digits = p2.length;
      const multiplier = Math.pow(10, Math.max(0, 3 - digits));
      value += parseFloat(p2) * multiplier;
    }
    return value.toString();
  });
  
  // Xử lý các pattern đơn lẻ
  processedExpr = processedExpr.replace(/(\d*\.?\d*)个亿/g, (match, p1) => {
    const num = parseFloat(p1) || 1;
    return (num * 100000000).toString();
  });
  
  processedExpr = processedExpr.replace(/(\d*\.?\d*)亿/g, (match, p1) => {
    const num = parseFloat(p1) || 1;
    return (num * 100000000).toString();
  });
  
  processedExpr = processedExpr.replace(/(\d*\.?\d*)y/g, (match, p1) => {
    const num = parseFloat(p1) || 1;
    return (num * 100000000).toString();
  });
  
  processedExpr = processedExpr.replace(/(\d*\.?\d*)万/g, (match, p1) => {
    const num = parseFloat(p1) || 1;
    return (num * 10000).toString();
  });
  
  processedExpr = processedExpr.replace(/(\d*\.?\d*)w/g, (match, p1) => {
    const num = parseFloat(p1) || 1;
    return (num * 10000).toString();
  });
  
  processedExpr = processedExpr.replace(/(\d*\.?\d*)m(\d*)/g, (match, p1, p2) => {
    const beforeM = parseFloat(p1) || 1;
    let value = beforeM * 1000000;
    if (p2 && /^\d+$/.test(p2)) {
      const digits = p2.length;
      const multiplier = Math.pow(10, Math.max(0, 6 - digits));
      value += parseFloat(p2) * multiplier;
    }
    return value.toString();
  });
  
  processedExpr = processedExpr.replace(/(\d*\.?\d*)k(\d*)/g, (match, p1, p2) => {
    const beforeK = parseFloat(p1) || 1;
    let value = beforeK * 1000;
    if (p2 && /^\d+$/.test(p2)) {
      const digits = p2.length;
      const multiplier = Math.pow(10, Math.max(0, 3 - digits));
      value += parseFloat(p2) * multiplier;
    }
    return value.toString();
  });
  
  // Chuẩn hóa định dạng số trước khi eval
  // Tách và xử lý từng số trong biểu thức với regex cải tiến
  // Tìm tất cả các số có dấu phân cách (có thể là hàng nghìn hoặc thập phân)
  // Xử lý các số phức tạp trước (có nhiều dấu phân cách)
  processedExpr = processedExpr.replace(/(\d+[.,]\d+(?:[.,]\d+)*)/g, (match) => {
    return normalizeNumberFormat(match);
  });
  
  // Xử lý các số đơn lẻ có dấu phân cách (trường hợp đặc biệt)
  // Ví dụ: 1,234 hoặc 1.234 (có thể là 1234 hoặc 1.234)
  processedExpr = processedExpr.replace(/(\d+[.,]\d+)/g, (match) => {
    // Nếu chưa được xử lý bởi normalizeNumberFormat, xử lý lại
    if (match.includes(',') || match.includes('.')) {
      return normalizeNumberFormat(match);
    }
    return match;
  });
  
  // Xử lý các số đơn giản có dấu phân cách (chỉ có 1 dấu)
  processedExpr = processedExpr.replace(/(\d+[.,]\d+)/g, (match) => {
    return normalizeNumberFormat(match);
  });
  
  try {
    return eval(processedExpr);
  } catch (error) {
    return NaN;
  }
};

/**
 * Kiểm tra xem chuỗi có phải là địa chỉ TRC20 hợp lệ không
 * @param {String} str - Chuỗi cần kiểm tra
 * @returns {Boolean} - true nếu là địa chỉ TRC20 hợp lệ
 */
const isTrc20Address = (str) => {
  const re = /^T[A-Za-z0-9]{33}$/;
  return re.test(str);
};

/**
 * Format date in US style (MM/DD/YYYY)
 * @param {Date} date - Date to format
 * @returns {String} - Formatted date string
 */
const formatDateUS = (date) => {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${year}/${month}/${day}`;
};

/**
 * Định dạng thời gian theo định dạng 24h (HH:mm:ss) theo múi giờ Campuchia (Asia/Phnom_Penh)
 * @param {Date} date - Đối tượng ngày cần định dạng
 * @returns {String} - Chuỗi thời gian đã định dạng (ví dụ: 14:05:00)
 */
const formatTimeString = (date) => {
  return date.toLocaleTimeString('en-US', { timeZone: 'Asia/Phnom_Penh', hour12: false });
};

/**
 * Lấy định dạng số của người dùng theo nhóm
 */
const getUserNumberFormat = async (userId, chatId) => {
  try {
    const User = require('../models/User');
    const user = await User.findOne({ userId: userId.toString() });
    
    if (!user) return 'formatted';
    
    // Tìm cài đặt cho nhóm cụ thể
    const groupSetting = user.groupPermissions.find(gp => gp.chatId === chatId.toString());
    
    return groupSetting ? groupSetting.numberFormat : 'formatted';
  } catch (error) {
    console.error('Error getting user number format:', error);
    return 'formatted';
  }
};

/**
 * Lấy định dạng số chung của nhóm
 */
const getGroupNumberFormat = async (chatId) => {
  try {
    const Group = require('../models/Group');
    const group = await Group.findOne({ chatId: chatId.toString() });
    
    return group ? group.numberFormat : 'formatted';
  } catch (error) {
    console.error('Error getting group number format:', error);
    return 'formatted';
  }
};

/**
 * Marker Markdown (legacy) cho dòng giao dịch mới nhất trong báo cáo.
 */
const newestEntryMarker = (isNewest) => (isNewest ? '*📌* ' : '');

/**
 * Chèn marker ngay sau `` `HH:MM:SS` `` (trước số tiền / phần còn lại của details).
 */
const insertNewestMarkerAfterTime = (details, marker) => {
  if (!marker || !details) return details || '';
  return details.replace(/^(`[^`]+`)(\s*)/, '$1$2' + marker);
};

/**
 * Tạo tin nhắn telegram không sử dụng markdown
 * @param {Object} jsonData - Dữ liệu cần format
 * @param {String} numberFormat - Định dạng số ('default' hoặc 'formatted')
 * @returns {String} - Chuỗi đã định dạng
 */
const formatTelegramMessage = (jsonData, numberFormat = 'formatted') => {
  let output = '';
  
  // Date header - using US format (MM/DD/YYYY)
  const currentDate = new Date();
  const formattedDate = formatDateUS(currentDate);
  output += `*${formattedDate}*\n`;
  
  // Deposits section
  if (jsonData.depositData && jsonData.depositData.entries && jsonData.depositData.entries.length > 0) {
    const depositCount = jsonData.depositData.totalCount || jsonData.depositData.entries.length;
    output += `*已入账* (${depositCount}笔):\n`;
    
    // Format giao dịch với ID và link
    jsonData.depositData.entries.forEach((entry, index) => {
      // Sử dụng ID từ entry thay vì tạo ID mới
      const id = entry.id || (entry.index + 1);
      const newestMarker = newestEntryMarker(index === 0);
      
      if (entry.messageId && entry.chatLink) {
        // Tạo link đến tin nhắn gốc với ID là phần clickable
        const line = insertNewestMarkerAfterTime(entry.details, newestMarker);
        output += `${line} (id[${id}](${entry.chatLink}))\n`;
      }
    });
    output += '\n';
  } else {
    output += "*已入账*(0笔):\n\n";
  }
  
  // Payments section
  if (jsonData.paymentData && jsonData.paymentData.entries && jsonData.paymentData.entries.length > 0) {
    const paymentCount = jsonData.paymentData.totalCount || jsonData.paymentData.entries.length;
    output += `*已下发* (${paymentCount}笔):\n`;
    
    // Format giao dịch với ID và link
    jsonData.paymentData.entries.forEach((entry, index) => {
      // Dùng ký hiệu ! trước ID của payment
      // Sử dụng ID từ entry thay vì tạo ID mới
      const id = `!${entry.id || (entry.index + 1)}`;
      const newestMarker = newestEntryMarker(index === 0);
      
      if (entry.messageId && entry.chatLink) {
        // Tạo link đến tin nhắn gốc với ID là phần clickable
        const line = insertNewestMarkerAfterTime(entry.details, newestMarker);
        output += `${line} ([${id}](${entry.chatLink}))\n`;
      }
    });
    output += '\n';
  } else {
    output += "*已下发*(0笔):\n\n";
  }
  output += `总入款💰: ${formatSmart(coerceReportNumber(jsonData.totalAmount), numberFormat)}\n`;
  // Rate information
  const rateInfo = `费率： ${jsonData.rate}\n汇率： ${jsonData.exchangeRate}\n`;
 
  // Thêm ví dụ nếu có
  let rateInfoWithExample = rateInfo;
  if (jsonData.example) {
    rateInfoWithExample += `\n例如: 100000 = ${formatSmart(coerceReportNumber(jsonData.example), numberFormat)} ${jsonData.currencyUnit || 'USDT'}`;
  }
  
  output += `${rateInfoWithExample}\n`;
  
  // Summary section
  output += `应下发 : ${formatSmart(coerceReportNumber(jsonData.totalUSDT), numberFormat)}  ${jsonData.currencyUnit || 'USDT'}\n`;
  output += `已下发 : ${formatSmart(coerceReportNumber(jsonData.paidUSDT), numberFormat)}  ${jsonData.currencyUnit || 'USDT'}\n`;
  output += `未下发 : ${formatSmart(coerceReportNumber(jsonData.remainingUSDT), numberFormat)}  ${jsonData.currencyUnit || 'USDT'}`;
  
  // Cards section (if present)
  if (jsonData.cards && jsonData.cards.length > 0) {
    output += `\n卡额度 💳:\n${jsonData.cards.join("\n")}`;
  }
  
  return output;
};

/**
 * Format tin nhắn Telegram với thông tin đầy đủ bao gồm 出款费率 và 出款汇率
 */
const formatWithdrawRateMessage = (jsonData, numberFormat = 'formatted') => {
  let output = '';
  
  // Date header - using US format (MM/DD/YYYY)
  const currentDate = new Date();
  const formattedDate = formatDateUS(currentDate);
  output += `*${formattedDate}*\n`;
  
  // Deposits section
  if (jsonData.depositData && jsonData.depositData.entries && jsonData.depositData.entries.length > 0) {
    const depositCount = jsonData.depositData.totalCount || jsonData.depositData.entries.length;
    output += `*已入账* (${depositCount}笔):\n`;
    
    jsonData.depositData.entries.forEach((entry, index) => {
      const id = entry.id || (entry.index + 1);
      const newestMarker = newestEntryMarker(index === 0);
      
      if (entry.messageId && entry.chatLink) {
        const line = insertNewestMarkerAfterTime(entry.details, newestMarker);
        output += `${line} (id[${id}](${entry.chatLink}))\n`;
      }
    });
    output += '\n';
  } else {
    output += "*已入账*(0笔):\n\n";
  }
  
  // Payments section
  if (jsonData.paymentData && jsonData.paymentData.entries && jsonData.paymentData.entries.length > 0) {
    const paymentCount = jsonData.paymentData.totalCount || jsonData.paymentData.entries.length;
    output += `*已下发* (${paymentCount}笔):\n`;
    
    jsonData.paymentData.entries.forEach((entry, index) => {
      const id = `!${entry.id || (entry.index + 1)}`;
      const newestMarker = newestEntryMarker(index === 0);
      
      if (entry.messageId && entry.chatLink) {
        const line = insertNewestMarkerAfterTime(entry.details, newestMarker);
        output += `${line} ([${id}](${entry.chatLink}))\n`;
      }
    });
    output += '\n';
  } else {
    output += "*已下发*(0笔):\n\n";
  }
  
  // Thống kê chi tiết  
  output += `总入款: ${formatSmart(coerceReportNumber(jsonData.totalDepositVND), numberFormat)}|  ${formatSmart(coerceReportNumber(jsonData.totalDepositUSDT), numberFormat)}  ${jsonData.currencyUnit || 'USDT'}\n`;
  output += `总出款: ${formatSmart(coerceReportNumber(jsonData.totalWithdrawVND), numberFormat)}|  ${formatSmart(coerceReportNumber(jsonData.totalWithdrawUSDT), numberFormat)}  ${jsonData.currencyUnit || 'USDT'}\n`;
  
  // Rate information
  output += `入款费率：${jsonData.rate} | 入款汇率：${jsonData.exchangeRate}\n`;
  output += `出款费率：${jsonData.withdrawRate} | 出款汇率：${jsonData.withdrawExchangeRate}\n`;
  
  // Ví dụ cho 出款
  if (jsonData.withdrawExample) {
    output += `例如出款: 100000 = ${formatSmart(coerceReportNumber(jsonData.withdrawExample), numberFormat)} ${jsonData.currencyUnit || 'USDT'}\n`;
  }
  
  // Tính toán số liệu mới
  const totalDepositUSDT = coerceReportNumber(jsonData.totalDepositUSDT);
  const totalWithdrawUSDT = coerceReportNumber(jsonData.totalWithdrawUSDT);
  const paidUSDT = coerceReportNumber(jsonData.paidUSDT);
  const shouldPayUSDT = totalDepositUSDT - totalWithdrawUSDT; // 应下发 = usdt总入款 - usdt总出款
  const unpaidUSDT = shouldPayUSDT - paidUSDT; // 未下发 = 应下发 - 已下发
  
  // Summary section với logic mới
  output += `\n应下发 : ${formatSmart(shouldPayUSDT, numberFormat)}  ${jsonData.currencyUnit || 'USDT'}\n`;
  output += `已下发 : ${formatSmart(paidUSDT, numberFormat)}  ${jsonData.currencyUnit || 'USDT'}\n`;
  output += `未下发 : ${formatSmart(unpaidUSDT, numberFormat)}  ${jsonData.currencyUnit || 'USDT'}`;
  
  // Cards section (if present)
  if (jsonData.cards && jsonData.cards.length > 0) {
    output += `\n卡额度 💳:\n${jsonData.cards.join("\n")}`;
  }
  
  return output;
};

module.exports = {
  formatSmart,
  formatNumberWithCommas,
  formatRateValue,
  isMathExpression,
  isSingleNumber,
  isValidNumber,
  normalizeNumberFormat,
  parseSpecialNumber,
  evaluateSpecialExpression,
  isTrc20Address,
  formatTelegramMessage,
  formatWithdrawRateMessage,
  formatSenderForReportMarkdown,
  formatDateUS,
  formatTimeString,
  getUserNumberFormat,
  getGroupNumberFormat
}; 