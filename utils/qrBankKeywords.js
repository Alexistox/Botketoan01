/**
 * Nhận dạng label đa ngôn ngữ cho tin nhắn VietQR (key : value).
 */

const { parseSpecialNumber } = require('./formatter');
const { findBankCode } = require('./bankMapping');

/** Chuẩn hóa phần key trước dấu : */
function normalizeKey(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[：]/g, ':');
}

/** Có phải dòng key-value không */
function splitKeyValue(line) {
  const m = line.match(/^(.+?)[:：]\s*(.*)$/);
  if (!m) return null;
  return { key: m[1].trim(), value: m[2].trim() };
}

const FIELD_SYNONYMS = {
  account: [
    '账号',
    '帐号',
    'số tk',
    'so tk',
    'stk',
    'số tài khoản',
    'so tai khoan',
    'account number',
    'account no',
    'account',
    '卡号',
    'số thẻ',
    'so the'
  ],
  accountName: [
    '持卡人姓名',
    'tên chủ thẻ',
    'ten chu the',
    'tên chủ tk',
    'ten chu tk',
    'tên',
    'ten',
    'chủ tk',
    'chu tk',
    'account name',
    'holder',
    'holder name',
    'tên chủ tài khoản',
    'ten chu tai khoan',
    '姓名'
  ],
  bank: [
    '银行名称',
    'ngân hàng',
    'ngan hang',
    'bank',
    'tên ngân hàng',
    'ten ngan hang',
    '银行'
  ],
  amount: [
    '金额',
    'số tiền',
    'so tien',
    'amount',
    'money',
    'số tiền ck',
    'so tien ck'
  ],
  note: [
    '备注',
    'ghi chú',
    'ghi chu',
    'note',
    'nội dung',
    'noi dung',
    'nội dung ck',
    'noi dung ck',
    'content'
  ]
};

/** Tìm field: ưu tiên synonym dài nhất khớp prefix/exact */
function matchField(normalizedKey) {
  let best = null;
  let bestLen = -1;
  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    for (const syn of synonyms) {
      const s = syn.toLowerCase();
      if (normalizedKey === s || normalizedKey.startsWith(`${s} `) || normalizedKey.startsWith(`${s}:`)) {
        if (s.length > bestLen) {
          bestLen = s.length;
          best = field;
        }
      }
    }
  }
  return best;
}

/**
 * Dòng dạng "stk 2349785", "ten Ha van tien" (không có dấu :)
 * Chỉ trả về nếu từ đầu khớp synonym (tránh nhầm câu thường).
 */
function splitKeyValueSpace(line) {
  const m = String(line).match(/^(\S+)\s+(.+)$/);
  if (!m) return null;
  const nk = normalizeKey(m[1]);
  if (!matchField(nk)) return null;
  return { key: m[1].trim(), value: m[2].trim() };
}

/** Dòng chỉ là tên ngân hàng (bidv, Vietcombank) — không có nhãn */
function isBankOnlyLine(line) {
  const t = String(line).trim();
  return t.length > 0 && !!findBankCode(t);
}

/**
 * Dòng số không nhãn: phần đầu thường là số tiền, phần sau là ghi chú (vd 12000000 rồi 5623).
 */
function parseUnlabeledTail(unlabeled, accountNumber) {
  let amount = 0;
  let note = '';
  if (!unlabeled || !unlabeled.length) return { amount, note };

  const remaining = unlabeled.map((l) => l.trim()).filter(Boolean);
  let i = 0;

  const isLikelyAmountLine = (line) => {
    if (!/^\d+$/.test(line)) return false;
    const parsed = parseSpecialNumber(line);
    if (Number.isNaN(parsed) || parsed <= 0) return false;
    const digits = line.replace(/\D/g, '');
    if (accountNumber && digits === String(accountNumber).replace(/\D/g, '')) return false;
    if (line.length < 5) return false;
    return true;
  };

  while (i < remaining.length) {
    const line = remaining[i];
    if (isLikelyAmountLine(line)) {
      amount = parseSpecialNumber(line);
      i += 1;
      break;
    }
    break;
  }

  if (i < remaining.length) {
    note = remaining.slice(i).join(' ').trim();
  }

  return { amount, note };
}

/** Lấy chuỗi số tài khoản (6–16 chữ số, giữ số 0 đầu) */
function extractAccountDigits(value) {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length >= 6 && digits.length <= 16) return digits;
  const m = String(value).match(/\d{6,16}/);
  return m ? m[0] : '';
}

/** Chuẩn hóa phần số tiền trước khi parseSpecialNumber */
function normalizeAmountRaw(value) {
  let s = String(value)
    .replace(/\b(vnd|đ|dong|vnđ|vnd\.)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Định dạng VN: 500.000, 1.234.567 (dấu chấm phân cách nghìn; tránh nhầm với 0.001)
  const vnThousands = s.replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(vnThousands)) {
    return vnThousands.replace(/\./g, '');
  }
  const oneDot = vnThousands.match(/^(\d{1,3})\.(\d{3})$/);
  if (oneDot && oneDot[1] !== '0') {
    return oneDot[1] + oneDot[2];
  }

  return s;
}

/**
 * Parse tin nhắn có nhãn: "key : value", "key：value", hoặc "key value" (cùng dòng).
 * Có thể kèm dòng không nhãn (số tiền + ghi chú) ở cuối.
 */
function parseBankInfoFromLabels(messageText) {
  if (!messageText) {
    return null;
  }

  const lines = messageText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let accountNumber = '';
  let accountName = '';
  let bankName = '';
  let amount = 0;
  let note = '';

  let anyLabeled = false;
  const unlabeled = [];

  const applyField = (field, val) => {
    switch (field) {
      case 'account':
        accountNumber = extractAccountDigits(val) || accountNumber;
        break;
      case 'accountName':
        if (val) accountName = val;
        break;
      case 'bank':
        if (val) bankName = val;
        break;
      case 'amount': {
        const raw = normalizeAmountRaw(val);
        const n = parseSpecialNumber(raw);
        if (!Number.isNaN(n) && n > 0) amount = n;
        break;
      }
      case 'note':
        if (val) note = val;
        break;
      default:
        break;
    }
  };

  for (const line of lines) {
    let kv = splitKeyValue(line);
    if (!kv) kv = splitKeyValueSpace(line);

    if (kv) {
      const nk = normalizeKey(kv.key);
      const field = matchField(nk);
      if (field) {
        anyLabeled = true;
        applyField(field, kv.value);
        continue;
      }
    }

    if (isBankOnlyLine(line)) {
      anyLabeled = true;
      bankName = line.trim();
      continue;
    }

    unlabeled.push(line);
  }

  if (!anyLabeled) {
    return null;
  }

  const tail = parseUnlabeledTail(unlabeled, accountNumber);
  if (amount === 0 && tail.amount > 0) {
    amount = tail.amount;
  }
  if (tail.note) {
    note = note ? `${note} ${tail.note}`.trim() : tail.note;
  }

  if (!accountNumber || !accountName || !bankName) {
    return null;
  }

  if (!findBankCode(bankName)) {
    return null;
  }

  return {
    accountNumber,
    accountName,
    bankName,
    amount,
    note
  };
}

module.exports = {
  parseBankInfoFromLabels,
  normalizeKey,
  FIELD_SYNONYMS,
  splitKeyValueSpace,
  parseUnlabeledTail
};
