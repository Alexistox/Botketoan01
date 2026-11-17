/**
 * Dịch Trung → Việt: Google gtx → MyMemory fallback, có cache + từ điển cụm bot.
 */

const axios = require('axios');

const cache = new Map();
const MAX_CACHE = 2000;
const HAN_RE = /[\u3400-\u9FFF]/;

/** Cụm hay gặp trong bot kế toán — dịch ổn định không phụ thuộc API */
const PHRASE_MAP = {
  交易报告链接: 'Liên kết báo cáo giao dịch',
  交易仪表盘: 'Bảng báo cáo giao dịch',
  交易仪表盘链接: 'Liên kết bảng báo cáo giao dịch',
  打开网页报表: 'Mở báo cáo web',
  点击打开网页报表: 'Bấm để mở báo cáo web',
  群组: 'Nhóm',
  私聊: 'Chat riêng',
  交易: 'Giao dịch',
  上课: 'Bắt đầu phiên (上课)',
  已入账: 'Đã nhập',
  已下发: 'Đã xuất',
  应下发: 'Cần xuất',
  未下发: 'Chưa xuất',
  总入款: 'Tổng nhập',
  总出款: 'Tổng xuất',
  链接有效期: 'Thời hạn link',
  小时: 'giờ',
  仅持有链接者可查看: 'Chỉ người có link mới xem được',
  没有可用的数据: 'Không có dữ liệu',
  暂无交易记录: 'Chưa có giao dịch',
  生成报告链接时出错: 'Lỗi khi tạo link báo cáo',
  请稍后重试: 'Vui lòng thử lại sau',
  只有操作员或管理员可以使用: 'Chỉ operator/admin được dùng',
  MessageLogs: 'Message Logs',
  消息日志: 'Nhật ký tin nhắn'
};

function containsChinese(text) {
  return HAN_RE.test(String(text || ''));
}

function cacheSet(key, value) {
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  cache.set(key, value);
}

function applyPhraseHints(text) {
  let out = String(text || '');
  // Thay cụm dài trước
  const keys = Object.keys(PHRASE_MAP).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (out.includes(k)) out = out.split(k).join(PHRASE_MAP[k]);
  }
  return out;
}

async function translateViaGoogle(text) {
  const { data, status } = await axios.get(
    'https://translate.googleapis.com/translate_a/single',
    {
      params: {
        client: 'gtx',
        sl: 'zh-CN',
        tl: 'vi',
        dt: 't',
        q: text.slice(0, 4500)
      },
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BotKetoan/1.0)' },
      validateStatus: () => true
    }
  );
  if (status !== 200 || !Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('google_translate_failed_' + status);
  }
  return data[0]
    .map((part) => (Array.isArray(part) ? part[0] : ''))
    .join('')
    .trim();
}

async function translateViaMyMemory(text) {
  const { data, status } = await axios.get(
    'https://api.mymemory.translated.net/get',
    {
      params: {
        q: text.slice(0, 450),
        langpair: 'zh-CN|vi'
      },
      timeout: 12000,
      validateStatus: () => true
    }
  );
  if (status !== 200 || !data || !data.responseData) {
    throw new Error('mymemory_failed_' + status);
  }
  const out = String(data.responseData.translatedText || '').trim();
  if (!out || /MYMEMORY WARNING/i.test(out)) {
    throw new Error('mymemory_empty');
  }
  return out;
}

/**
 * @param {string} text
 * @returns {Promise<string>}
 */
async function translateZhToVi(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (!containsChinese(raw)) return raw;
  if (cache.has(raw)) return cache.get(raw);

  // Cụm ngắn khớp dictionary
  if (PHRASE_MAP[raw]) {
    cacheSet(raw, PHRASE_MAP[raw]);
    return PHRASE_MAP[raw];
  }

  let out = '';
  try {
    out = await translateViaGoogle(raw);
  } catch (_) {
    try {
      out = await translateViaMyMemory(raw);
    } catch (err2) {
      console.warn(
        '[zhToVi] fallback phrase-map only:',
        err2 && err2.message ? err2.message : err2
      );
      out = applyPhraseHints(raw);
    }
  }

  out = String(out || '').trim() || raw;
  // Nếu API trả lại gần như nguyên văn, vẫn thử phrase map
  if (containsChinese(out)) {
    const hinted = applyPhraseHints(out);
    if (hinted !== out) out = hinted;
  }

  cacheSet(raw, out);
  return out;
}

/**
 * @param {string[]} texts
 * @returns {Promise<string[]>}
 */
async function translateZhToViBatch(texts) {
  const list = Array.isArray(texts) ? texts : [];
  const results = new Array(list.length).fill('');
  const pending = [];

  for (let i = 0; i < list.length; i += 1) {
    const t = String(list[i] == null ? '' : list[i]);
    if (!containsChinese(t)) {
      results[i] = t;
      continue;
    }
    if (cache.has(t)) {
      results[i] = cache.get(t);
      continue;
    }
    pending.push(i);
  }

  const CONCURRENCY = 3;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const slice = pending.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (idx) => {
        try {
          results[idx] = await translateZhToVi(list[idx]);
        } catch (err) {
          console.warn('[zhToVi]', err && err.message ? err.message : err);
          results[idx] = applyPhraseHints(String(list[idx] || ''));
        }
      })
    );
  }

  return results;
}

module.exports = {
  containsChinese,
  translateZhToVi,
  translateZhToViBatch
};
