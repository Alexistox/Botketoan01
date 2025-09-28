const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Group = require('../models/Group');

/**
 * GET /report/:chatId - Hiển thị báo cáo giao dịch của nhóm
 */
router.get('/report/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { token } = req.query;

    // Kiểm tra token
    const group = await Group.findOne({ chatId });
    if (!group || !group.reportToken || group.reportToken !== token) {
      return res.status(403).send(`
        <html>
          <head><title>访问被拒绝</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🚫 访问被拒绝</h1>
            <p>无效的访问令牌或链接已过期</p>
          </body>
        </html>
      `);
    }

    // Kiểm tra token expiry
    if (group.reportTokenExpiry && new Date() > group.reportTokenExpiry) {
      return res.status(403).send(`
        <html>
          <head><title>链接已过期</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>⏰ 链接已过期</h1>
            <p>请重新生成报告链接</p>
          </body>
        </html>
      `);
    }

    // Lấy tất cả giao dịch của nhóm (sắp xếp theo thời gian)
    const transactions = await Transaction.find({ chatId })
      .sort({ timestamp: -1 })
      .lean();

    // Tạo HTML response
    const html = generateReportHTML(transactions, chatId);
    res.send(html);

  } catch (error) {
    console.error('Error in report route:', error);
    res.status(500).send(`
      <html>
        <head><title>服务器错误</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>❌ 服务器错误</h1>
          <p>生成报告时出错，请重试</p>
        </body>
      </html>
    `);
  }
});

/**
 * 生成HTML báo cáo
 */
function generateReportHTML(transactions, chatId) {
  const typeLabels = {
    'deposit': '存款 (+)',
    'withdraw': '提款 (-)',
    'payment': '付款 (%)',
    'setRate': '设置汇率',
    'setExchangeRate': '设置兑换率',
    'clear': '清零',
    'delete': '删除',
    'skip': '跳过'
  };

  const typeColors = {
    'deposit': '#28a745',
    'withdraw': '#dc3545',
    'payment': '#ffc107',
    'setRate': '#6f42c1',
    'setExchangeRate': '#6f42c1',
    'clear': '#6c757d',
    'delete': '#dc3545',
    'skip': '#17a2b8'
  };

  // Tính toán thống kê
  const stats = {
    total: transactions.length,
    deposits: transactions.filter(t => t.type === 'deposit').length,
    withdraws: transactions.filter(t => t.type === 'withdraw').length,
    payments: transactions.filter(t => t.type === 'payment').length,
    totalVND: transactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0),
    totalUSDT: transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.usdtAmount, 0)
  };

  const transactionRows = transactions.map((tx, index) => {
    const isNewest = index === 0; // Giao dịch đầu tiên là mới nhất
    const fireEmoji = isNewest ? '🔥 ' : '';
    
    return `
    <tr>
      <td>${index + 1} ${fireEmoji}</td>
      <td><span class="type-badge" style="background-color: ${typeColors[tx.type] || '#6c757d'}">${typeLabels[tx.type] || tx.type}</span></td>
      <td class="amount">${tx.amount ? tx.amount.toLocaleString() : '-'}</td>
      <td class="amount">${tx.usdtAmount ? tx.usdtAmount.toLocaleString() : '-'}</td>
      <td>${tx.senderName}</td>
      <td class="timestamp">${new Date(tx.timestamp).toLocaleString('vi-VN')}</td>
      <td class="message">${tx.message || '-'}</td>
    </tr>
  `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>交易报告 - 群组 ${chatId}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f8f9fa;
          color: #333;
          line-height: 1.6;
        }
        .container { 
          max-width: 1200px; 
          margin: 0 auto; 
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px 20px;
          border-radius: 10px;
          margin-bottom: 30px;
          text-align: center;
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { font-size: 1.2em; opacity: 0.9; }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          text-align: center;
        }
        .stat-number { font-size: 2em; font-weight: bold; color: #667eea; }
        .stat-label { color: #666; margin-top: 5px; }
        .table-container {
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
        th { 
          background-color: #f8f9fa; 
          font-weight: 600; 
          color: #333;
          position: sticky;
          top: 0;
        }
        tr:hover { background-color: #f8f9fa; }
        .type-badge {
          padding: 4px 12px;
          border-radius: 20px;
          color: white;
          font-size: 0.85em;
          font-weight: 500;
        }
        .amount { 
          font-weight: 600; 
          font-family: monospace;
          text-align: right;
        }
        .timestamp { font-size: 0.9em; color: #666; }
        .message { 
          max-width: 200px; 
          overflow: hidden; 
          text-overflow: ellipsis; 
          white-space: nowrap;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding: 20px;
          color: #666;
          font-size: 0.9em;
        }
        @media (max-width: 768px) {
          .container { padding: 10px; }
          .header h1 { font-size: 2em; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          table { font-size: 0.85em; }
          .message { max-width: 100px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 交易报告</h1>
          <p>群组 ID: ${chatId} | 生成时间: ${new Date().toLocaleString('vi-VN')}</p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${stats.total}</div>
            <div class="stat-label">总交易数</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.deposits}</div>
            <div class="stat-label">存款次数</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.withdraws}</div>
            <div class="stat-label">提款次数</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.payments}</div>
            <div class="stat-label">付款次数</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.totalVND.toLocaleString()}</div>
            <div class="stat-label">总存款 (VND)</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.totalUSDT.toLocaleString()}</div>
            <div class="stat-label">总付款 (USDT)</div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>类型</th>
                <th>金额 (VND)</th>
                <th>金额 (USDT)</th>
                <th>发送者</th>
                <th>时间</th>
                <th>消息</th>
              </tr>
            </thead>
            <tbody>
              ${transactionRows}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>🤖 由 Telegram Bot 自动生成 | 此链接24小时内有效</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = router; 