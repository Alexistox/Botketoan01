/**
 * /report h — lịch sử giao dịch theo từng phiên (từ lúc 上课), rich table kiểu Excel.
 */

const XLSX = require('xlsx');
const { formatSmart, formatDateUS, formatTimeString } = require('./formatter');

const LEDGER_TZ = 'Asia/Phnom_Penh';
/** Giữ dưới giới hạn ~500 blocks (mỗi hàng bảng = 1 block). */
const MAX_ROWS_PER_MESSAGE = 380;
const TYPE_LABELS = {
  deposit: '入账+',
  withdraw: '出款-',
  payment: '下发%',
  setRate: '费率',
  setExchangeRate: '汇率',
  setWithdrawRate: '出款费率',
  clear: '上课',
  delete: '撤回',
  skip: '跳过'
};

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripDetailsNoise(details) {
  return String(details || '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[*`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ledgerDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-CA', { timeZone: LEDGER_TZ }); // YYYY-MM-DD
}

function ledgerDateLabel(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LEDGER_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}/${m}/${day}`;
}

function formatCellTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return `${ledgerDateLabel(d)} ${formatTimeString(d)}`;
}

/**
 * Chia giao dịch thành các phiên theo mốc 上课 (type=clear).
 * Phiên = (clearStart, nextClear] ; phiên hiện tại kết thúc = now.
 * @param {Array<object>} transactions - đã sort tăng dần theo timestamp
 * @returns {Array<{ start: Date|null, end: Date, clearTx: object|null, txs: object[] }>}
 */
function groupTransactionsBySession(transactions) {
  const clears = transactions.filter((t) => t.type === 'clear');
  const sessions = [];

  if (clears.length === 0) {
    sessions.push({
      start: null,
      end: new Date(),
      clearTx: null,
      txs: transactions.filter((t) => t.type !== 'clear')
    });
    return sessions;
  }

  // Trước lần 上课 đầu: vẫn ghi nếu có giao dịch
  const firstClear = clears[0];
  const before = transactions.filter(
    (t) => t.type !== 'clear' && new Date(t.timestamp) <= new Date(firstClear.timestamp)
  );
  // Thực tế filter báo cáo dùng $gt lastClear — txs trước clear đầu hiếm; bỏ qua nếu rỗng
  if (before.length) {
    sessions.push({
      start: null,
      end: new Date(firstClear.timestamp),
      clearTx: null,
      txs: before
    });
  }

  for (let i = 0; i < clears.length; i += 1) {
    const start = new Date(clears[i].timestamp);
    const end =
      i + 1 < clears.length ? new Date(clears[i + 1].timestamp) : new Date();
    const txs = transactions.filter((t) => {
      if (t.type === 'clear') return false;
      const ts = new Date(t.timestamp).getTime();
      return ts > start.getTime() && ts <= end.getTime();
    });
    sessions.push({
      start,
      end,
      clearTx: clears[i],
      txs
    });
  }

  return sessions;
}

function summarizeSession(session) {
  const deposits = session.txs.filter((t) => t.type === 'deposit');
  const withdraws = session.txs.filter((t) => t.type === 'withdraw');
  const payments = session.txs.filter((t) => t.type === 'payment');
  const depositVnd = deposits.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const withdrawVnd = withdraws.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const paidUsdt = payments.reduce((s, t) => s + (Number(t.usdtAmount) || 0), 0);
  const depositUsdt = deposits.reduce((s, t) => s + (Number(t.usdtAmount) || 0), 0);
  const withdrawUsdt = withdraws.reduce((s, t) => s + (Number(t.usdtAmount) || 0), 0);
  return {
    depositCount: deposits.length,
    withdrawCount: withdraws.length,
    paymentCount: payments.length,
    depositVnd,
    withdrawVnd,
    depositUsdt,
    withdrawUsdt,
    paidUsdt,
    netVnd: depositVnd - withdrawVnd,
    shouldPayUsdt: depositUsdt - withdrawUsdt
  };
}

function sessionTitle(session, indexFromNewest, total) {
  const n = total - indexFromNewest;
  const startLabel = session.start
    ? `${ledgerDateLabel(session.start)} ${formatTimeString(session.start)}`
    : '起始';
  return `#${n} ${startLabel}`;
}

function buildOverviewTableHtml(sessionsNewestFirst, numberFormat) {
  let html =
    '<table border="1"><thead><tr>' +
    '<th>#</th><th>日期</th><th>上课开始</th><th>入账</th><th>出款</th><th>下发</th>' +
    '<th>入账VND</th><th>已下发</th><th>应下发</th>' +
    '</tr></thead><tbody>';

  sessionsNewestFirst.forEach((session, i) => {
    const s = summarizeSession(session);
    const titleNum = sessionsNewestFirst.length - i;
    html +=
      `<tr>` +
      `<td>${titleNum}</td>` +
      `<td>${escapeHtml(session.start ? ledgerDateLabel(session.start) : '—')}</td>` +
      `<td>${escapeHtml(session.start ? formatTimeString(session.start) : '—')}</td>` +
      `<td>${s.depositCount}</td>` +
      `<td>${s.withdrawCount}</td>` +
      `<td>${s.paymentCount}</td>` +
      `<td>${escapeHtml(formatSmart(s.depositVnd, numberFormat))}</td>` +
      `<td>${escapeHtml(formatSmart(s.paidUsdt, numberFormat))}</td>` +
      `<td>${escapeHtml(formatSmart(s.shouldPayUsdt, numberFormat))}</td>` +
      `</tr>`;
  });

  html += '</tbody></table>';
  return html;
}

function buildSessionDetailHtml(session, indexFromNewest, total, numberFormat) {
  const s = summarizeSession(session);
  const title = sessionTitle(session, indexFromNewest, total);
  const moneyTxs = session.txs.filter((t) =>
    ['deposit', 'withdraw', 'payment'].includes(t.type)
  );
  // Mới nhất trước trong bảng chi tiết
  const sorted = [...moneyTxs].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  let body =
    `<p><b>入账</b> ${s.depositCount}笔 / <b>出款</b> ${s.withdrawCount}笔 / <b>下发</b> ${s.paymentCount}笔<br>` +
    `入账VND: ${escapeHtml(formatSmart(s.depositVnd, numberFormat))} · ` +
    `应下发: ${escapeHtml(formatSmart(s.shouldPayUsdt, numberFormat))} · ` +
    `已下发: ${escapeHtml(formatSmart(s.paidUsdt, numberFormat))}</p>`;

  if (!sorted.length) {
    body += '<p><i>本场次无入账/下发记录</i></p>';
  } else {
    body +=
      '<table border="1"><thead><tr>' +
      '<th>#</th><th>类型</th><th>时间</th><th>VND</th><th>USDT</th><th>操作人</th><th>详情</th>' +
      '</tr></thead><tbody>';
    sorted.forEach((t, idx) => {
      const id = sorted.length - idx;
      const detail = stripDetailsNoise(t.details || t.message || '').slice(0, 80);
      body +=
        `<tr>` +
        `<td>${id}</td>` +
        `<td>${escapeHtml(TYPE_LABELS[t.type] || t.type)}</td>` +
        `<td>${escapeHtml(formatCellTime(t.timestamp))}</td>` +
        `<td>${t.amount ? escapeHtml(formatSmart(t.amount, numberFormat)) : '—'}</td>` +
        `<td>${t.usdtAmount ? escapeHtml(formatSmart(t.usdtAmount, numberFormat)) : '—'}</td>` +
        `<td>${escapeHtml(t.senderName || '')}</td>` +
        `<td>${escapeHtml(detail || '—')}</td>` +
        `</tr>`;
    });
    body += '</tbody></table>';
  }

  return (
    `<details>` +
    `<summary>${escapeHtml(title)} · 入账${s.depositCount}/下发${s.paymentCount}</summary>` +
    body +
    `</details>`
  );
}

/**
 * Ước số block (hàng bảng + heading/details) để chia tin.
 */
function estimateBlocks(html) {
  const rows = (html.match(/<tr[\s>]/gi) || []).length;
  const details = (html.match(/<details[\s>]/gi) || []).length;
  const headings = (html.match(/<h[1-6][\s>]/gi) || []).length;
  return rows + details + headings + 8;
}

/**
 * @param {{ chatId: string, currencyUnit?: string, numberFormat?: string, isPrivate?: boolean }} meta
 * @param {Array<object>} sessionsOldestFirst
 * @returns {string[]}
 */
function buildHistoryRichHtmlChunks(meta, sessionsOldestFirst) {
  const numberFormat = meta.numberFormat || 'formatted';
  const newestFirst = [...sessionsOldestFirst].reverse();
  const scope = meta.isPrivate ? '私聊' : '群组';
  const header =
    `<h2>📊 交易历史报表</h2>` +
    `<p>${escapeHtml(scope)} <code>${escapeHtml(meta.chatId)}</code> · ` +
    `单位 ${escapeHtml(meta.currencyUnit || 'USDT')} · ` +
    `共 ${newestFirst.length} 场（按上课分段）</p>` +
    `<h3>总览</h3>` +
    buildOverviewTableHtml(newestFirst, numberFormat);

  const chunks = [];
  let current =
    header + `<h3>明细</h3>`;

  if (!newestFirst.length) {
    return [header + `<p><i>暂无交易记录</i></p>`];
  }

  newestFirst.forEach((session, i) => {
    const detail = buildSessionDetailHtml(
      session,
      i,
      newestFirst.length,
      numberFormat
    );
    const trial = current + detail;
    if (estimateBlocks(trial) > MAX_ROWS_PER_MESSAGE && current !== header + `<h3>明细</h3>`) {
      chunks.push(current);
      current =
        `<h2>📊 交易历史报表 (续)</h2>` +
        `<p>${escapeHtml(scope)} <code>${escapeHtml(meta.chatId)}</code></p>` +
        detail;
    } else {
      current = trial;
    }
  });
  chunks.push(current);
  return chunks;
}

/**
 * Plain HTML fallback (không rich) — bảng rút gọn dạng text.
 */
function buildHistoryPlainFallback(meta, sessionsOldestFirst) {
  const numberFormat = meta.numberFormat || 'formatted';
  const newestFirst = [...sessionsOldestFirst].reverse();
  const scope = meta.isPrivate ? '私聊' : '群组';
  let out =
    `<b>📊 交易历史报表</b>\n` +
    `${escapeHtml(scope)} <code>${escapeHtml(meta.chatId)}</code>\n` +
    `共 ${newestFirst.length} 场（按上课分段）\n\n`;

  newestFirst.forEach((session, i) => {
    const s = summarizeSession(session);
    out +=
      `<b>${escapeHtml(sessionTitle(session, i, newestFirst.length))}</b>\n` +
      `入账${s.depositCount} / 出款${s.withdrawCount} / 下发${s.paymentCount}\n` +
      `入账VND ${escapeHtml(formatSmart(s.depositVnd, numberFormat))} · ` +
      `应下发 ${escapeHtml(formatSmart(s.shouldPayUsdt, numberFormat))} · ` +
      `已下发 ${escapeHtml(formatSmart(s.paidUsdt, numberFormat))}\n`;

    const moneyTxs = session.txs
      .filter((t) => ['deposit', 'withdraw', 'payment'].includes(t.type))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    moneyTxs.slice(0, 40).forEach((t, idx) => {
      const id = moneyTxs.length - idx;
      const amt =
        t.type === 'payment'
          ? formatSmart(t.usdtAmount || 0, numberFormat)
          : formatSmart(t.amount || 0, numberFormat);
      out +=
        `${id}. ${escapeHtml(TYPE_LABELS[t.type] || t.type)} ` +
        `${escapeHtml(formatTimeString(new Date(t.timestamp)))} ` +
        `${escapeHtml(amt)} · ${escapeHtml(t.senderName || '')}\n`;
    });
    if (moneyTxs.length > 40) {
      out += `…还有 ${moneyTxs.length - 40} 笔\n`;
    }
    out += '\n';
  });

  return out.trim() || '暂无交易记录';
}

/**
 * Tạo file Excel (.xlsx) buffer — dashboard kiểu spreadsheet.
 * @returns {{ buffer: Buffer, filename: string }}
 */
function buildHistoryExcelBuffer(meta, sessionsOldestFirst) {
  const numberFormat = meta.numberFormat || 'formatted';
  const newestFirst = [...sessionsOldestFirst].reverse();
  const wb = XLSX.utils.book_new();

  const overviewRows = [
    ['#', '日期', '上课开始', '入账笔', '出款笔', '下发笔', '入账VND', '出款VND', '应下发USDT', '已下发USDT']
  ];
  newestFirst.forEach((session, i) => {
    const s = summarizeSession(session);
    overviewRows.push([
      newestFirst.length - i,
      session.start ? ledgerDateLabel(session.start) : '—',
      session.start ? formatTimeString(session.start) : '—',
      s.depositCount,
      s.withdrawCount,
      s.paymentCount,
      s.depositVnd,
      s.withdrawVnd,
      s.shouldPayUsdt,
      s.paidUsdt
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewRows), '总览');

  const detailRows = [
    ['场次', '日期', '类型', '时间', 'VND', 'USDT', '操作人', '详情', 'messageId']
  ];
  newestFirst.forEach((session, i) => {
    const label = sessionTitle(session, i, newestFirst.length);
    const day = session.start ? ledgerDateLabel(session.start) : '—';
    const moneyTxs = session.txs
      .filter((t) => ['deposit', 'withdraw', 'payment'].includes(t.type))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    moneyTxs.forEach((t) => {
      detailRows.push([
        label,
        day,
        TYPE_LABELS[t.type] || t.type,
        formatCellTime(t.timestamp),
        t.amount || 0,
        t.usdtAmount || 0,
        t.senderName || '',
        stripDetailsNoise(t.details || t.message || ''),
        t.messageId || ''
      ]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), '明细');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const day = formatDateUS(new Date()).replace(/\//g, '');
  const filename = `report-h-${meta.chatId}-${day}.xlsx`;
  return { buffer: Buffer.from(buf), filename, numberFormat };
}

function isRichUnsupportedError(err) {
  const msg = String((err && (err.message || err.description || err.response?.body?.description)) || err || '');
  return (
    /rich/i.test(msg) ||
    /unknown method/i.test(msg) ||
    /no such method/i.test(msg) ||
    /Bad Request/i.test(msg) ||
    /can't parse/i.test(msg) ||
    /ETELEGRAM/i.test(msg)
  );
}

/**
 * Gửi rich HTML; fallback sendMessage HTML.
 */
async function sendRichHtml(bot, chatId, html) {
  try {
    await bot._request('sendRichMessage', {
      form: {
        chat_id: chatId,
        rich_message: JSON.stringify({
          html,
          skip_entity_detection: true
        })
      }
    });
    return 'rich';
  } catch (err) {
    console.warn(
      '[reportHistory] sendRichMessage failed:',
      err && err.message ? err.message : err
    );
    if (!isRichUnsupportedError(err)) {
      console.warn('[reportHistory] unexpected rich error, falling back');
    }
    return null;
  }
}

module.exports = {
  LEDGER_TZ,
  groupTransactionsBySession,
  summarizeSession,
  buildHistoryRichHtmlChunks,
  buildHistoryPlainFallback,
  buildHistoryExcelBuffer,
  sendRichHtml,
  ledgerDateLabel,
  formatCellTime
};
