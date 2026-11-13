const ServerLicense = require('../models/ServerLicense');
const ServerFeeOrder = require('../models/ServerFeeOrder');
const User = require('../models/User');
const { isUserOwner } = require('../utils/permissions');

const USDT_DECIMALS = 6;
const TRIAL_MS = 30 * 24 * 60 * 60 * 1000;
const EXTEND_MS = 30 * 24 * 60 * 60 * 1000;
const ORDER_TTL_MS = 24 * 60 * 60 * 1000;
const REMIND_MS = 24 * 60 * 60 * 1000;
const LICENSE_KEY = 'server';

function toMicros(n) {
  return Math.round(Number(n) * 10 ** USDT_DECIMALS);
}

function fromMicros(micros) {
  return micros / 10 ** USDT_DECIMALS;
}

function formatUsdt(n) {
  return (toMicros(n) / 10 ** USDT_DECIMALS).toFixed(USDT_DECIMALS);
}

function formatCnTime(date) {
  return new Date(date).toLocaleString('zh-CN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getWalletAddress() {
  return (process.env.LICENSOR_USDT_ADDRESS || '').trim();
}

function getFeeUsdt() {
  const raw = (process.env.SERVER_FEE_USDT || '').trim();
  if (!raw) return null;
  const fee = Number(raw);
  if (!Number.isFinite(fee) || fee <= 0) return null;
  return fromMicros(toMicros(fee));
}

function isFeeConfigured() {
  return Boolean(getWalletAddress() && getFeeUsdt());
}

function isXufeiCommand(text) {
  const normalized = (text || '').trim().toLowerCase();
  return normalized === 'xufei' || normalized === '/xufei';
}

function isPhiThangCommand(text) {
  return /^\/phithang(?:\s|$)/i.test((text || '').trim());
}

function getFeeNotifyChatId() {
  const raw = (process.env.FEE_NOTIFY_CHAT_ID || '').trim();
  return /^-?\d+$/.test(raw) ? raw : '';
}

async function ensureLicense() {
  const existing = await ServerLicense.findOne({ key: LICENSE_KEY });
  if (existing) return existing;
  try {
    return await ServerLicense.create({
      key: LICENSE_KEY,
      paidUntil: new Date(Date.now() + TRIAL_MS),
      feeEnabled: false
    });
  } catch (error) {
    if (error.code === 11000) {
      return ServerLicense.findOne({ key: LICENSE_KEY });
    }
    throw error;
  }
}

async function isServerFeeActive() {
  const license = await ensureLicense();
  if (!license || license.feeEnabled !== true) return true;
  return Boolean(license.paidUntil && new Date(license.paidUntil) > new Date());
}

async function getDmOwners() {
  const owners = await User.find({ isOwner: true }).select('userId username').lean();
  return owners.filter((owner) => /^\d+$/.test(String(owner.userId || '')));
}

async function expireStaleOrders() {
  await ServerFeeOrder.updateMany(
    { status: 'pending', expiresAt: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
}

async function getOpenOrder() {
  await expireStaleOrders();
  return ServerFeeOrder.findOne({
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
}

function generateSuffixMicros() {
  return Math.floor(Math.random() * 999999) + 1;
}

async function createOrder() {
  const wallet = getWalletAddress();
  const fee = getFeeUsdt();
  if (!wallet || !fee) {
    throw new Error('SERVER_FEE_NOT_CONFIGURED');
  }

  await expireStaleOrders();
  await ServerFeeOrder.updateMany(
    { status: 'pending' },
    { $set: { status: 'cancelled' } }
  );

  const baseMicros = toMicros(fee);
  let expectedMicros = baseMicros + generateSuffixMicros();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const clash = await ServerFeeOrder.findOne({
      status: 'pending',
      expectedAmount: fromMicros(expectedMicros),
      expiresAt: { $gt: new Date() }
    }).lean();
    if (!clash) break;
    expectedMicros = baseMicros + generateSuffixMicros();
  }

  const order = await ServerFeeOrder.create({
    baseAmount: fromMicros(baseMicros),
    expectedAmount: fromMicros(expectedMicros),
    status: 'pending',
    expiresAt: new Date(Date.now() + ORDER_TTL_MS)
  });

  return { order, wallet };
}

function missingConfigText() {
  return '尚未配置收款地址或服务器费用，暂时无法生成续费订单。';
}

function paymentText({ kind, amount, wallet, orderExpires, paidUntil }) {
  const amountText = formatUsdt(amount);
  const walletHtml = escapeHtml(wallet);
  const orderExpiresText = formatCnTime(orderExpires);
  const intro = kind === 'expired'
    ? '服务器费用已到期，记账已暂停。'
    : '续费订单已生成。';
  const after = kind === 'expired'
    ? '到账确认后将自动续期30天并恢复记账。'
    : '到账后，使用期限将从当前到期时间起延长30天。';
  const currentLine = paidUntil
    ? `\n当前到期时间：${formatCnTime(paidUntil)}`
    : '';

  return (
    `${intro}\n\n` +
    `请在24小时内向以下TRC20地址转入恰好 <code>${amountText}</code> USDT。\n` +
    '金额必须完全一致，少转或多转都无法自动确认。\n' +
    `${after}\n\n` +
    `收款地址：\n<code>${walletHtml}</code>\n\n` +
    `订单有效期至：${orderExpiresText}` +
    currentLine
  );
}

function paidText(amount, paidUntil) {
  return (
    `已收到服务器费用 ${formatUsdt(amount)} USDT，记账已恢复。\n` +
    `新的到期时间：${formatCnTime(paidUntil)}`
  );
}

async function activateOrder(orderId, txHash, meta = {}) {
  const updated = await ServerFeeOrder.findOneAndUpdate(
    { _id: orderId, status: 'pending', txHash: null },
    {
      $set: {
        status: 'paid',
        txHash,
        paidAt: new Date(),
        fromAddress: meta.fromAddress || '',
        toAddress: meta.toAddress || ''
      }
    },
    { new: true }
  );
  if (!updated) return null;

  const license = await ensureLicense();
  const now = new Date();
  const base = license.paidUntil && new Date(license.paidUntil) > now
    ? new Date(license.paidUntil)
    : now;
  license.paidUntil = new Date(base.getTime() + EXTEND_MS);
  await license.save();
  return { order: updated, paidUntil: license.paidUntil };
}

async function notifyFeeTargets(bot, text, options = {}) {
  await dmOwners(bot, text, options);
  const chatId = getFeeNotifyChatId();
  if (!chatId || !bot) return;
  try {
    await bot.sendMessage(chatId, text, options);
  } catch (error) {
    console.warn(`Server fee group notify failed: ${error.message}`);
  }
}

async function dmOwners(bot, text, options = {}) {
  const owners = await getDmOwners();
  if (!owners.length) {
    console.warn('Server fee reminder skipped: no owner with a numeric Telegram id');
    return 0;
  }
  let sent = 0;
  for (const owner of owners) {
    try {
      await bot.sendMessage(owner.userId, text, options);
      sent += 1;
    } catch (error) {
      console.warn(`Server fee DM failed for ${owner.userId}: ${error.message}`);
    }
  }
  return sent;
}

async function buildOpenPaymentMessage(kind) {
  if (!isFeeConfigured()) return { text: missingConfigText(), html: false };
  let order = kind === 'early' ? null : await getOpenOrder();
  if (!order) {
    const created = await createOrder();
    order = created.order;
  }
  const license = await ensureLicense();
  return {
    html: true,
    text: paymentText({
      kind,
      amount: order.expectedAmount,
      wallet: getWalletAddress(),
      orderExpires: order.expiresAt,
      paidUntil: kind === 'early' ? license.paidUntil : null
    })
  };
}

async function remindIfExpired(bot) {
  const license = await ensureLicense();
  if (!license || license.feeEnabled !== true) return;
  if (new Date(license.paidUntil) > new Date()) return;

  const last = license.lastRemindedAt ? new Date(license.lastRemindedAt).getTime() : 0;
  if (Date.now() - last < REMIND_MS) return;

  const message = await buildOpenPaymentMessage('expired');
  await notifyFeeTargets(bot, message.text, message.html ? { parse_mode: 'HTML' } : {});
  license.lastRemindedAt = new Date();
  await license.save();
}

async function handlePhiThangCommand(bot, msg) {
  if (!msg.chat || msg.chat.type !== 'private' || !msg.from) return;
  const isOwner = await isUserOwner(msg.from.id);
  if (!isOwner) return;

  const action = (msg.text || '').trim().toLowerCase().replace(/^\/phithang(?:\s+)?/, '');
  if (action !== 'on' && action !== 'off') return;

  try {
    const license = await ensureLicense();
    if (action === 'off') {
      license.feeEnabled = false;
      await license.save();
      await bot.sendMessage(msg.chat.id, 'Đã tắt thu phí.');
      return;
    }

    const paid = await ServerFeeOrder.findOne({ status: 'paid' }).select('_id').lean();
    const stillPaid = Boolean(paid) && license.paidUntil && new Date(license.paidUntil) > new Date();
    license.feeEnabled = true;
    if (!stillPaid) {
      license.paidUntil = new Date(Date.now() - 1000);
    }
    await license.save();

    if (stillPaid) {
      await bot.sendMessage(
        msg.chat.id,
        `Đã bật thu phí. Hạn thanh toán còn đến ${formatCnTime(license.paidUntil)}.`
      );
      return;
    }

    const message = await buildOpenPaymentMessage('expired');
    await notifyFeeTargets(bot, message.text, message.html ? { parse_mode: 'HTML' } : {});
    license.lastRemindedAt = new Date();
    await license.save();
    await bot.sendMessage(msg.chat.id, 'Đã bật thu phí. Sổ đã khóa đến khi thanh toán.');
  } catch (error) {
    console.error('handlePhiThangCommand error:', error);
    await bot.sendMessage(msg.chat.id, '处理月费开关时出错，请稍后再试。');
  }
}

async function handleXufeiCommand(bot, msg) {
  if (!msg.chat || msg.chat.type !== 'private' || !msg.from) return;
  const isOwner = await isUserOwner(msg.from.id);
  if (!isOwner) return;

  try {
    const message = await buildOpenPaymentMessage('early');
    await bot.sendMessage(
      msg.chat.id,
      message.text,
      message.html ? { parse_mode: 'HTML' } : {}
    );
  } catch (error) {
    console.error('handleXufeiCommand error:', error);
    await bot.sendMessage(msg.chat.id, '生成续费订单时出错，请稍后再试。');
  }
}

module.exports = {
  ORDER_TTL_MS,
  REMIND_MS,
  toMicros,
  formatUsdt,
  formatCnTime,
  getWalletAddress,
  getFeeUsdt,
  isFeeConfigured,
  isXufeiCommand,
  isPhiThangCommand,
  ensureLicense,
  isServerFeeActive,
  getDmOwners,
  expireStaleOrders,
  getOpenOrder,
  createOrder,
  activateOrder,
  dmOwners,
  notifyFeeTargets,
  remindIfExpired,
  handleXufeiCommand,
  handlePhiThangCommand,
  buildOpenPaymentMessage,
  missingConfigText,
  paymentText,
  paidText
};
