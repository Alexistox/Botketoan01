const express = require('express');
const router = express.Router();
const MessageLog = require('../models/MessageLog');
const MessageLogsAuth = require('../models/MessageLogsAuth');
const { getDownloadLink } = require('../utils/telegramUtils');

async function validateMessageLogsToken(token) {
  if (!token) return false;
  const auth = await MessageLogsAuth.findOne({ key: 'default' }).lean();
  if (!auth || !auth.token || auth.token !== token) return false;
  if (auth.tokenExpiry && new Date() > new Date(auth.tokenExpiry)) return false;
  return true;
}

function deniedHtml(title, message) {
  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:50px;background:#0f1419;color:#e7e9ea">
<h1>${title}</h1><p>${message}</p>
</body></html>`;
}

/**
 * GET /messagelogs?token= — Dashboard HTML
 */
router.get('/messagelogs', async (req, res) => {
  try {
    const { token } = req.query;
    if (!(await validateMessageLogsToken(token))) {
      return res.status(403).send(deniedHtml('🚫 Truy cập bị từ chối', 'Token không hợp lệ hoặc đã hết hạn. Gửi /messagelogs trong bot để lấy link mới.'));
    }

    const auth = await MessageLogsAuth.findOne({ key: 'default' }).lean();
    const expiryMs = auth?.tokenExpiry ? new Date(auth.tokenExpiry).getTime() - Date.now() : 0;
    const hoursLeft = Math.max(0, Math.floor(expiryMs / 3600000));

    res.send(generateDashboardHTML(token, hoursLeft));
  } catch (error) {
    console.error('Error in /messagelogs:', error);
    res.status(500).send(deniedHtml('❌ Lỗi máy chủ', 'Không thể tải dashboard.'));
  }
});

/**
 * GET /api/messagelogs/groups?token=
 */
router.get('/api/messagelogs/groups', async (req, res) => {
  try {
    const { token } = req.query;
    if (!(await validateMessageLogsToken(token))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const groups = await MessageLog.aggregate([
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$chatId',
          groupName: { $first: '$groupName' },
          chatType: { $first: '$chatType' },
          count: { $sum: 1 },
          lastMessageAt: { $first: '$timestamp' }
        }
      },
      { $sort: { lastMessageAt: -1 } }
    ]);

    res.json({
      groups: groups.map((g) => ({
        chatId: g._id,
        groupName: g.groupName || (g.chatType === 'private' ? 'Private DM' : g._id),
        chatType: g.chatType || '',
        count: g.count,
        lastMessageAt: g.lastMessageAt
      }))
    });
  } catch (error) {
    console.error('Error in /api/messagelogs/groups:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/messagelogs?token=&chatId=&page=&limit=
 */
router.get('/api/messagelogs', async (req, res) => {
  try {
    const { token, chatId } = req.query;
    if (!(await validateMessageLogsToken(token))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!chatId) {
      return res.status(400).json({ error: 'chatId required' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const skip = (page - 1) * limit;

    const filter = { chatId: String(chatId) };
    const [total, messages] = await Promise.all([
      MessageLog.countDocuments(filter),
      MessageLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      messages: messages.map((m) => ({
        id: m._id,
        senderName: m.senderName || '',
        username: m.username || '',
        senderId: m.senderId || '',
        timestamp: m.timestamp,
        content: m.content || '',
        photoFileId: m.photoFileId || '',
        videoFileId: m.videoFileId || '',
        voiceFileId: m.voiceFileId || '',
        documentFileId: m.documentFileId || '',
        photoUrl: m.photoUrl || '',
        videoUrl: m.videoUrl || '',
        voiceUrl: m.voiceUrl || '',
        documentUrl: m.documentUrl || ''
      }))
    });
  } catch (error) {
    console.error('Error in /api/messagelogs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /media/:fileId?token= — redirect to Telegram file
 */
router.get('/media/:fileId', async (req, res) => {
  try {
    const { token } = req.query;
    const { fileId } = req.params;
    if (!(await validateMessageLogsToken(token))) {
      return res.status(403).send('Forbidden');
    }
    if (!fileId) {
      return res.status(400).send('fileId required');
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const url = await getDownloadLink(fileId, botToken);
    if (!url) {
      return res.status(404).send('Media not found or expired');
    }
    return res.redirect(url);
  } catch (error) {
    console.error('Error in /media/:fileId:', error);
    res.status(500).send('Server error');
  }
});

function generateDashboardHTML(token, hoursLeft) {
  const safeToken = String(token).replace(/[<>"'&]/g, '');
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
      --accent-dim: #1a8cd8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    header h1 { margin: 0; font-size: 1.25rem; font-weight: 600; }
    .meta { color: var(--muted); font-size: 0.875rem; }
    .layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      min-height: calc(100vh - 64px);
    }
    @media (max-width: 800px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { max-height: 220px; border-right: none; border-bottom: 1px solid var(--border); }
    }
    .sidebar {
      background: var(--panel);
      border-right: 1px solid var(--border);
      overflow-y: auto;
      padding: 12px;
    }
    .search {
      width: 100%;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      margin-bottom: 10px;
    }
    .group-item {
      display: block;
      width: 100%;
      text-align: left;
      padding: 10px 12px;
      margin-bottom: 4px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      cursor: pointer;
      font: inherit;
    }
    .group-item:hover { background: var(--panel2); }
    .group-item.active { background: var(--accent); color: #fff; }
    .group-item .count { color: inherit; opacity: 0.75; font-size: 0.8rem; }
    .main { padding: 16px 20px 40px; overflow-y: auto; }
    .main-title { margin: 0 0 16px; font-size: 1.1rem; }
    .msg {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 10px;
    }
    .msg-head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: baseline;
      margin-bottom: 6px;
    }
    .msg-name { font-weight: 600; }
    .msg-user { color: var(--accent); font-size: 0.9rem; }
    .msg-time { color: var(--muted); font-size: 0.8rem; margin-left: auto; }
    .msg-body {
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.45;
      margin: 8px 0;
    }
    .msg-media { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
    .msg-media img, .msg-media video {
      max-width: min(360px, 100%);
      max-height: 280px;
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    .msg-media audio { width: min(360px, 100%); }
    .msg-media a.doc {
      color: var(--accent);
      text-decoration: none;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel2);
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 20px;
    }
    .pager button {
      background: var(--panel2);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 14px;
      cursor: pointer;
      font: inherit;
    }
    .pager button:disabled { opacity: 0.4; cursor: not-allowed; }
    .pager button:not(:disabled):hover { border-color: var(--accent); }
    .empty, .loading { color: var(--muted); padding: 40px 0; text-align: center; }
  </style>
</head>
<body>
  <header>
    <h1>📋 Message Logs</h1>
    <div class="meta">Token còn khoảng <strong id="hoursLeft">${hoursLeft}</strong> giờ</div>
  </header>
  <div class="layout">
    <aside class="sidebar">
      <input class="search" id="groupSearch" type="search" placeholder="Tìm nhóm..." autocomplete="off">
      <div id="groupList"><div class="loading">Đang tải nhóm...</div></div>
    </aside>
    <section class="main">
      <h2 class="main-title" id="feedTitle">Chọn một nhóm</h2>
      <div id="feed"><div class="empty">Chọn nhóm bên trái để xem tin nhắn</div></div>
      <div class="pager" id="pager" style="display:none">
        <button type="button" id="prevBtn">← Trước</button>
        <span class="meta" id="pageInfo"></span>
        <button type="button" id="nextBtn">Sau →</button>
      </div>
    </section>
  </div>
  <script>
    const TOKEN = ${JSON.stringify(safeToken)};
    let groups = [];
    let activeChatId = null;
    let page = 1;
    let totalPages = 1;

    function mediaUrl(fileId) {
      if (!fileId) return '';
      return '/media/' + encodeURIComponent(fileId) + '?token=' + encodeURIComponent(TOKEN);
    }

    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function formatTime(iso) {
      try {
        const d = new Date(iso);
        return d.toLocaleString('vi-VN', { hour12: false });
      } catch (e) { return ''; }
    }

    async function loadGroups() {
      const res = await fetch('/api/messagelogs/groups?token=' + encodeURIComponent(TOKEN));
      if (!res.ok) {
        document.getElementById('groupList').innerHTML = '<div class="empty">Không tải được nhóm</div>';
        return;
      }
      const data = await res.json();
      groups = data.groups || [];
      renderGroups();
      if (groups.length) selectGroup(groups[0].chatId);
    }

    function renderGroups(filter) {
      const q = (filter || '').trim().toLowerCase();
      const list = groups.filter(g => {
        if (!q) return true;
        return (g.groupName || '').toLowerCase().includes(q) || String(g.chatId).includes(q);
      });
      const el = document.getElementById('groupList');
      if (!list.length) {
        el.innerHTML = '<div class="empty">Không có nhóm</div>';
        return;
      }
      el.innerHTML = list.map(g => {
        const active = g.chatId === activeChatId ? ' active' : '';
        const name = escapeHtml(g.groupName || g.chatId);
        return '<button type="button" class="group-item' + active + '" data-id="' + escapeHtml(g.chatId) + '">' +
          '<div>' + name + '</div>' +
          '<div class="count">' + g.count + ' tin · ' + escapeHtml(g.chatType || '') + '</div>' +
          '</button>';
      }).join('');
      el.querySelectorAll('.group-item').forEach(btn => {
        btn.addEventListener('click', () => selectGroup(btn.getAttribute('data-id')));
      });
    }

    async function selectGroup(chatId) {
      activeChatId = chatId;
      page = 1;
      renderGroups(document.getElementById('groupSearch').value);
      const g = groups.find(x => x.chatId === chatId);
      document.getElementById('feedTitle').textContent =
        (g ? (g.groupName || chatId) : chatId) + (g ? ' · ' + g.count + ' tin' : '');
      await loadMessages();
    }

    async function loadMessages() {
      const feed = document.getElementById('feed');
      feed.innerHTML = '<div class="loading">Đang tải tin nhắn...</div>';
      const url = '/api/messagelogs?token=' + encodeURIComponent(TOKEN) +
        '&chatId=' + encodeURIComponent(activeChatId) +
        '&page=' + page + '&limit=30';
      const res = await fetch(url);
      if (!res.ok) {
        feed.innerHTML = '<div class="empty">Không tải được tin nhắn</div>';
        return;
      }
      const data = await res.json();
      totalPages = data.totalPages || 1;
      const pager = document.getElementById('pager');
      pager.style.display = totalPages > 1 ? 'flex' : 'none';
      document.getElementById('pageInfo').textContent = 'Trang ' + page + '/' + totalPages;
      document.getElementById('prevBtn').disabled = page <= 1;
      document.getElementById('nextBtn').disabled = page >= totalPages;

      const msgs = data.messages || [];
      if (!msgs.length) {
        feed.innerHTML = '<div class="empty">Chưa có tin nhắn</div>';
        return;
      }
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
          media += '<a class="doc" href="' + escapeHtml(src) + '" target="_blank" rel="noopener">📄 Tài liệu</a>';
        }
        const user = m.username ? '@' + escapeHtml(m.username) : '';
        return '<article class="msg">' +
          '<div class="msg-head">' +
            '<span class="msg-name">' + escapeHtml(m.senderName || 'Unknown') + '</span>' +
            (user ? '<span class="msg-user">' + user + '</span>' : '') +
            '<span class="msg-time">' + escapeHtml(formatTime(m.timestamp)) + '</span>' +
          '</div>' +
          (m.content ? '<div class="msg-body">' + escapeHtml(m.content) + '</div>' : '') +
          (media ? '<div class="msg-media">' + media + '</div>' : '') +
        '</article>';
      }).join('');
    }

    document.getElementById('groupSearch').addEventListener('input', (e) => {
      renderGroups(e.target.value);
    });
    document.getElementById('prevBtn').addEventListener('click', () => {
      if (page > 1) { page -= 1; loadMessages(); }
    });
    document.getElementById('nextBtn').addEventListener('click', () => {
      if (page < totalPages) { page += 1; loadMessages(); }
    });

    loadGroups();
  </script>
</body>
</html>`;
}

module.exports = router;
