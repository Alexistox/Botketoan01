const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Group = require('../models/Group');
const Config = require('../models/Config');
const { getGroupNumberFormat } = require('../utils/formatter');
const { generateReportDashboardHTML } = require('./reportDashboardHtml');

function deniedPage(title, message) {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
body{font-family:system-ui,sans-serif;background:#f3efe6;color:#1c1917;display:grid;place-items:center;min-height:100vh;margin:0}
.card{background:#fffdf8;border:1px solid #e2d8c8;padding:28px 24px;border-radius:4px;max-width:420px;text-align:center}
h1{margin:0 0 8px;font-size:1.4rem}p{margin:0;color:#6b635a}
</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

/**
 * GET /report/:chatId - Dashboard báo cáo giao dịch (token 24h)
 */
router.get('/report/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { token } = req.query;

    const group = await Group.findOne({ chatId });
    if (!group || !group.reportToken || group.reportToken !== token) {
      return res.status(403).send(deniedPage('🚫 访问被拒绝', '无效的访问令牌或链接已过期'));
    }

    if (group.reportTokenExpiry && new Date() > group.reportTokenExpiry) {
      return res.status(403).send(deniedPage('⏰ 链接已过期', '请在群内重新发送 /report 生成新链接'));
    }

    const transactions = await Transaction.find({
      chatId,
      skipped: { $ne: true }
    })
      .sort({ timestamp: 1 })
      .lean();

    const configCurrency = await Config.findOne({
      key: `CURRENCY_UNIT_${chatId}`
    });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    const numberFormat = await getGroupNumberFormat(chatId);

    const html = generateReportDashboardHTML(transactions, chatId, {
      currencyUnit,
      numberFormat
    });
    res.send(html);
  } catch (error) {
    console.error('Error in report route:', error);
    res.status(500).send(deniedPage('❌ 服务器错误', '生成报告时出错，请重试'));
  }
});

module.exports = router;
