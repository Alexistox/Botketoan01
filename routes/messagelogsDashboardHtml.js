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
      --bg: #0f1419;
      --panel: #1a2332;
      --panel2: #243044;
      --border: #2f3b4d;
      --text: #e7e9ea;
      --muted: #8b98a5;
      --accent: #1d9bf0;
      --green: #00ba7c;
      --orange: #ff7a00;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
    header {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
      padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--panel);
      position: sticky; top: 0; z-index: 20;
    }
    header h1 { margin: 0; font-size: 1.25rem; font-weight: 600; }
    .header-right { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .lang-switch { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    .lang-btn {
      background: var(--panel2); color: var(--muted); border: none; padding: 6px 12px;
      cursor: pointer; font: inherit; font-size: 0.85rem;
    }
    .lang-btn.active { background: var(--accent); color: #fff; }
    .lang-btn:hover:not(.active) { color: var(--text); }
    .meta { color: var(--muted); font-size: 0.875rem; }
    .layout { display: grid; grid-template-columns: 280px 1fr; min-height: calc(100vh - 64px); }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { max-height: 220px; border-right: none; border-bottom: 1px solid var(--border); }
      .detail-panel { width: 100%; max-width: 100%; }
    }
    .sidebar { background: var(--panel); border-right: 1px solid var(--border); overflow-y: auto; padding: 12px; }
    .search, .date-input {
      width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--bg); color: var(--text); font: inherit;
    }
    .search { margin-bottom: 10px; }
    .group-item {
      display: block; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 4px;
      border: none; border-radius: 8px; background: transparent; color: var(--text); cursor: pointer; font: inherit;
    }
    .group-item:hover { background: var(--panel2); }
    .group-item.active { background: var(--accent); color: #fff; }
    .group-item .count { opacity: 0.75; font-size: 0.8rem; }
    .main { padding: 16px 20px 40px; overflow-y: auto; min-width: 0; }
    .feed-toolbar {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px;
    }
    .feed-toolbar h2 { margin: 0; font-size: 1.1rem; flex: 1 1 200px; }
    .toolbar-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .btn {
      background: var(--panel2); color: var(--text); border: 1px solid var(--border);
      border-radius: 8px; padding: 8px 14px; cursor: pointer; font: inherit; white-space: nowrap;
    }
    .btn:hover { border-color: var(--accent); }
    .btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn-primary:hover { filter: brightness(1.08); }
    .date-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .date-row label { font-size: 0.8rem; color: var(--muted); }
    .date-input { width: auto; min-width: 130px; padding: 7px 10px; font-size: 0.85rem; }
    .msg {
      background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
      padding: 14px 16px; margin-bottom: 10px;
    }
    .msg-head { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: baseline; margin-bottom: 6px; }
    .msg-name { font-weight: 600; }
    .msg-user { color: var(--accent); font-size: 0.9rem; }
    .msg-time { color: var(--muted); font-size: 0.8rem; margin-left: auto; }
    .msg-body { white-space: pre-wrap; word-break: break-word; line-height: 1.45; margin: 8px 0; }
    .msg-media { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
    .msg-media img, .msg-media video { max-width: min(360px, 100%); max-height: 280px; border-radius: 8px; border: 1px solid var(--border); }
    .msg-media audio { width: min(360px, 100%); }
    .msg-media a.doc {
      color: var(--accent); text-decoration: none; padding: 8px 12px;
      border: 1px solid var(--border); border-radius: 8px; background: var(--panel2);
    }
    .pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; margin-top: 20px; }
    .pager button { background: var(--panel2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 8px 14px; cursor: pointer; font: inherit; }
    .pager button:disabled { opacity: 0.4; cursor: not-allowed; }
    .pager-jump { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .page-input {
      width: 64px; padding: 7px 8px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--bg); color: var(--text); font: inherit; text-align: center;
    }
    .page-input:focus { outline: none; border-color: var(--accent); }
    .feed-options {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      margin-bottom: 10px; padding: 8px 12px;
      background: var(--panel2); border: 1px solid var(--border); border-radius: 10px;
    }
    .feed-options label { font-size: 0.85rem; color: var(--muted); }
    .sort-select {
      min-width: 140px; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--bg); color: var(--text); font: inherit; cursor: pointer;
    }
    .sort-select:focus { outline: none; border-color: var(--accent); }
    .empty, .loading { color: var(--muted); padding: 40px 0; text-align: center; }
    .detail-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 100;
      opacity: 0; visibility: hidden; transition: opacity 0.2s;
    }
    .detail-overlay.open { opacity: 1; visibility: visible; }
    .detail-panel {
      position: fixed; top: 0; right: 0; width: min(480px, 100%); height: 100%;
      background: var(--panel); border-left: 1px solid var(--border); z-index: 101;
      transform: translateX(100%); transition: transform 0.25s ease;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .detail-panel.open { transform: translateX(0); }
    .detail-head {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 16px 18px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .detail-head h3 { margin: 0; font-size: 1.05rem; }
    .detail-body { overflow-y: auto; padding: 16px 18px 32px; flex: 1; }
    .stat-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px;
    }
    .stat-card {
      background: var(--panel2); border: 1px solid var(--border); border-radius: 10px; padding: 12px;
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
      border-bottom: 1px solid var(--border); padding: 8px 6px; text-align: left; vertical-align: top;
    }
    .data-table th { color: var(--muted); font-weight: 500; }
    .data-table a { color: var(--accent); text-decoration: none; }
    .filter-bar {
      background: var(--panel2); border: 1px solid var(--border); border-radius: 10px;
      padding: 12px; margin-bottom: 16px;
    }
    .filter-bar .date-row { margin-top: 8px; }
    .feed-search {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      margin-bottom: 14px; padding: 10px 12px;
      background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
    }
    .feed-search input {
      flex: 1 1 220px; min-width: 180px;
      padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--bg); color: var(--text); font: inherit;
    }
    .feed-search input:focus { outline: none; border-color: var(--accent); }
    .feed-search .meta { flex: 1 1 100%; font-size: 0.8rem; }
    mark.hl { background: rgba(255, 122, 0, 0.35); color: inherit; border-radius: 3px; padding: 0 2px; }
    .username-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .username-chip {
      display: inline-block; padding: 4px 10px; border-radius: 999px;
      background: var(--panel2); border: 1px solid var(--border); font-size: 0.82rem;
    }
    .username-chip a { color: var(--accent); text-decoration: none; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.72rem;
      background: var(--bg); border: 1px solid var(--border); color: var(--muted);
    }
  </style>
</head>
<body>
  <header>
    <h1>📋 <span data-i18n="title">Message Logs</span></h1>
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
      <input class="search" id="groupSearch" type="search" data-i18n="searchGroup" data-i18n-attr="placeholder" placeholder="Tìm nhóm..." autocomplete="off">
      <div id="groupList"><div class="loading" data-i18n="loadingGroups">Đang tải nhóm...</div></div>
    </aside>
    <section class="main">
      <div class="feed-toolbar">
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
      <div id="feed"><div class="empty" data-i18n="selectGroupHint">Chọn nhóm bên trái để xem tin nhắn</div></div>
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
    let msgSortOrder = localStorage.getItem('messagelogs_sort') || 'desc';
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
    }

    function mediaUrl(fileId) {
      if (!fileId) return '';
      return '/media/' + encodeURIComponent(fileId) + '?token=' + encodeURIComponent(TOKEN);
    }
    function escapeHtml(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function formatTime(iso) {
      try { return new Date(iso).toLocaleString('vi-VN', { hour12: false }); } catch (e) { return ''; }
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
        const rateHint = g.hasBotData
          ? ' · Rate ' + fmtRate(g.rate, '%') + ' · TG ' + fmtRate(g.exchangeRate)
          : '';
        return '<button type="button" class="group-item' + active + '" data-id="' + escapeHtml(g.chatId) + '">' +
          '<div>' + escapeHtml(g.groupName || g.chatId) + '</div>' +
          '<div class="count">' + g.count + ' tin · ' + escapeHtml(g.chatType || '') + rateHint + '</div></button>';
      }).join('');
      el.querySelectorAll('.group-item').forEach(btn => {
        btn.addEventListener('click', () => selectGroup(btn.getAttribute('data-id')));
      });
    }

    async function selectGroup(chatId) {
      activeChatId = chatId;
      page = 1;
      msgSearchQuery = '';
      document.getElementById('msgSearch').value = '';
      updateSearchInfo(0, '');
      document.getElementById('detailBtn').disabled = false;
      renderGroups(document.getElementById('groupSearch').value);
      const g = groups.find(x => x.chatId === chatId);
      document.getElementById('feedTitle').textContent =
        (g ? (g.groupName || chatId) : chatId) + (g ? ' · ' + g.count + ' ' + t('msgs') : '');
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
        '&chatId=' + encodeURIComponent(activeChatId) + '&page=' + page + '&limit=30&sort=' + encodeURIComponent(msgSortOrder);
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
      updateSearchInfo(data.total || 0, msgSearchQuery);
      document.getElementById('pager').style.display = totalPages > 1 ? 'flex' : 'none';
      updatePagerUi();
      const msgs = data.messages || [];
      if (!msgs.length) {
        feed.innerHTML = '<div class="empty">' +
          (msgSearchQuery ? t('noSearchMatch') + ' "' + escapeHtml(msgSearchQuery) + '"' : t('noMessages')) +
          '</div>';
        return;
      }
      const q = msgSearchQuery;
      feed.innerHTML = msgs.map(m => {
        let media = '';
        if (m.photoFileId || m.photoUrl) {
          const src = m.photoFileId ? mediaUrl(m.photoFileId) : m.photoUrl;
          media += '<a href="' + escapeHtml(src) + '" target="_blank" rel="noopener"><img src="' + escapeHtml(src) + '" alt="photo" loading="lazy"></a>';
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
        const user = m.username ? '@' + highlightText(m.username, q.replace(/^@/, '')) : '';
        return '<article class="msg"><div class="msg-head">' +
          '<span class="msg-name">' + highlightText(m.senderName || 'Unknown', q) + '</span>' +
          (m.username ? '<span class="msg-user">' + user + '</span>' : '') +
          '<span class="msg-time">' + escapeHtml(formatTime(m.timestamp)) + '</span></div>' +
          (m.content ? '<div class="msg-body">' + highlightText(m.content, q) + '</div>' : '') +
          (media ? '<div class="msg-media">' + media + '</div>' : '') + '</article>';
      }).join('');
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
      page = 1;
      loadMessages();
    });
    document.getElementById('msgFilterBtn').addEventListener('click', () => {
      msgStartDate = document.getElementById('msgStartDate').value;
      msgEndDate = document.getElementById('msgEndDate').value;
      page = 1;
      loadMessages();
    });
    function runMessageSearch() {
      msgSearchQuery = document.getElementById('msgSearch').value.trim();
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
