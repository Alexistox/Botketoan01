/**
 * HTML dashboard Message Logs (token-protected).
 * @param {string} token
 * @param {number} hoursLeft
 */
const { getI18nBundle } = require('./messagelogsI18n');

function generateDashboardHTML(token, hoursLeft) {
  const safeToken = String(token).replace(/[<>"'&]/g, '');
  const i18nJson = JSON.stringify(getI18nBundle());
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Message Logs</title>
  <style>
    :root {
      --bg: #0e1621;
      --sidebar: #17212b;
      --chat-bg: #0e1621;
      --panel: #17212b;
      --panel2: #232e3c;
      --border: #0e1621;
      --text: #f5f5f5;
      --muted: #708499;
      --accent: #2AABEE;
      --bubble: #182533;
      --bubble-out: #2b5278;
      --green: #4fae4e;
      --orange: #ff7a00;
      --name: #6ab3f3;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Roboto", "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      overflow: hidden;
    }
    header.app-bar {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
      padding: 10px 14px; background: var(--sidebar); border-bottom: 1px solid #0b121a;
      z-index: 20; flex-shrink: 0;
    }
    header h1 { margin: 0; font-size: 1.05rem; font-weight: 600; }
    .header-right { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    .lang-switch { display: flex; border: 1px solid #2b3847; border-radius: 8px; overflow: hidden; }
    .lang-btn {
      background: transparent; color: var(--muted); border: none; padding: 6px 12px;
      cursor: pointer; font: inherit; font-size: 0.85rem;
    }
    .lang-btn.active { background: var(--accent); color: #fff; }
    .lang-btn:hover:not(.active) { color: var(--text); }
    .meta { color: var(--muted); font-size: 0.8rem; }
    .layout {
      display: grid; grid-template-columns: 320px 1fr;
      height: calc(100vh - 52px);
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; height: auto; min-height: calc(100vh - 52px); }
      body { height: auto; overflow: auto; }
      .sidebar { max-height: 240px; border-right: none; border-bottom: 1px solid #0b121a; }
      .detail-panel { width: 100%; max-width: 100%; }
    }
    .sidebar {
      background: var(--sidebar); border-right: 1px solid #0b121a;
      overflow: hidden; display: flex; flex-direction: column; min-height: 0;
    }
    .sidebar-search { padding: 10px 12px 6px; flex-shrink: 0; }
    .search, .date-input {
      width: 100%; padding: 10px 14px; border-radius: 22px; border: none;
      background: var(--panel2); color: var(--text); font: inherit;
    }
    .search:focus, .date-input:focus { outline: 2px solid rgba(42,171,238,0.35); }
    #groupList { overflow-y: auto; flex: 1; padding: 4px 0 12px; }
    .group-item {
      display: grid; grid-template-columns: 48px 1fr; gap: 10px; align-items: center;
      width: 100%; text-align: left; padding: 10px 14px;
      border: none; background: transparent; color: var(--text); cursor: pointer; font: inherit;
    }
    .group-item:hover { background: rgba(255,255,255,0.04); }
    .group-item.active { background: rgba(42,171,238,0.18); }
    .group-avatar {
      width: 48px; height: 48px; border-radius: 50%;
      display: grid; place-items: center; font-weight: 700; color: #fff; font-size: 1rem;
    }
    .group-meta .title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .group-meta .count { color: var(--muted); font-size: 0.8rem; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .main {
      display: flex; flex-direction: column; min-width: 0; min-height: 0;
      background: var(--chat-bg);
    }
    .chat-header {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
      padding: 10px 16px; background: var(--sidebar); border-bottom: 1px solid #0b121a; flex-shrink: 0;
    }
    .chat-header h2 { margin: 0; font-size: 1rem; font-weight: 600; flex: 1 1 180px; }
    .toolbar-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .btn {
      background: var(--panel2); color: var(--text); border: none;
      border-radius: 18px; padding: 8px 14px; cursor: pointer; font: inherit; white-space: nowrap;
    }
    .btn:hover { filter: brightness(1.08); }
    .btn-primary { background: var(--accent); color: #fff; }
    .date-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .date-row label { font-size: 0.78rem; color: var(--muted); }
    .date-input { width: auto; min-width: 130px; padding: 7px 12px; font-size: 0.85rem; border-radius: 16px; }
    .chat-tools {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      padding: 8px 12px; background: rgba(23,33,43,0.92); border-bottom: 1px solid #0b121a; flex-shrink: 0;
    }
    .feed-options, .feed-search {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    }
    .feed-options label { font-size: 0.8rem; color: var(--muted); }
    .sort-select {
      min-width: 140px; padding: 7px 10px; border-radius: 16px; border: none;
      background: var(--panel2); color: var(--text); font: inherit; cursor: pointer;
    }
    .feed-search { flex: 1 1 220px; }
    .feed-search input {
      flex: 1 1 180px; min-width: 160px;
      padding: 8px 14px; border-radius: 18px; border: none;
      background: var(--panel2); color: var(--text); font: inherit;
    }
    .feed-search input:focus { outline: 2px solid rgba(42,171,238,0.35); }
    .chat-stage {
      flex: 1; min-height: 0; overflow-y: auto;
      background-color: #0b141e;
      background-image:
        radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(180deg, #0b141e 0%, #0e1621 100%);
      background-size: 22px 22px, 100% 100%;
      padding: 18px 14px 28px;
    }
    #feed { max-width: 860px; margin: 0 auto; }
    .day-sep {
      display: flex; justify-content: center; margin: 14px 0 10px;
    }
    .day-sep span {
      background: rgba(24,37,51,0.85); color: #c5d0da; font-size: 0.78rem;
      padding: 4px 12px; border-radius: 12px;
    }
    .msg-row {
      display: flex;
      flex-direction: row;
      align-items: flex-end;
      gap: 8px;
      margin: 0 0 10px;
      width: 100%;
      max-width: 720px;
    }
    .msg-row.bot {
      margin-left: auto;
      flex-direction: row-reverse;
      justify-content: flex-start;
    }
    .msg-row.same-author { margin-top: -4px; }
    .msg-row.same-author .avatar { visibility: hidden; }
    .avatar {
      width: 40px; height: 40px; border-radius: 50%;
      display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 0.85rem;
      flex: 0 0 40px;
    }
    .bubble {
      position: relative;
      background: var(--bubble);
      border-radius: 14px 14px 14px 4px;
      padding: 8px 12px 6px;
      box-shadow: 0 1px 1px rgba(0,0,0,0.18);
      flex: 0 1 auto;
      width: auto;
      min-width: min(220px, 100%);
      max-width: min(560px, calc(100% - 48px));
    }
    .msg-row.bot .bubble {
      background: var(--bubble-out);
      border-radius: 14px 14px 4px 14px;
    }
    .bubble::before {
      content: "";
      position: absolute; left: -6px; bottom: 0;
      border-width: 0 8px 10px 0;
      border-style: solid;
      border-color: transparent var(--bubble) transparent transparent;
    }
    .msg-row.bot .bubble::before {
      left: auto; right: -6px;
      border-width: 0 0 10px 8px;
      border-color: transparent transparent transparent var(--bubble-out);
    }
    .msg-name { font-weight: 600; font-size: 0.88rem; color: var(--name); margin-bottom: 2px; }
    .msg-row.bot .msg-name { color: #9fd0ff; }
    .sticker-img {
      width: min(160px, 40vw); height: auto; display: block; background: transparent;
    }
    .bot-tag {
      display: inline-block; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.04em;
      padding: 1px 6px; border-radius: 6px; margin-left: 6px; vertical-align: middle;
      background: rgba(42,171,238,0.25); color: #9fd0ff;
    }
    .msg-user { color: var(--muted); font-weight: 400; font-size: 0.8rem; margin-left: 6px; }
    .msg-body {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: normal;
      line-height: 1.4;
      font-size: 0.95rem;
      margin: 2px 0 0;
    }
    .msg-vi {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid rgba(255,255,255,0.08);
      color: #d7ecff;
      font-size: 0.9rem;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.4;
    }
    .msg-vi .vi-tag {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: 1px 6px;
      border-radius: 6px;
      margin-right: 6px;
      background: rgba(0,186,124,0.25);
      color: #7dffc0;
      vertical-align: middle;
    }
    .msg-orig-hint {
      display: block;
      margin-top: 4px;
      font-size: 0.72rem;
      color: var(--muted);
    }
    .translate-status {
      text-align: center;
      color: var(--muted);
      font-size: 0.8rem;
      padding: 6px 0 2px;
    }
    .msg-foot {
      display: flex; justify-content: flex-end; gap: 6px; align-items: center;
      margin-top: 2px; min-height: 16px;
    }
    .msg-time { color: var(--muted); font-size: 0.72rem; }
    .msg-media { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
    .msg-media img, .msg-media video {
      max-width: min(320px, 100%); max-height: 260px; border-radius: 10px; display: block;
    }
    .msg-media audio { width: min(280px, 100%); }
    .msg-media a.doc {
      color: var(--accent); text-decoration: none; padding: 8px 12px;
      border-radius: 10px; background: rgba(255,255,255,0.04); display: inline-block;
    }
    .pager {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px;
      padding: 10px 12px 14px; background: rgba(23,33,43,0.95); border-top: 1px solid #0b121a; flex-shrink: 0;
    }
    .pager button {
      background: var(--panel2); color: var(--text); border: none; border-radius: 16px;
      padding: 8px 14px; cursor: pointer; font: inherit;
    }
    .pager button:disabled { opacity: 0.4; cursor: not-allowed; }
    .pager-jump { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .page-input {
      width: 64px; padding: 7px 8px; border-radius: 12px; border: none;
      background: var(--panel2); color: var(--text); font: inherit; text-align: center;
    }
    .empty, .loading { color: var(--muted); padding: 48px 12px; text-align: center; }
    .detail-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 100;
      opacity: 0; visibility: hidden; transition: opacity 0.2s;
    }
    .detail-overlay.open { opacity: 1; visibility: visible; }
    .detail-panel {
      position: fixed; top: 0; right: 0; width: min(480px, 100%); height: 100%;
      background: var(--sidebar); border-left: 1px solid #0b121a; z-index: 101;
      transform: translateX(100%); transition: transform 0.25s ease;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .detail-panel.open { transform: translateX(0); }
    .detail-head {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 16px 18px; border-bottom: 1px solid #0b121a; flex-shrink: 0;
    }
    .detail-head h3 { margin: 0; font-size: 1.05rem; }
    .detail-body { overflow-y: auto; padding: 16px 18px 32px; flex: 1; }
    .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px; }
    .stat-card {
      background: var(--panel2); border-radius: 12px; padding: 12px;
    }
    .stat-card .label { font-size: 0.75rem; color: var(--muted); margin-bottom: 4px; }
    .stat-card .value { font-size: 1rem; font-weight: 600; word-break: break-word; }
    .stat-card.highlight .value { color: var(--green); }
    .section-title {
      font-size: 0.85rem; font-weight: 600; color: var(--muted); text-transform: uppercase;
      letter-spacing: 0.04em; margin: 18px 0 10px;
    }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .data-table th, .data-table td {
      border-bottom: 1px solid #243244; padding: 8px 6px; text-align: left; vertical-align: top;
    }
    .data-table th { color: var(--muted); font-weight: 500; }
    .data-table a { color: var(--accent); text-decoration: none; }
    .filter-bar {
      background: var(--panel2); border-radius: 12px; padding: 12px; margin-bottom: 16px;
    }
    .filter-bar .date-row { margin-top: 8px; }
    mark.hl { background: rgba(255, 122, 0, 0.35); color: inherit; border-radius: 3px; padding: 0 2px; }
    .username-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .username-chip {
      display: inline-block; padding: 4px 10px; border-radius: 999px;
      background: var(--panel2); font-size: 0.82rem;
    }
    .username-chip a { color: var(--accent); text-decoration: none; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.72rem;
      background: #0e1621; color: var(--muted);
    }
  </style>
</head>
<body>
  <header class="app-bar">
    <h1>💬 <span data-i18n="title">Message Logs</span></h1>
    <div class="header-right">
      <div class="lang-switch">
        <button type="button" id="langVi" class="lang-btn active" data-i18n="langVi">Tiếng Việt</button>
        <button type="button" id="langZh" class="lang-btn" data-i18n="langZh">中文</button>
      </div>
      <div class="meta"><span id="tokenHoursPrefix"></span><strong id="hoursLeft">${hoursLeft}</strong><span id="tokenHoursSuffix"></span></div>
    </div>
  </header>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-search">
        <input class="search" id="groupSearch" type="search" data-i18n="searchGroup" data-i18n-attr="placeholder" placeholder="Tìm nhóm..." autocomplete="off">
      </div>
      <div id="groupList"><div class="loading" data-i18n="loadingGroups">Đang tải nhóm...</div></div>
    </aside>
    <section class="main">
      <div class="chat-header">
        <h2 id="feedTitle" data-i18n="selectGroup">Chọn một nhóm</h2>
        <div class="toolbar-actions">
          <div class="date-row">
            <label data-i18n="msgFrom">Tin từ</label>
            <input type="date" class="date-input" id="msgStartDate">
            <label data-i18n="msgTo">đến</label>
            <input type="date" class="date-input" id="msgEndDate">
            <button type="button" class="btn" id="msgFilterBtn" data-i18n="filterMsg">Lọc tin</button>
          </div>
          <button type="button" class="btn btn-primary" id="detailBtn" disabled>📊 <span data-i18n="details">Chi tiết</span></button>
        </div>
      </div>
      <div class="chat-tools">
        <div class="feed-options">
          <label for="msgSort" data-i18n="sortLabel">Thứ tự đọc tin</label>
          <select id="msgSort" class="sort-select">
            <option value="desc" data-i18n="sortNewest">Mới → Cũ</option>
            <option value="asc" data-i18n="sortOldest">Cũ → Mới</option>
          </select>
        </div>
        <div class="feed-search">
          <input type="search" id="msgSearch" data-i18n="msgSearchPlaceholder" data-i18n-attr="placeholder" placeholder="Tìm nội dung, tên người gửi, @username..." autocomplete="off">
          <button type="button" class="btn btn-primary" id="msgSearchBtn">🔍 <span data-i18n="searchBtn">Tìm</span></button>
          <button type="button" class="btn" id="msgSearchClear" style="display:none">✕ <span data-i18n="clearBtn">Xóa</span></button>
          <span class="meta" id="msgSearchInfo"></span>
        </div>
      </div>
      <div class="chat-stage">
        <div id="feed"><div class="empty" data-i18n="selectGroupHint">Chọn nhóm bên trái để xem tin nhắn</div></div>
      </div>
      <div class="pager" id="pager" style="display:none">
        <button type="button" id="prevBtn">← <span data-i18n="prev">Trước</span></button>
        <div class="pager-jump">
          <span data-i18n="page">Trang</span>
          <input type="number" class="page-input" id="pageInput" min="1" value="1">
          <span class="meta" id="pageTotal">/ 1</span>
          <button type="button" class="btn" id="pageGoBtn" data-i18n="pageGo">Đi</button>
        </div>
        <button type="button" id="nextBtn"><span data-i18n="next">Sau</span> →</button>
      </div>
    </section>
  </div>

  <div class="detail-overlay" id="detailOverlay"></div>
  <aside class="detail-panel" id="detailPanel" aria-hidden="true">
    <div class="detail-head">
      <h3 id="detailTitle" data-i18n="detailTitle">Chi tiết nhóm</h3>
      <button type="button" class="btn" id="detailClose" data-i18n="close">✕</button>
    </div>
    <div class="detail-body" id="detailBody">
      <div class="filter-bar">
        <div class="meta" data-i18n="detailFilterHint">Lọc thống kê & giao dịch theo ngày</div>
        <div class="date-row">
          <input type="date" class="date-input" id="detailStartDate">
          <span class="meta">→</span>
          <input type="date" class="date-input" id="detailEndDate">
          <button type="button" class="btn btn-primary" id="detailFilterBtn" data-i18n="apply">Áp dụng</button>
          <button type="button" class="btn" id="detailClearFilter" data-i18n="clearFilter">Xóa lọc</button>
        </div>
      </div>
      <div id="detailContent"><div class="loading" data-i18n="loadingDetail">Đang tải...</div></div>
    </div>
  </aside>

  <script>
    const TOKEN = ${JSON.stringify(safeToken)};
    const I18N = ${i18nJson};
    let lang = localStorage.getItem('messagelogs_lang') || 'vi';
    let groups = [];
    let activeChatId = null;
    let page = 1;
    let totalPages = 1;
    let msgStartDate = '';
    let msgEndDate = '';
    let msgSearchQuery = '';
    // asc = giống Telegram (cũ→mới), mở nhóm sẽ nhảy trang cuối (tin mới nhất)
    let msgSortOrder = localStorage.getItem('messagelogs_sort') || 'asc';
    let jumpNewestPending = false;
    let lastFeedMessages = [];
    const HAN_RE = /[\\u3400-\\u9FFF]/;
    function containsChinese(text) {
      return HAN_RE.test(String(text || ''));
    }
    let detailStartDate = '';
    let detailEndDate = '';
    let searchDebounceTimer = null;
    let lastDetailData = null;

    function t(key) {
      return (I18N[lang] && I18N[lang][key]) || I18N.vi[key] || key;
    }
    function applyStaticI18n() {
      document.title = t('title');
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'vi';
      document.getElementById('langVi').classList.toggle('active', lang === 'vi');
      document.getElementById('langZh').classList.toggle('active', lang === 'zh');
      document.getElementById('tokenHoursPrefix').textContent = t('tokenHours') + ' ';
      document.getElementById('tokenHoursSuffix').textContent = ' ' + t('hours');
      document.querySelectorAll('[data-i18n]').forEach(function(el) {
        var key = el.getAttribute('data-i18n');
        var attr = el.getAttribute('data-i18n-attr');
        if (attr) el.setAttribute(attr, t(key));
        else el.textContent = t(key);
      });
      var sortEl = document.getElementById('msgSort');
      if (sortEl && sortEl.options.length >= 2) {
        sortEl.options[0].textContent = t('sortNewest');
        sortEl.options[1].textContent = t('sortOldest');
      }
      updatePagerUi();
    }
    function setLang(next) {
      lang = next;
      localStorage.setItem('messagelogs_lang', lang);
      applyStaticI18n();
      renderGroups(document.getElementById('groupSearch').value);
      if (activeChatId) {
        var g = groups.find(function(x) { return x.chatId === activeChatId; });
        document.getElementById('feedTitle').textContent =
          (g ? (g.groupName || activeChatId) : activeChatId) + (g ? ' · ' + g.count + ' ' + t('msgs') : '');
      }
      if (lastDetailData) renderDetailContent(lastDetailData);
      if (lang === 'vi') applyZhToViTranslations();
      else clearZhToViTranslations();
    }

    function clearZhToViTranslations() {
      document.querySelectorAll('.msg-vi, .translate-status').forEach(function(el) { el.remove(); });
      document.querySelectorAll('.msg-body[data-show-orig]').forEach(function(el) {
        el.removeAttribute('data-show-orig');
      });
    }

    async function applyZhToViTranslations() {
      if (lang !== 'vi') return;
      const bodies = Array.from(document.querySelectorAll('.msg-body[data-orig]'));
      const need = bodies.filter(function(el) {
        return containsChinese(el.getAttribute('data-orig') || '');
      });
      if (!need.length) return;

      clearZhToViTranslations();
      const status = document.createElement('div');
      status.className = 'translate-status';
      status.textContent = t('translating');
      const feed = document.getElementById('feed');
      if (feed) feed.prepend(status);

      try {
        const texts = need.map(function(el) { return el.getAttribute('data-orig') || ''; });
        const res = await fetch('/api/messagelogs/translate?token=' + encodeURIComponent(TOKEN), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: texts })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const translations = data.translations || [];
        need.forEach(function(el, i) {
          const vi = translations[i];
          const orig = el.getAttribute('data-orig') || '';
          if (!vi || vi === orig) return;
          const box = document.createElement('div');
          box.className = 'msg-vi';
          box.innerHTML = '<span class="vi-tag">' + escapeHtml(t('translationLabel')) + '</span>' +
            highlightText(vi, msgSearchQuery || '');
          el.insertAdjacentElement('afterend', box);
        });
      } catch (err) {
        console.warn('translate failed', err);
      } finally {
        status.remove();
      }
    }

    function mediaUrl(fileId) {
      if (!fileId) return '';
      return '/media/' + encodeURIComponent(fileId) + '?token=' + encodeURIComponent(TOKEN);
    }
    function escapeHtml(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function formatTime(iso) {
      try { return new Date(iso).toLocaleString(lang === 'zh' ? 'zh-CN' : 'vi-VN', { hour12: false }); } catch (e) { return ''; }
    }
    function formatDayLabel(iso) {
      try {
        return new Date(iso).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'vi-VN', {
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });
      } catch (e) { return ''; }
    }
    function formatBubbleTime(iso) {
      try {
        return new Date(iso).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'vi-VN', {
          hour: '2-digit', minute: '2-digit', hour12: false
        });
      } catch (e) { return ''; }
    }
    function avatarColor(seed) {
      var s = String(seed || '?');
      var hash = 0;
      for (var i = 0; i < s.length; i++) hash = ((hash << 5) - hash) + s.charCodeAt(i);
      var hue = Math.abs(hash) % 360;
      return 'hsl(' + hue + ' 52% 42%)';
    }
    function avatarInitials(name) {
      var parts = String(name || '?').trim().split(/\\s+/).filter(Boolean);
      if (!parts.length) return '?';
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    function fmtNum(n) {
      const v = Number(n);
      if (isNaN(v)) return '0';
      return v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    }
    function fmtRate(n, suffix) {
      const v = Number(n);
      if (isNaN(v) || v === 0) return '—';
      return v.toLocaleString('vi-VN', { maximumFractionDigits: 4 }) + (suffix || '');
    }
    function escapeRegex(s) {
      var special = '.*+?^$()|[]\\\\';
      return String(s || '').split('').map(function(ch) {
        if (special.indexOf(ch) >= 0 || ch === '{' || ch === '}') return '\\\\' + ch;
        return ch;
      }).join('');
    }
    function highlightText(text, query) {
      const raw = String(text || '');
      if (!query) return escapeHtml(raw);
      const escaped = escapeHtml(raw);
      const re = new RegExp('(' + escapeRegex(query) + ')', 'gi');
      return escaped.replace(re, '<mark class="hl">$1</mark>');
    }
    function updateSearchInfo(total, query) {
      const el = document.getElementById('msgSearchInfo');
      const clearBtn = document.getElementById('msgSearchClear');
      if (!query) {
        el.textContent = '';
        clearBtn.style.display = 'none';
        return;
      }
      clearBtn.style.display = '';
      el.textContent = t('searchFor') + ' "' + query + '": ' + total + ' ' + t('searchResults');
    }

    async function loadGroups() {
      document.getElementById('groupList').innerHTML = '<div class="loading">' + t('loadingGroups') + '</div>';
      const res = await fetch('/api/messagelogs/groups?token=' + encodeURIComponent(TOKEN));
      if (!res.ok) {
        document.getElementById('groupList').innerHTML = '<div class="empty">' + t('loadGroupsFail') + '</div>';
        return;
      }
      const data = await res.json();
      groups = data.groups || [];
      renderGroups();
      if (groups.length) selectGroup(groups[0].chatId);
    }

    function renderGroups(filter) {
      const q = (filter || '').trim().toLowerCase();
      const list = groups.filter(g => !q || (g.groupName || '').toLowerCase().includes(q) || String(g.chatId).includes(q));
      const el = document.getElementById('groupList');
      if (!list.length) { el.innerHTML = '<div class="empty">' + t('noGroups') + '</div>'; return; }
      el.innerHTML = list.map(g => {
        const active = g.chatId === activeChatId ? ' active' : '';
        const title = g.groupName || g.chatId;
        const rateHint = g.hasBotData
          ? ' · Rate ' + fmtRate(g.rate, '%') + ' · TG ' + fmtRate(g.exchangeRate)
          : '';
        return '<button type="button" class="group-item' + active + '" data-id="' + escapeHtml(g.chatId) + '">' +
          '<div class="group-avatar" style="background:' + avatarColor(title) + '">' + escapeHtml(avatarInitials(title)) + '</div>' +
          '<div class="group-meta"><div class="title">' + escapeHtml(title) + '</div>' +
          '<div class="count">' + g.count + ' ' + t('msgs') + ' · ' + escapeHtml(g.chatType || '') + rateHint + '</div></div></button>';
      }).join('');
      el.querySelectorAll('.group-item').forEach(btn => {
        btn.addEventListener('click', () => selectGroup(btn.getAttribute('data-id')));
      });
    }

    async function selectGroup(chatId) {
      activeChatId = chatId;
      msgSearchQuery = '';
      document.getElementById('msgSearch').value = '';
      updateSearchInfo(0, '');
      document.getElementById('detailBtn').disabled = false;
      renderGroups(document.getElementById('groupSearch').value);
      const g = groups.find(x => x.chatId === chatId);
      document.getElementById('feedTitle').textContent =
        (g ? (g.groupName || chatId) : chatId) + (g ? ' · ' + g.count + ' ' + t('msgs') : '');
      // Mở nhóm → trang chứa tin mới nhất
      jumpNewestPending = true;
      page = msgSortOrder === 'desc' ? 1 : 1;
      await loadMessages();
    }

    function updatePagerUi() {
      var input = document.getElementById('pageInput');
      var totalEl = document.getElementById('pageTotal');
      if (!input) return;
      input.max = String(totalPages);
      input.value = String(page);
      totalEl.textContent = t('pageOf') + ' ' + totalPages;
      document.getElementById('prevBtn').disabled = page <= 1;
      document.getElementById('nextBtn').disabled = page >= totalPages;
    }
    function goToPage(target) {
      var n = parseInt(target, 10);
      if (isNaN(n) || n < 1 || n > totalPages) {
        alert(t('invalidPage') + ' (1-' + totalPages + ')');
        updatePagerUi();
        return;
      }
      page = n;
      loadMessages();
    }

    async function loadMessages() {
      if (!activeChatId) return;
      const feed = document.getElementById('feed');
      feed.innerHTML = '<div class="loading">' + t('loadingMessages') + '</div>';
      msgSortOrder = document.getElementById('msgSort').value || msgSortOrder;
      localStorage.setItem('messagelogs_sort', msgSortOrder);
      let url = '/api/messagelogs?token=' + encodeURIComponent(TOKEN) +
        '&chatId=' + encodeURIComponent(activeChatId) + '&page=' + page + '&limit=100&sort=' + encodeURIComponent(msgSortOrder);
      if (msgStartDate) url += '&startDate=' + encodeURIComponent(msgStartDate);
      if (msgEndDate) url += '&endDate=' + encodeURIComponent(msgEndDate);
      if (msgSearchQuery) url += '&q=' + encodeURIComponent(msgSearchQuery);
      const res = await fetch(url);
      if (!res.ok) { feed.innerHTML = '<div class="empty">' + t('loadMessagesFail') + '</div>'; return; }
      const data = await res.json();
      totalPages = data.totalPages || 1;
      if (page > totalPages) {
        page = totalPages;
        return loadMessages();
      }
      // Lần mở nhóm / đổi sort: nhảy tới trang tin mới nhất
      if (jumpNewestPending) {
        jumpNewestPending = false;
        const newestPage = msgSortOrder === 'asc' ? totalPages : 1;
        if (page !== newestPage && newestPage >= 1) {
          page = newestPage;
          return loadMessages();
        }
      }
      updateSearchInfo(data.total || 0, msgSearchQuery);
      document.getElementById('pager').style.display = totalPages > 1 ? 'flex' : 'none';
      updatePagerUi();
      const msgs = data.messages || [];
      lastFeedMessages = msgs;
      if (!msgs.length) {
        feed.innerHTML = '<div class="empty">' +
          (msgSearchQuery ? t('noSearchMatch') + ' "' + escapeHtml(msgSearchQuery) + '"' : t('noMessages')) +
          '</div>';
        return;
      }
      const q = msgSearchQuery;
      let html = '';
      let lastDay = '';
      let lastAuthor = '';
      msgs.forEach(function(m, msgIndex) {
        const day = formatDayLabel(m.timestamp);
        if (day && day !== lastDay) {
          html += '<div class="day-sep"><span>' + escapeHtml(day) + '</span></div>';
          lastDay = day;
          lastAuthor = '';
        }
        let media = '';
        if (m.photoFileId || m.photoUrl) {
          const src = m.photoFileId ? mediaUrl(m.photoFileId) : m.photoUrl;
          media += '<a href="' + escapeHtml(src) + '" target="_blank" rel="noopener"><img src="' + escapeHtml(src) + '" alt="photo" loading="lazy"></a>';
        }
        if (m.animationFileId || m.animationUrl) {
          const src = m.animationFileId ? mediaUrl(m.animationFileId) : m.animationUrl;
          media += '<video autoplay loop muted playsinline preload="metadata" src="' + escapeHtml(src) + '"></video>';
        }
        if (m.stickerFileId || m.stickerUrl) {
          const src = m.stickerFileId ? mediaUrl(m.stickerFileId) : m.stickerUrl;
          media += '<img class="sticker-img" src="' + escapeHtml(src) + '" alt="sticker" loading="lazy">';
        }
        if (m.videoFileId || m.videoUrl) {
          const src = m.videoFileId ? mediaUrl(m.videoFileId) : m.videoUrl;
          media += '<video controls preload="metadata" src="' + escapeHtml(src) + '"></video>';
        }
        if (m.voiceFileId || m.voiceUrl) {
          const src = m.voiceFileId ? mediaUrl(m.voiceFileId) : m.voiceUrl;
          media += '<audio controls preload="metadata" src="' + escapeHtml(src) + '"></audio>';
        }
        if (m.documentFileId || m.documentUrl) {
          const src = m.documentFileId ? mediaUrl(m.documentFileId) : m.documentUrl;
          media += '<a class="doc" href="' + escapeHtml(src) + '" target="_blank" rel="noopener">📄 ' + t('document') + '</a>';
        }
        const isBot = !!m.isBot;
        const name = m.senderName || (isBot ? 'Bot' : 'Unknown');
        const authorKey = String(m.senderId || m.username || name) + (isBot ? ':bot' : '');
        const sameAuthor = authorKey === lastAuthor;
        lastAuthor = authorKey;
        const user = m.username ? '@' + highlightText(m.username, q.replace(/^@/, '')) : '';
        const bodyText = (m.stickerFileId || m.stickerUrl)
          ? (m.content && !/\[sticker\]/.test(m.content) ? m.content.replace(/\s*\[sticker\]\s*/g, '').trim() : '')
          : (m.content || '');
        html += '<article class="msg-row' + (isBot ? ' bot' : '') + (sameAuthor ? ' same-author' : '') + '">' +
          '<div class="avatar" style="background:' + avatarColor(authorKey) + '">' + escapeHtml(avatarInitials(name)) + '</div>' +
          '<div class="bubble">' +
          (sameAuthor ? '' : ('<div class="msg-name">' + highlightText(name, q) +
            (isBot ? '<span class="bot-tag">BOT</span>' : '') +
            (m.username ? '<span class="msg-user">' + user + '</span>' : '') + '</div>')) +
          (bodyText ? '<div class="msg-body" data-msg-idx="' + msgIndex + '" data-orig="' + escapeHtml(bodyText) + '">' + highlightText(bodyText, q) + '</div>' : '') +
          (media ? '<div class="msg-media">' + media + '</div>' : '') +
          '<div class="msg-foot"><span class="msg-time">' + escapeHtml(formatBubbleTime(m.timestamp)) + '</span></div>' +
          '</div></article>';
      });
      feed.innerHTML = html;
      // Telegram-like: cũ→mới cuộn cuối; mới→cũ ở đầu
      var stage = document.querySelector('.chat-stage');
      if (stage) {
        if (msgSortOrder === 'asc') stage.scrollTop = stage.scrollHeight;
        else stage.scrollTop = 0;
      }
      if (lang === 'vi') applyZhToViTranslations();
    }

    function openDetailPanel() {
      document.getElementById('detailOverlay').classList.add('open');
      document.getElementById('detailPanel').classList.add('open');
      document.getElementById('detailPanel').setAttribute('aria-hidden', 'false');
    }
    function closeDetailPanel() {
      document.getElementById('detailOverlay').classList.remove('open');
      document.getElementById('detailPanel').classList.remove('open');
      document.getElementById('detailPanel').setAttribute('aria-hidden', 'true');
    }

    function roleLabel(roles) {
      if (!roles || !roles.length) return t('roleMember');
      var labels = [];
      if (roles.indexOf('creator') >= 0) labels.push(t('roleCreator'));
      if (roles.indexOf('admin') >= 0) labels.push(t('roleAdmin'));
      if (roles.indexOf('operator') >= 0) labels.push(t('roleOperator'));
      if (roles.indexOf('member') >= 0 && labels.indexOf(t('roleMember')) < 0) labels.push(t('roleMember'));
      return labels.length ? labels.join(', ') : t('roleMember');
    }
    function rateTypeLabel(type) {
      if (type === 'setRate') return t('rateTypeSetRate');
      if (type === 'setExchangeRate') return t('rateTypeSetEx');
      if (type === 'setWRate') return t('rateTypeSetW');
      return type || '—';
    }
    function txTypeLabel(type) {
      var map = {
        deposit: 'typeDeposit', withdraw: 'typeWithdraw', payment: 'typePayment',
        clear: 'typeClear', setRate: 'typeSetRate', setExchangeRate: 'typeSetEx', setWRate: 'typeSetW'
      };
      return t(map[type] || type);
    }
    function renderMembersSection(data) {
      var allMembers = data.allMembers || [];
      var usernames = data.usernames || [];
      var html = '<div class="section-title">' + t('allUsernames') + ' (' + usernames.length + ' ' + t('usernameCount') + ')</div>';
      if (usernames.length) {
        html += '<div class="username-list">';
        usernames.forEach(function(u) {
          html += '<span class="username-chip"><a href="https://t.me/' + escapeHtml(u) + '" target="_blank" rel="noopener">@' + escapeHtml(u) + '</a></span>';
        });
        html += '</div>';
      } else {
        html += '<p class="meta">' + t('noUsername') + '</p>';
      }
      html += '<div class="section-title">' + t('allMembers') + ' (' + allMembers.length + ')</div>';
      html += '<table class="data-table"><thead><tr>' +
        '<th>' + t('colName') + '</th><th>' + t('colUsername') + '</th><th>' + t('colMessages') + '</th><th>' + t('colRole') + '</th></tr></thead><tbody>';
      allMembers.forEach(function(m) {
        var uname = m.username
          ? '<a href="' + escapeHtml(m.telegramLink || ('https://t.me/' + m.username)) + '" target="_blank" rel="noopener">@' + escapeHtml(m.username) + '</a>'
          : '<span class="meta">' + t('noUsername') + '</span>';
        html += '<tr><td>' + escapeHtml(m.fullName) + '</td><td>' + uname + '</td><td>' + fmtNum(m.messageCount || 0) + '</td><td><span class="badge">' + escapeHtml(roleLabel(m.roles)) + '</span></td></tr>';
      });
      if (!allMembers.length) html += '<tr><td colspan="4" class="meta">' + t('noData') + '</td></tr>';
      html += '</tbody></table>';
      return html;
    }

    function renderDetailContent(data) {
      if (!data.registered) {
        document.getElementById('detailContent').innerHTML =
          '<div class="stat-grid">' +
          statCard(t('chatId'), escapeHtml(data.chatId)) +
          statCard(t('messageLogs'), fmtNum(data.messageLogCount)) +
          '</div>' +
          renderMembersSection(data) +
          '<p class="meta" style="margin-top:12px">' + escapeHtml(t('unregisteredHint')) + '</p>';
        return;
      }

      const g = data.group || {};
      const s = data.summary || {};
      const p = data.periodTotals || {};
      const hasFilter = data.filters && (data.filters.startDate || data.filters.endDate);
      const periodLabel = hasFilter ? t('periodSuffix') : '';
      const trs = data.transactionRateStats || {};

      let html = renderMembersSection(data);

      html += '<div class="section-title">' + t('currentRates') + '</div><div class="stat-grid">' +
        statCard('Rate', fmtRate(g.rate, '%')) +
        statCard(t('colExchange'), fmtRate(g.exchangeRate)) +
        statCard('WRate', fmtRate(g.wrate, '%')) +
        statCard('W' + t('colExchange'), fmtRate(g.wexchangeRate)) +
        statCard(t('currency'), escapeHtml(g.currency || 'USDT')) +
        statCard(t('numberFormat'), escapeHtml(g.numberFormat || 'comma')) +
        '</div>';

      html += '<div class="section-title">' + t('txRateStats') + '</div><div class="stat-grid">' +
        statCard(t('rateAvg'), fmtRate(trs.avgRate, '%')) +
        statCard(t('rateMinMax'), fmtRate(trs.minRate, '%') + ' / ' + fmtRate(trs.maxRate, '%')) +
        statCard(t('exAvg'), fmtRate(trs.avgExchangeRate)) +
        statCard(t('exMinMax'), fmtRate(trs.minExchangeRate) + ' / ' + fmtRate(trs.maxExchangeRate)) +
        statCard(t('orderCount'), fmtNum(trs.count || 0)) +
        '</div>';

      html += '<div class="section-title">' + t('financeTotal') + '</div><div class="stat-grid">' +
        statCard(t('totalVnd'), fmtNum(g.totalVND)) +
        statCard(t('depositVnd'), fmtNum(g.totalVNDPlus)) +
        statCard(t('withdrawVnd'), fmtNum(g.totalVNDMinus)) +
        statCard(t('totalUsdt'), fmtNum(g.totalUSDT), true) +
        statCard(t('paidUsdt'), fmtNum(s.totalPaid)) +
        statCard(t('remainingUsdt'), fmtNum(s.remaining), true) +
        '</div>';

      if (hasFilter) {
        html += '<div class="section-title">' + t('periodTotal') + periodLabel + '</div>' +
          '<div class="stat-grid">' +
          statCard(t('periodVnd'), fmtNum(p.totalVND)) +
          statCard(t('periodUsdt'), fmtNum(p.totalUSDT), true) +
          statCard(t('periodPaid'), fmtNum(p.totalPaid)) +
          statCard(t('periodRemaining'), fmtNum(p.remaining)) +
          '</div>';
      }

      html += '<div class="section-title">' + t('rateHistory') + ' (' + (data.rateHistory || []).length + ')</div>' +
        '<table class="data-table"><thead><tr><th>' + t('colTime') + '</th><th>' + t('colType') + '</th><th>' + t('colRate') + '</th><th>' + t('colExchange') + '</th><th>' + t('colPerson') + '</th></tr></thead><tbody>';
      (data.rateHistory || []).forEach(function(r) {
        html += '<tr><td class="meta">' + escapeHtml(formatTime(r.timestamp)) + '</td>' +
          '<td>' + escapeHtml(rateTypeLabel(r.type)) + '</td>' +
          '<td>' + fmtRate(r.rate, '%') + '</td>' +
          '<td>' + fmtRate(r.exchangeRate) + '</td>' +
          '<td>' + escapeHtml(r.senderName || '—') + '</td></tr>';
      });
      if (!(data.rateHistory || []).length) {
        html += '<tr><td colspan="5" class="meta">' + t('noRateHistory') + '</td></tr>';
      }
      html += '</tbody></table>';

      html += '<div class="section-title">' + t('txTypeStats') + '</div><table class="data-table"><thead><tr>' +
        '<th>' + t('colType') + '</th><th>' + t('colOrders') + '</th><th>' + t('colVnd') + '</th><th>' + t('colUsdt') + '</th></tr></thead><tbody>';
      const types = data.statsByType || {};
      Object.keys(types).sort().forEach(function(tp) {
        const row = types[tp];
        html += '<tr><td>' + escapeHtml(txTypeLabel(tp)) + '</td><td>' + row.count + '</td>' +
          '<td>' + fmtNum(row.totalAmount) + '</td><td>' + fmtNum(row.totalUsdt) + '</td></tr>';
      });
      if (!Object.keys(types).length) html += '<tr><td colspan="4" class="meta">' + t('noTransactions') + '</td></tr>';
      html += '</tbody></table>';

      if ((data.cards || []).length) {
        html += '<div class="section-title">' + t('cards') + ' (' + data.cards.length + ')</div>' +
          '<table class="data-table"><thead><tr><th>' + t('colCode') + '</th><th>' + t('colTotal') + '</th><th>' + t('colPaid') + '</th><th>' + t('colRemaining') + '</th><th>' + t('colLimit') + '</th></tr></thead><tbody>';
        data.cards.forEach(function(c) {
          html += '<tr><td>' + escapeHtml(c.cardCode) + '</td><td>' + fmtNum(c.total) + '</td>' +
            '<td>' + fmtNum(c.paid) + '</td><td>' + fmtNum(c.remaining) + '</td><td>' + fmtNum(c.limit) + '</td></tr>';
        });
        html += '</tbody></table>';
      }

      html += '<div class="section-title">' + t('tgAdmins') + ' (' + (data.members || []).length + ')</div>' +
        '<table class="data-table"><thead><tr><th>' + t('colName') + '</th><th>' + t('colUsername') + '</th><th>' + t('colRole') + '</th></tr></thead><tbody>';
      (data.members || []).forEach(function(m) {
        var nameLink = m.telegramLink ? '<a href="' + escapeHtml(m.telegramLink) + '" target="_blank" rel="noopener">' + escapeHtml(m.fullName) + '</a>' : escapeHtml(m.fullName);
        var uname = m.username ? '@' + escapeHtml(m.username) : '—';
        html += '<tr><td>' + nameLink + '</td><td>' + uname + '</td><td><span class="badge">' + escapeHtml(m.status === 'creator' ? t('roleCreator') : t('roleAdmin')) + '</span></td></tr>';
      });
      if (!(data.members || []).length) html += '<tr><td colspan="3" class="meta">' + t('noAdmins') + '</td></tr>';
      html += '</tbody></table>';

      html += '<div class="section-title">' + t('operators') + ' (' + (data.operators || []).length + ')</div>' +
        '<table class="data-table"><thead><tr><th>' + t('colUsername') + '</th><th>' + t('colAdded') + '</th></tr></thead><tbody>';
      (data.operators || []).forEach(function(op) {
        const link = op.telegramLink ? '<a href="' + escapeHtml(op.telegramLink) + '" target="_blank" rel="noopener">@' + escapeHtml(op.username) + '</a>' : escapeHtml(op.username || '-');
        html += '<tr><td>' + link + '</td><td class="meta">' + escapeHtml(formatTime(op.dateAdded)) + '</td></tr>';
      });
      if (!(data.operators || []).length) html += '<tr><td colspan="2" class="meta">' + t('noOperators') + '</td></tr>';
      html += '</tbody></table>';

      html += '<div class="section-title">' + t('dailySummary') + '</div><table class="data-table"><thead><tr>' +
        '<th>' + t('colDate') + '</th><th>' + t('colDeposit') + '</th><th>' + t('colWithdraw') + '</th><th>' + t('colUsdt') + '</th><th>' + t('colPaidUsdt') + '</th><th>' + t('colAvgRate') + '</th><th>' + t('colAvgEx') + '</th><th>' + t('colOrders') + '</th></tr></thead><tbody>';
      (data.dailySummary || []).slice(0, 31).forEach(function(d) {
        html += '<tr><td>' + escapeHtml(d.date) + '</td>' +
          '<td>' + fmtNum(d.deposits && d.deposits.amount) + '</td>' +
          '<td>' + fmtNum(d.withdraws && d.withdraws.amount) + '</td>' +
          '<td>' + fmtNum(d.totalUSDT) + '</td>' +
          '<td>' + fmtNum(d.totalPaid) + '</td>' +
          '<td>' + fmtRate(d.avgRate, '%') + '</td>' +
          '<td>' + fmtRate(d.avgExchangeRate) + '</td>' +
          '<td>' + (d.transactionCount || 0) + '</td></tr>';
      });
      if (!(data.dailySummary || []).length) html += '<tr><td colspan="8" class="meta">' + t('noData') + '</td></tr>';
      html += '</tbody></table>';

      if ((data.startHistory || []).length) {
        html += '<div class="section-title">' + t('startHistory') + '</div><table class="data-table"><thead><tr><th>' + t('colDate') + '</th><th>' + t('colPerson') + '</th></tr></thead><tbody>';
        data.startHistory.forEach(function(h) {
          html += '<tr><td>' + escapeHtml(h.date) + '</td><td>' + escapeHtml(h.senderName) + '</td></tr>';
        });
        html += '</tbody></table>';
      }

      html += '<p class="meta" style="margin-top:16px">' + t('chatId') + ': ' + escapeHtml(data.chatId) +
        ' · ' + t('footerTx') + ': ' + fmtNum(data.transactionCount) +
        ' · ' + t('footerLogs') + ': ' + fmtNum(data.messageLogCount) +
        ' · ' + t('footerMembers') + ': ' + fmtNum(data.memberCount) +
        (g.lastClearDate ? ' · ' + t('footerLastClear') + ': ' + formatTime(g.lastClearDate) : '') + '</p>';

      document.getElementById('detailContent').innerHTML = html;
    }

    function statCard(label, value, highlight) {
      return '<div class="stat-card' + (highlight ? ' highlight' : '') + '"><div class="label">' + label +
        '</div><div class="value">' + value + '</div></div>';
    }

    async function loadGroupDetails() {
      if (!activeChatId) return;
      document.getElementById('detailContent').innerHTML = '<div class="loading">' + t('loadingDetail') + '</div>';
      let url = '/api/messagelogs/groups/' + encodeURIComponent(activeChatId) + '/details?token=' + encodeURIComponent(TOKEN);
      if (detailStartDate) url += '&startDate=' + encodeURIComponent(detailStartDate);
      if (detailEndDate) url += '&endDate=' + encodeURIComponent(detailEndDate);
      const res = await fetch(url);
      if (!res.ok) {
        let msg = t('loadDetailFail') + ' (HTTP ' + res.status + ')';
        try {
          const err = await res.json();
          if (err.error) msg = err.error;
        } catch (e) { /* ignore */ }
        document.getElementById('detailContent').innerHTML = '<div class="empty">' + escapeHtml(msg) + '</div>';
        lastDetailData = null;
        return;
      }
      const data = await res.json();
      lastDetailData = data;
      document.getElementById('detailTitle').textContent = t('details') + ' · ' + (data.groupTitle || activeChatId);
      renderDetailContent(data);
    }

    document.getElementById('groupSearch').addEventListener('input', e => renderGroups(e.target.value));
    document.getElementById('prevBtn').addEventListener('click', function() { if (page > 1) { page -= 1; loadMessages(); } });
    document.getElementById('nextBtn').addEventListener('click', function() { if (page < totalPages) { page += 1; loadMessages(); } });
    document.getElementById('pageGoBtn').addEventListener('click', function() {
      goToPage(document.getElementById('pageInput').value);
    });
    document.getElementById('pageInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); goToPage(e.target.value); }
    });
    document.getElementById('msgSort').addEventListener('change', function() {
      msgSortOrder = document.getElementById('msgSort').value;
      jumpNewestPending = true;
      page = 1;
      loadMessages();
    });
    document.getElementById('msgFilterBtn').addEventListener('click', () => {
      msgStartDate = document.getElementById('msgStartDate').value;
      msgEndDate = document.getElementById('msgEndDate').value;
      jumpNewestPending = true;
      page = 1;
      loadMessages();
    });
    function runMessageSearch() {
      msgSearchQuery = document.getElementById('msgSearch').value.trim();
      jumpNewestPending = true;
      page = 1;
      loadMessages();
    }
    document.getElementById('msgSearchBtn').addEventListener('click', runMessageSearch);
    document.getElementById('msgSearch').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); runMessageSearch(); }
    });
    document.getElementById('msgSearch').addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(runMessageSearch, 450);
    });
    document.getElementById('msgSearchClear').addEventListener('click', () => {
      document.getElementById('msgSearch').value = '';
      msgSearchQuery = '';
      page = 1;
      loadMessages();
    });
    document.getElementById('detailBtn').addEventListener('click', () => {
      openDetailPanel();
      loadGroupDetails();
    });
    document.getElementById('detailClose').addEventListener('click', closeDetailPanel);
    document.getElementById('detailOverlay').addEventListener('click', closeDetailPanel);
    document.getElementById('detailFilterBtn').addEventListener('click', () => {
      detailStartDate = document.getElementById('detailStartDate').value;
      detailEndDate = document.getElementById('detailEndDate').value;
      loadGroupDetails();
    });
    document.getElementById('detailClearFilter').addEventListener('click', () => {
      detailStartDate = detailEndDate = '';
      document.getElementById('detailStartDate').value = '';
      document.getElementById('detailEndDate').value = '';
      loadGroupDetails();
    });

    document.getElementById('langVi').addEventListener('click', function() { setLang('vi'); });
    document.getElementById('langZh').addEventListener('click', function() { setLang('zh'); });
    document.getElementById('msgSort').value = msgSortOrder;
    applyStaticI18n();
    loadGroups();
  </script>
</body>
</html>`;
}

module.exports = { generateDashboardHTML };
