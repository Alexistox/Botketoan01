const axios = require('axios');
const {
  getUsdtWalletAddress,
  getPendingOrders,
  activateSubscription,
  formatUsdt,
  roundUsdt
} = require('./subscriptionService');
const UsdtTransaction = require('../models/UsdtTransaction');
const messages = require('../src/messages/zh');

const USDT_CONTRACT = process.env.USDT_TRC20_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRONGRID_BASE = 'https://api.trongrid.io';

let isWatching = false;

function usdtFromSun(value) {
  return roundUsdt(Number(value) / 1e6);
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

async function watchUsdtPayments(bot) {
  if (isWatching) return;
  isWatching = true;

  try {
    const wallet = await getUsdtWalletAddress();
    if (!wallet) return;

    const pendingOrders = await getPendingOrders();
    if (!pendingOrders.length) return;

    const oldest = pendingOrders.reduce((min, o) => {
      const t = new Date(o.createdAt).getTime();
      return t < min ? t : min;
    }, Date.now());
    const minTimestamp = Math.max(0, oldest - 5 * 60 * 1000);

    const transfers = await fetchTrc20Transfers(wallet, minTimestamp);
    const usedHashes = new Set(
      (
        await UsdtTransaction.find({
          txHash: { $in: transfers.map((t) => t.transaction_id) }
        })
          .select('txHash')
          .lean()
      ).map((x) => x.txHash)
    );

    for (const order of pendingOrders) {
      const expected = roundUsdt(order.expectedAmount);
      const orderStart = new Date(order.createdAt).getTime();
      const orderEnd = new Date(order.expiresAt).getTime();

      for (const tx of transfers) {
        const txHash = tx.transaction_id;
        if (!txHash || usedHashes.has(txHash)) continue;
        if (tx.to !== wallet) continue;

        const amount = usdtFromSun(tx.value);
        if (amount !== expected) continue;

        const txTime = Number(tx.block_timestamp || 0);
        if (txTime < orderStart - 60000 || txTime > orderEnd + 120000) continue;

        try {
          const result = await activateSubscription(
            order.userId,
            order.username,
            order.planId,
            order,
            txHash,
            {
              fromAddress: tx.from || '',
              toAddress: tx.to || '',
              blockTimestamp: txTime ? new Date(txTime) : new Date()
            }
          );

          usedHashes.add(txHash);
          console.log(`Subscription activated for user ${order.userId}, tx ${txHash}`);

          if (bot) {
            const expStr = result.expiresAt.toLocaleString('zh-CN', { hour12: false });
            const msg = messages.subscriptionPaidConfirm
              .replace('{planId}', order.planId)
              .replace('{amount}', formatUsdt(amount))
              .replace('{expires}', expStr)
              .replace('{txShort}', txHash.slice(0, 16));
            try {
              await bot.sendMessage(order.userId, msg);
            } catch (dmErr) {
              console.warn('Could not DM user after subscription:', dmErr.message);
            }
          }
        } catch (actErr) {
          console.error('activateSubscription error:', actErr);
        }
        break;
      }
    }
  } catch (error) {
    console.error('watchUsdtPayments error:', error.message);
  } finally {
    isWatching = false;
  }
}

function startUsdtWatcher(bot) {
  const intervalMs = parseInt(process.env.SUBSCRIPTION_POLL_INTERVAL_MS, 10) || 60000;
  setTimeout(() => watchUsdtPayments(bot), 5000);
  setInterval(() => watchUsdtPayments(bot), intervalMs);
  console.log(`USDT subscription watcher started (interval ${intervalMs}ms)`);
}

module.exports = { watchUsdtPayments, startUsdtWatcher, fetchTrc20Transfers };
