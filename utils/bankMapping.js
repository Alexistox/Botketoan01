/**
 * Mapping từ tên ngân hàng sang mã bank code cho VietQR
 */

const bankMapping = {
  // Ngân hàng TMCP Công thương Việt Nam
  'VietinBank': '970415',
  'Vietin': '970415',
  'ICB': '970415',
  
  // Ngân hàng TMCP Ngoại Thương Việt Nam
  'Vietcombank': '970436',
  'VCB': '970436',
  'Vietcom': '970436',
  
  // Ngân hàng TMCP Đầu tư và Phát triển Việt Nam
  'BIDV': '970418',
  'Bidv': '970418',
  
  // Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam
  'Agribank': '970405',
  'Agri': '970405',
  'VBA': '970405',
  
  // Ngân hàng TMCP Phương Đông
  'OCB': '970448',
  'Phuong Dong': '970448',
  
  // Ngân hàng TMCP Quân đội
  'MBBank': '970422',
  'MB': '970422',
  'Quan Doi': '970422',
  
  // Ngân hàng TMCP Kỹ thương Việt Nam
  'Techcombank': '970407',
  'TCB': '970407',
  'Ky Thuong': '970407',
  
  // Ngân hàng TMCP Á Châu
  'ACB': '970416',
  'A Chau': '970416',
  
  // Ngân hàng TMCP Việt Nam Thịnh Vượng
  'VPBank': '970432',
  'VP': '970432',
  'Thinh Vuong': '970432',
  
  // Ngân hàng TMCP Tiên Phong
  'TPBank': '970423',
  'TP': '970423',
  'Tien Phong': '970423',
  
  // Ngân hàng TMCP Sài Gòn Thương Tín
  'Sacombank': '970403',
  'STB': '970403',
  'Sai Gon Thuong Tin': '970403',
  
  // Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh
  'HDBank': '970437',
  'HDB': '970437',
  'Phat Trien': '970437',
  
  // Ngân hàng TMCP Bản Việt
  'VietCapitalBank': '970454',
  'VCCB': '970454',
  'Ban Viet': '970454',
  
  // Ngân hàng TMCP Sài Gòn
  'SCB': '970429',
  'Sai Gon': '970429',
  
  // Ngân hàng TMCP Quốc tế Việt Nam
  'VIB': '970441',
  'Quoc Te': '970441',
  
  // Ngân hàng TMCP Sài Gòn - Hà Nội
  'SHB': '970443',
  'Sai Gon Ha Noi': '970443',
  
  // Ngân hàng TMCP Xuất Nhập khẩu Việt Nam
  'Eximbank': '970431',
  'EIB': '970431',
  'Xuat Nhap Khau': '970431',
  
  // Ngân hàng TMCP Hàng Hải
  'MSB': '970426',
  'Hang Hai': '970426',
  
  // CAKE by VPBank
  'CAKE': '546034',
  'Cake': '546034',
  
  // Ubank by VPBank
  'Ubank': '546035',
  'UBank': '546035',
  
  // Timo by Ban Viet Bank
  'Timo': '963388',
  
  // ViettelMoney
  'ViettelMoney': '971005',
  'Viettel': '971005',
  
  // VNPT Money
  'VNPTMoney': '971011',
  'VNPT': '971011',
  
  // Ngân hàng TMCP Sài Gòn Công Thương
  'SaigonBank': '970400',
  'SGICB': '970400',
  'Sai Gon Cong Thuong': '970400',
  
  // Ngân hàng TMCP Bắc Á
  'BacABank': '970409',
  'BAB': '970409',
  'Bac A': '970409',
  
  // Ngân hàng TMCP Đại Chúng Việt Nam
  'PVcomBank': '970412',
  'PVCB': '970412',
  'Dai Chung': '970412',
  
  // Ngân hàng Thương mại TNHH MTV Đại Dương
  'Oceanbank': '970414',
  'Dai Duong': '970414',
  
  // Ngân hàng TMCP Quốc Dân
  'NCB': '970419',
  'Quoc Dan': '970419',
  
  // Ngân hàng TNHH MTV Shinhan Việt Nam
  'ShinhanBank': '970424',
  'SHBVN': '970424',
  'Shinhan': '970424',
  
  // Ngân hàng TMCP An Bình
  'ABBANK': '970425',
  'ABB': '970425',
  'An Binh': '970425',
  
  // Ngân hàng TMCP Việt Á
  'VietABank': '970427',
  'VAB': '970427',
  'Viet A': '970427',
  
  // Ngân hàng TMCP Nam Á
  'NamABank': '970428',
  'NAB': '970428',
  'Nam A': '970428',
  
  // Ngân hàng TMCP Xăng dầu Petrolimex
  'PGBank': '970430',
  'PGB': '970430',
  'Xang Dau': '970430',
  
  // Ngân hàng TMCP Việt Nam Thương Tín
  'VietBank': '970433',
  'VIETBANK': '970433',
  'Viet Nam Thuong Tin': '970433',
  
  // Ngân hàng TMCP Bảo Việt
  'BaoVietBank': '970438',
  'BVB': '970438',
  'Bao Viet': '970438',
  
  // Ngân hàng TMCP Đông Nam Á
  'SeABank': '970440',
  'SEAB': '970440',
  'Dong Nam A': '970440',
  
  // Ngân hàng Hợp tác xã Việt Nam
  'COOPBANK': '970446',
  'Hop Tac Xa': '970446',
  
  // Ngân hàng TMCP Bưu Điện Liên Việt
  'LienVietPostBank': '970449',
  'LPB': '970449',
  'Buu Dien Lien Viet': '970449',
  
  // Ngân hàng TMCP Kiên Long
  'KienLongBank': '970452',
  'KLB': '970452',
  'Kien Long': '970452',
  
  // Ngân hàng Đại chúng TNHH Kasikornbank
  'KBank': '668888',
  'Kasikornbank': '668888',
  
  // Ngân hàng United Overseas
  'UnitedOverseas': '970458',
  'UOB': '970458',
  
  // Ngân hàng TNHH MTV Standard Chartered Bank Việt Nam
  'StandardChartered': '970410',
  'SCVN': '970410',
  
  // Ngân hàng TNHH MTV Public Việt Nam
  'PublicBank': '970439',
  'PBVN': '970439',
  
  // Ngân hàng Nonghyup
  'Nonghyup': '801011',
  'NHB': '801011',
  
  // Ngân hàng TNHH Indovina
  'IndovinaBank': '970434',
  'IVB': '970434',
  
  // Ngân hàng Công nghiệp Hàn Quốc - Chi nhánh TP. Hồ Chí Minh
  'IBKHCM': '970456',
  'IBK HCM': '970456',
  
  // Ngân hàng Công nghiệp Hàn Quốc - Chi nhánh Hà Nội
  'IBKHN': '970455',
  'IBK HN': '970455',
  
  // Ngân hàng Liên doanh Việt - Nga
  'VRB': '970421',
  'Viet Nga': '970421',
  
  // Ngân hàng TNHH MTV Woori Việt Nam
  'Woori': '970457',
  'WVN': '970457',
  
  // Ngân hàng Kookmin - Chi nhánh Hà Nội
  'KookminHN': '970462',
  'KBHN': '970462',
  'Kookmin HN': '970462',
  
  // Ngân hàng Kookmin - Chi nhánh Thành phố Hồ Chí Minh
  'KookminHCM': '970463',
  'KBHCM': '970463',
  'Kookmin HCM': '970463',
  
  // Ngân hàng TNHH MTV HSBC (Việt Nam)
  'HSBC': '458761',
  
  // Ngân hàng TNHH MTV Hong Leong Việt Nam
  'HongLeong': '970442',
  'HLBVN': '970442',
  
  // Ngân hàng Thương mại TNHH MTV Dầu Khí Toàn Cầu
  'GPBank': '970408',
  'GPB': '970408',
  'Dau Khi': '970408',
  
  // Ngân hàng TMCP Đông Á
  'DongABank': '970406',
  'DOB': '970406',
  'Dong A': '970406',
  
  // DBS Bank Ltd
  'DBSBank': '796500',
  'DBS': '796500',
  
  // Ngân hàng TNHH MTV CIMB Việt Nam
  'CIMB': '422589',
  
  // Ngân hàng Thương mại TNHH MTV Xây dựng Việt Nam
  'CBBank': '970444',
  'CBB': '970444',
  'Xay Dung': '970444',
  
  // Ngân hàng Citibank, N.A.
  'Citibank': '533948',
  
  // Ngân hàng KEB Hana – Chi nhánh Thành phố Hồ Chí Minh
  'KEBHanaHCM': '970466',
  'KEBHANAHCM': '970466',
  'KEB Hana HCM': '970466',
  
  // Ngân hàng KEB Hana – Chi nhánh Hà Nội
  'KEBHANAHN': '970467',
  'KEBHanaHN': '970467',
  'KEB Hana HN': '970467',
  
  // Công ty Tài chính TNHH MTV Mirae Asset (Việt Nam)
  'MAFC': '977777',
  'Mirae Asset': '977777',
  
  // Ngân hàng Chính sách Xã hội
  'VBSP': '999888',
  'Chinh Sach Xa Hoi': '999888',
  
  // Ngân hàng TNHH MTV Việt Nam Hiện Đại
  'MBV': '970414',
  'Viet Nam Hien Dai': '970414',
  
  // Ngân hàng TNHH MTV Số Vikki
  'Vikki': '970406',
  'Vikki Bank': '970406'
};

/**
 * Tìm mã bank code từ tên ngân hàng
 * @param {String} bankName - Tên ngân hàng
 * @returns {String|null} - Mã bank code hoặc null nếu không tìm thấy
 */
const findBankCode = (bankName) => {
  if (!bankName) return null;
  
  // Chuẩn hóa tên ngân hàng
  const normalizedName = bankName.trim().toLowerCase();
  
  // Tìm kiếm exact match
  for (const [key, value] of Object.entries(bankMapping)) {
    if (key.toLowerCase() === normalizedName) {
      return value;
    }
  }
  
  // Tìm kiếm partial match
  for (const [key, value] of Object.entries(bankMapping)) {
    if (key.toLowerCase().includes(normalizedName) || normalizedName.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return null;
};

/**
 * Lấy tên ngân hàng đầy đủ từ mã bank code
 * @param {String} bankCode - Mã bank code
 * @returns {String|null} - Tên ngân hàng đầy đủ hoặc null nếu không tìm thấy
 */
const getBankName = (bankCode) => {
  if (!bankCode) return null;
  
  for (const [key, value] of Object.entries(bankMapping)) {
    if (value === bankCode) {
      return key;
    }
  }
  
  return null;
};

module.exports = {
  bankMapping,
  findBankCode,
  getBankName
};
