const axios = require('axios');
const {
  getWalletAddress,
  expireStaleOrders,
  activateOrder,
  toMicros,
  paidText,
  notifyFeeTargets,
  remindIfExpired,
  ensureLicense
} = require('./serverFeeService');
const ServerFeeOrder = require('../models/ServerFeeOrder');

const USDT_CONTRACT = process.env.USDT_TRC20_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRONGRID_BASE = 'https://api.trongrid.io';

let isWatching = false;

function usdtMicros(value) {
  return Number(value);
}

async function fetchTrc20Transfers(walletAddress, minTimestamp = 0) {
  const headers = {};
  if (process.env.TRONGRID_API_KEY) {
    headers['TRON-PRO-API-KEY'] = process.env.TRONGRID_API_KEY;
  }

  const params = {
    limit: 50,
    contract_address: USDT_CONTRACT,
    only_to: true
  };
  if (minTimestamp > 0) params.min_timestamp = minTimestamp;

  const url = `${TRONGRID_BASE}/v1/accounts/${walletAddress}/transactions/trc20`;
  const res = await axios.get(url, { params, headers, timeout: 30000 });
  return res.data?.data || [];
}

async function watchServerFeePayments(bot) {
  if (isWatching) return;
  isWatching = true;

  try {
    await ensureLicense();
    await expireStaleOrders();

    const wallet = getWalletAddress();
    const pending = wallet ? await ServerFeeOrder.find({
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }).lean() : [];

    if (wallet && pending.length) {
      const oldest = pending.reduce((min, order) => {
        const created = new Date(order.createdAt).getTime();
        return created < min ? created : min;
      }, Date.now());
      const transfers = await fetchTrc20Transfers(wallet, Math.max(0, oldest - 5 * 60 * 1000));
      const hashes = transfers.map((tx) => tx.transaction_id).filter(Boolean);
      const used = new Set(
        (await ServerFeeOrder.find({ txHash: { $in: hashes } }).select('txHash').lean())
          .map((row) => row.txHash)
      );

      for (const order of pending) {
        const expectedMicros = toMicros(order.expectedAmount);
        const orderStart = new Date(order.createdAt).getTime();
        const orderEnd = new Date(order.expiresAt).getTime();

        for (const tx of transfers) {
          const txHash = tx.transaction_id;
          if (!txHash || used.has(txHash)) continue;
          if (tx.to !== wallet) continue;
          if (usdtMicros(tx.value) !== expectedMicros) continue;

          const txTime = Number(tx.block_timestamp || 0);
          if (txTime < orderStart - 60000 || txTime > orderEnd + 120000) continue;

          const result = await activateOrder(order._id, txHash, {
            fromAddress: tx.from || '',
            toAddress: tx.to || ''
          });
          if (!result) continue;

          used.add(txHash);
          console.log(`Server fee paid, extended until ${result.paidUntil.toISOString()}`);
          if (bot) {
            await notifyFeeTargets(bot, paidText(order.expectedAmount, result.paidUntil));
          }
          break;
        }
      }
    }

    if (bot) await remindIfExpired(bot);
  } catch (error) {
    console.error('watchServerFeePayments error:', error.message);
  } finally {
    isWatching = false;
  }
}

function startServerFeeWatcher(bot) {
  const intervalMs = parseInt(process.env.SUBSCRIPTION_POLL_INTERVAL_MS, 10) || 60000;
  setTimeout(() => watchServerFeePayments(bot), 5000);
  setInterval(() => watchServerFeePayments(bot), intervalMs);
  const walletReady = Boolean(getWalletAddress());
  console.log(`Server fee watcher started (interval ${intervalMs}ms, wallet ${walletReady ? 'set' : 'empty'})`);
}

module.exports = {
  watchServerFeePayments,
  startServerFeeWatcher,
  fetchTrc20Transfers
};
