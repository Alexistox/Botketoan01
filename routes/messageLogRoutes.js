const express = require('express');
const router = express.Router();
const MessageLog = require('../models/MessageLog');
const MessageLogsAuth = require('../models/MessageLogsAuth');
const { getDownloadLink } = require('../utils/telegramUtils');
const { fetchGroupDetails, findGroupByChatId } = require('../services/messagelogsGroupDetails');
const { generateDashboardHTML } = require('./messagelogsDashboardHtml');

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
      groups: await Promise.all(
        groups.map(async (g) => {
          const botGroup = await findGroupByChatId(g._id);
          return {
            chatId: g._id,
            groupName: g.groupName || (g.chatType === 'private' ? 'Private DM' : g._id),
            chatType: g.chatType || '',
            count: g.count,
            lastMessageAt: g.lastMessageAt,
            hasBotData: !!botGroup,
            rate: botGroup?.rate || 0,
            exchangeRate: botGroup?.exchangeRate || 0,
            // Botketoan01: withdrawRate/withdrawExchangeRate (viet03 dùng wrate/wexchangeRate)
            wrate: botGroup?.withdrawRate ?? botGroup?.wrate ?? 0,
            wexchangeRate: botGroup?.withdrawExchangeRate ?? botGroup?.wexchangeRate ?? 0,
            totalVND: botGroup?.totalVND || 0,
            totalUSDT: botGroup?.totalUSDT || 0
          };
        })
      )
    });
  } catch (error) {
    console.error('Error in /api/messagelogs/groups:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

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
    const { startDate, endDate, q } = req.query;

    const filter = { chatId: String(chatId) };
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    const searchText = typeof q === 'string' ? q.trim() : '';
    if (searchText) {
      const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'i');
      filter.$or = [
        { content: re },
        { senderName: re },
        { username: re },
        { senderId: re }
      ];
    }

    const sortDir = String(req.query.sort || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    const [total, messages] = await Promise.all([
      MessageLog.countDocuments(filter),
      MessageLog.find(filter)
        .sort({ timestamp: sortDir })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      query: searchText || null,
      sort: sortDir === 1 ? 'asc' : 'desc',
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

router.get('/api/messagelogs/groups/:chatId/details', async (req, res) => {
  try {
    const { token } = req.query;
    const { chatId } = req.params;
    if (!(await validateMessageLogsToken(token))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const data = await fetchGroupDetails(chatId, {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      bot: (() => {
        try {
          return require('../app').bot;
        } catch (_) {
          return null;
        }
      })()
    });

    if (!data) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error in /api/messagelogs/groups/:chatId/details:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

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

module.exports = router;
