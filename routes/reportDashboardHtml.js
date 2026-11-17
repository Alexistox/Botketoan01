/**
 * HTML dashboard báo cáo nhóm/chat — phân phiên theo 上课, hỗ trợ VI/中文.
 */

const {
  groupTransactionsBySession,
  summarizeSession,
  ledgerDateLabel,
  formatCellTime
} = require('../utils/reportHistory');
const { formatSmart, formatTimeString } = require('../utils/formatter');

const TYPE_COLORS = {
  deposit: '#0f7b4a',
  withdraw: '#c0392b',
  payment: '#b7791f',
  setRate: '#5b4b8a',
  setExchangeRate: '#5b4b8a',
  setWithdrawRate: '#5b4b8a',
  clear: '#4a5568',
  delete: '#c0392b',
  skip: '#2b6cb0'
};

const I18N = {
  vi: {
    title: 'Bảng báo cáo giao dịch',
    scopeGroup: 'Sổ nhóm',
    scopeDm: 'Sổ chat riêng',
    unit: 'Đơn vị',
    generated: 'Tạo lúc',
    sessions: 'Phiên 上课',
    moneyCount: 'Số giao dịch',
    deposits: 'Nhập',
    withdraws: 'Xuất',
    payments: 'Xuất USDT',
    totalDepositVnd: 'Tổng nhập VND',
    totalPaid: 'Tổng đã xuất',
    overview: 'Tổng quan phiên (theo 上课)',
    colDate: 'Ngày',
    colStart: 'Bắt đầu 上课',
    colDeposit: 'Nhập',
    colWithdraw: 'Xuất',
    colPayment: 'Xuất USDT',
    colDepositVnd: 'Nhập VND',
    colShouldPay: 'Cần xuất',
    colPaid: 'Đã xuất',
    colType: 'Loại',
    colTime: 'Thời gian',
    colOperator: 'Người',
    colDetail: 'Chi tiết',
    emptySession: 'Phiên này chưa có nhập/xuất',
    emptyAll: 'Chưa có giao dịch',
    emptyOverview: 'Chưa có phiên',
    foot: 'Link còn hiệu lực 24 giờ · Do bot kế toán tạo',
    langVi: 'Tiếng Việt',
    langZh: '中文',
    startFallback: 'Đầu sổ',
    sessionMeta:
      'Nhập {d} · Xuất {w} · Xuất USDT {p} · Nhập VND {dv} · Cần xuất {sp} · Đã xuất {pd}',
    types: {
      deposit: 'Nhập +',
      withdraw: 'Xuất -',
      payment: 'Xuất %',
      setRate: 'Set phí',
      setExchangeRate: 'Set tỷ giá',
      setWithdrawRate: 'Phí xuất',
      clear: '上课',
      delete: 'Thu hồi',
      skip: 'Bỏ qua'
    }
  },
  zh: {
    title: '交易仪表盘',
    scopeGroup: '群组账本',
    scopeDm: '私聊账本',
    unit: '单位',
    generated: '生成',
    sessions: '上课场次',
    moneyCount: '资金笔数',
    deposits: '入账',
    withdraws: '出款',
    payments: '下发',
    totalDepositVnd: '总入账 VND',
    totalPaid: '总下发',
    overview: '场次总览（按上课分段）',
    colDate: '日期',
    colStart: '上课开始',
    colDeposit: '入账',
    colWithdraw: '出款',
    colPayment: '下发',
    colDepositVnd: '入账VND',
    colShouldPay: '应下发',
    colPaid: '已下发',
    colType: '类型',
    colTime: '时间',
    colOperator: '操作人',
    colDetail: '详情',
    emptySession: '本场次无入账/下发记录',
    emptyAll: '暂无交易记录',
    emptyOverview: '暂无场次数据',
    foot: '链接 24 小时内有效 · 由记账机器人生成',
    langVi: 'Tiếng Việt',
    langZh: '中文',
    startFallback: '起始',
    sessionMeta:
      '入账 {d} · 出款 {w} · 下发 {p} · 入账VND {dv} · 应下发 {sp} · 已下发 {pd}',
    types: {
      deposit: '入账 +',
      withdraw: '出款 -',
      payment: '下发 %',
      setRate: '设置费率',
      setExchangeRate: '设置汇率',
      setWithdrawRate: '出款费率',
      clear: '上课',
      delete: '撤回',
      skip: '跳过'
    }
  }
};

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripDetails(details) {
  return String(details || '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[*`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dual(key, extraAttr = '') {
  const vi = escapeHtml(I18N.vi[key] || key);
  const zh = escapeHtml(I18N.zh[key] || key);
  // Mặc định hiện tiếng Trung
  return `<span data-i18n="${escapeHtml(key)}"${extraAttr} data-vi="${vi}" data-zh="${zh}">${zh}</span>`;
}

/**
 * @param {Array<object>} transactions
 * @param {string} chatId
 * @param {{ currencyUnit?: string, numberFormat?: string }} [opts]
 */
function generateReportDashboardHTML(transactions, chatId, opts = {}) {
  const numberFormat = opts.numberFormat || 'formatted';
  const currencyUnit = opts.currencyUnit || 'USDT';
  const isPrivate = !String(chatId).startsWith('-');

  const sortedAsc = [...transactions].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  const sessions = groupTransactionsBySession(sortedAsc);
  const newestFirst = [...sessions].reverse();

  const allMoney = transactions.filter((t) =>
    ['deposit', 'withdraw', 'payment'].includes(t.type)
  );
  const stats = {
    total: allMoney.length,
    deposits: allMoney.filter((t) => t.type === 'deposit').length,
    withdraws: allMoney.filter((t) => t.type === 'withdraw').length,
    payments: allMoney.filter((t) => t.type === 'payment').length,
    totalVND: allMoney
      .filter((t) => t.type === 'deposit')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0),
    totalUSDT: allMoney
      .filter((t) => t.type === 'payment')
      .reduce((s, t) => s + (Number(t.usdtAmount) || 0), 0),
    sessions: sessions.length
  };

  const overviewRows = newestFirst
    .map((session, i) => {
      const s = summarizeSession(session);
      const n = newestFirst.length - i;
      const startDay = session.start ? ledgerDateLabel(session.start) : '—';
      const startTime = session.start ? formatTimeString(session.start) : '—';
      return `
        <tr>
          <td>${n}</td>
          <td>${escapeHtml(startDay)}</td>
          <td>${escapeHtml(startTime)}</td>
          <td>${s.depositCount}</td>
          <td>${s.withdrawCount}</td>
          <td>${s.paymentCount}</td>
          <td class="num">${escapeHtml(formatSmart(s.depositVnd, numberFormat))}</td>
          <td class="num">${escapeHtml(formatSmart(s.shouldPayUsdt, numberFormat))}</td>
          <td class="num">${escapeHtml(formatSmart(s.paidUsdt, numberFormat))}</td>
        </tr>`;
    })
    .join('');

  const sessionSections = newestFirst
    .map((session, i) => {
      const s = summarizeSession(session);
      const n = newestFirst.length - i;
      const titleDay = session.start ? ledgerDateLabel(session.start) : '';
      const titleTime = session.start ? formatTimeString(session.start) : '';
      const moneyTxs = session.txs
        .filter((t) => ['deposit', 'withdraw', 'payment'].includes(t.type))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const rows = moneyTxs
        .map((t, idx) => {
          const id = moneyTxs.length - idx;
          const color = TYPE_COLORS[t.type] || '#4a5568';
          const detail = stripDetails(t.details || t.message || '').slice(0, 120);
          const typeVi = escapeHtml(I18N.vi.types[t.type] || t.type);
          const typeZh = escapeHtml(I18N.zh.types[t.type] || t.type);
          return `
            <tr>
              <td>${id}</td>
              <td><span class="badge" style="background:${color}" data-type="${escapeHtml(
                t.type
              )}" data-vi="${typeVi}" data-zh="${typeZh}">${typeZh}</span></td>
              <td>${escapeHtml(formatCellTime(t.timestamp))}</td>
              <td class="num">${
                t.amount
                  ? escapeHtml(formatSmart(t.amount, numberFormat))
                  : '—'
              }</td>
              <td class="num">${
                t.usdtAmount
                  ? escapeHtml(formatSmart(t.usdtAmount, numberFormat))
                  : '—'
              }</td>
              <td>${escapeHtml(t.senderName || '')}</td>
              <td class="msg">${escapeHtml(detail || '—')}</td>
            </tr>`;
        })
        .join('');

      const dv = escapeHtml(formatSmart(s.depositVnd, numberFormat));
      const sp = escapeHtml(formatSmart(s.shouldPayUsdt, numberFormat));
      const pd = escapeHtml(formatSmart(s.paidUsdt, numberFormat));
      const metaVi = I18N.vi.sessionMeta
        .replace('{d}', String(s.depositCount))
        .replace('{w}', String(s.withdrawCount))
        .replace('{p}', String(s.paymentCount))
        .replace('{dv}', `<b>${dv}</b>`)
        .replace('{sp}', `<b>${sp}</b> ${escapeHtml(currencyUnit)}`)
        .replace('{pd}', `<b>${pd}</b>`);
      const metaZh = I18N.zh.sessionMeta
        .replace('{d}', String(s.depositCount))
        .replace('{w}', String(s.withdrawCount))
        .replace('{p}', String(s.paymentCount))
        .replace('{dv}', `<b>${dv}</b>`)
        .replace('{sp}', `<b>${sp}</b> ${escapeHtml(currencyUnit)}`)
        .replace('{pd}', `<b>${pd}</b>`);
      const attrEscape = (html) =>
        String(html).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

      return `
        <section class="session" id="session-${n}">
          <header class="session-head">
            <h2>#${n} · ${
              titleDay
                ? `${escapeHtml(titleDay)} ${escapeHtml(titleTime)}`
                : dual('startFallback')
            }</h2>
            <p class="session-meta" data-vi="${attrEscape(metaVi)}" data-zh="${attrEscape(
              metaZh
            )}">${metaZh}</p>
          </header>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>${dual('colType')}</th>
                  <th>${dual('colTime')}</th>
                  <th>VND</th>
                  <th>USDT</th>
                  <th>${dual('colOperator')}</th>
                  <th>${dual('colDetail')}</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows ||
                  `<tr><td colspan="7" class="empty">${dual('emptySession')}</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </section>`;
    })
    .join('');

  const generatedAt = escapeHtml(formatCellTime(new Date()));
  const i18nJson = JSON.stringify(I18N).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title data-i18n-title>${escapeHtml(I18N.zh.title)} · ${escapeHtml(chatId)}</title>
  <style>
    :root {
      --bg: #f3efe6;
      --ink: #1c1917;
      --muted: #6b635a;
      --card: #fffdf8;
      --line: #e2d8c8;
      --accent: #0f5c4c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Be Vietnam Pro", "Noto Sans SC", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(900px 420px at 10% -10%, #d9efe6 0%, transparent 55%),
        radial-gradient(700px 380px at 100% 0%, #f3d9c6 0%, transparent 50%),
        var(--bg);
      line-height: 1.5;
    }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 28px 18px 48px; }
    .hero {
      padding: 28px 24px;
      border: 1px solid var(--line);
      background: linear-gradient(135deg, #0f5c4c 0%, #1a7a5c 55%, #2d6a4f 100%);
      color: #f7fffb;
      border-radius: 4px;
      margin-bottom: 22px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .hero h1 { margin: 0 0 8px; font-size: 1.75rem; letter-spacing: 0.02em; }
    .hero p { margin: 0; opacity: 0.92; }
    .lang-switch { display: flex; border: 1px solid rgba(255,255,255,0.35); border-radius: 6px; overflow: hidden; flex-shrink: 0; }
    .lang-btn {
      appearance: none; border: 0; background: transparent; color: #e8fff6;
      padding: 8px 12px; font: inherit; cursor: pointer;
    }
    .lang-btn.active { background: #fff; color: var(--accent); font-weight: 700; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 22px;
    }
    .stat {
      background: var(--card);
      border: 1px solid var(--line);
      padding: 14px 12px;
      border-radius: 4px;
    }
    .stat .n { font-size: 1.45rem; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
    .stat .l { color: var(--muted); font-size: 0.85rem; margin-top: 2px; }
    .panel {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 4px;
      margin-bottom: 18px;
      overflow: hidden;
    }
    .panel h2, .session-head h2 { margin: 0; font-size: 1.1rem; }
    .panel-h, .session-head {
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      background: #faf6ef;
    }
    .session-head p { margin: 6px 0 0; color: var(--muted); font-size: 0.92rem; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); background: #f7f2e9; }
    tr:hover td { background: #fcfaf5; }
    .num { font-variant-numeric: tabular-nums; font-family: "IBM Plex Mono", ui-monospace, monospace; text-align: right; white-space: nowrap; }
    .badge {
      display: inline-block; color: #fff; padding: 2px 8px; border-radius: 3px;
      font-size: 0.78rem; font-weight: 600; white-space: nowrap;
    }
    .msg { max-width: 280px; color: var(--muted); word-break: break-word; }
    .empty { text-align: center; color: var(--muted); padding: 24px !important; }
    .foot { text-align: center; color: var(--muted); font-size: 0.85rem; margin-top: 20px; }
    .session { margin-bottom: 18px; background: var(--card); border: 1px solid var(--line); border-radius: 4px; overflow: hidden; }
    @media (max-width: 640px) {
      .hero h1 { font-size: 1.35rem; }
      th, td { padding: 8px; }
      .msg { max-width: 140px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div>
        <h1>${dual('title')}</h1>
        <p>
          <span data-i18n="${isPrivate ? 'scopeDm' : 'scopeGroup'}"
            data-vi="${escapeHtml(isPrivate ? I18N.vi.scopeDm : I18N.vi.scopeGroup)}"
            data-zh="${escapeHtml(isPrivate ? I18N.zh.scopeDm : I18N.zh.scopeGroup)}">${escapeHtml(
              isPrivate ? I18N.zh.scopeDm : I18N.zh.scopeGroup
            )}</span>
          · ID <code>${escapeHtml(chatId)}</code>
          · ${dual('unit')} ${escapeHtml(currencyUnit)}
          · ${dual('generated')} ${generatedAt}
        </p>
      </div>
      <div class="lang-switch" role="group" aria-label="Language">
        <button type="button" class="lang-btn" id="langVi" data-lang="vi">${escapeHtml(
          I18N.vi.langVi
        )}</button>
        <button type="button" class="lang-btn active" id="langZh" data-lang="zh">${escapeHtml(
          I18N.zh.langZh
        )}</button>
      </div>
    </header>

    <div class="stats">
      <div class="stat"><div class="n">${stats.sessions}</div><div class="l">${dual('sessions')}</div></div>
      <div class="stat"><div class="n">${stats.total}</div><div class="l">${dual('moneyCount')}</div></div>
      <div class="stat"><div class="n">${stats.deposits}</div><div class="l">${dual('deposits')}</div></div>
      <div class="stat"><div class="n">${stats.withdraws}</div><div class="l">${dual('withdraws')}</div></div>
      <div class="stat"><div class="n">${stats.payments}</div><div class="l">${dual('payments')}</div></div>
      <div class="stat"><div class="n">${escapeHtml(formatSmart(stats.totalVND, numberFormat))}</div><div class="l">${dual('totalDepositVnd')}</div></div>
      <div class="stat"><div class="n">${escapeHtml(formatSmart(stats.totalUSDT, numberFormat))}</div><div class="l">${dual('totalPaid')} ${escapeHtml(currencyUnit)}</div></div>
    </div>

    <section class="panel">
      <div class="panel-h"><h2>${dual('overview')}</h2></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${dual('colDate')}</th>
              <th>${dual('colStart')}</th>
              <th>${dual('colDeposit')}</th>
              <th>${dual('colWithdraw')}</th>
              <th>${dual('colPayment')}</th>
              <th>${dual('colDepositVnd')}</th>
              <th>${dual('colShouldPay')}</th>
              <th>${dual('colPaid')}</th>
            </tr>
          </thead>
          <tbody>
            ${
              overviewRows ||
              `<tr><td colspan="9" class="empty">${dual('emptyOverview')}</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>

    ${sessionSections || `<p class="empty">${dual('emptyAll')}</p>`}

    <p class="foot">${dual('foot')}</p>
  </div>
  <script>
    (function () {
      var I18N = ${i18nJson};
      var lang = localStorage.getItem('report_dash_lang') || 'zh';
      try {
        var q = new URLSearchParams(location.search).get('lang');
        if (q === 'vi' || q === 'zh') lang = q;
      } catch (e) {}

      function applyLang(next) {
        lang = next === 'vi' ? 'vi' : 'zh';
        localStorage.setItem('report_dash_lang', lang);
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'vi';
        document.getElementById('langVi').classList.toggle('active', lang === 'vi');
        document.getElementById('langZh').classList.toggle('active', lang === 'zh');

        document.querySelectorAll('[data-vi][data-zh]').forEach(function (el) {
          var html = lang === 'zh' ? el.getAttribute('data-zh') : el.getAttribute('data-vi');
          if (html != null) el.innerHTML = html;
        });

        var t = (I18N[lang] && I18N[lang].title) || I18N.zh.title;
        document.title = t + ' · ${escapeHtml(chatId)}';
      }

      document.getElementById('langVi').addEventListener('click', function () { applyLang('vi'); });
      document.getElementById('langZh').addEventListener('click', function () { applyLang('zh'); });
      applyLang(lang);
    })();
  </script>
</body>
</html>`;
}

module.exports = { generateReportDashboardHTML, I18N };
