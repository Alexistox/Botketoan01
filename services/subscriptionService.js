const Config = require('../models/Config');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const SubscriptionOrder = require('../models/SubscriptionOrder');
const UserSubscription = require('../models/UserSubscription');
const UsdtTransaction = require('../models/UsdtTransaction');
const { isUserAdmin, isUserOwner } = require('../utils/permissions');
const messages = require('../src/messages/zh');

const ORDER_TTL_MIN = parseInt(process.env.SUBSCRIPTION_ORDER_TTL_MIN, 10) || 30;
const USDT_DECIMALS = 6;

function roundUsdt(n) {
  return Math.round(Number(n) * 10 ** USDT_DECIMALS) / 10 ** USDT_DECIMALS;
}

function formatUsdt(n) {
  return roundUsdt(n).toFixed(USDT_DECIMALS);
}

function formatUsdtDisplay(n) {
  return String(Math.round(roundUsdt(n)));
}

function generateUniqueSuffix() {
  return Math.floor(Math.random() * 999999) / 10 ** USDT_DECIMALS;
}

async function getUsdtWalletAddress() {
  const config = await Config.findOne({ key: 'USDT_ADDRESS' }).lean();
  return config?.value ? String(config.value).trim() : '';
}

async function getPlans() {
  return SubscriptionPlan.find({ active: true }).sort({ durationDays: 1 }).lean();
}

async function getPlan(planId) {
  return SubscriptionPlan.findOne({ planId, active: true }).lean();
}

async function setPlanPrice(planId, priceUsdt) {
  const price = roundUsdt(priceUsdt);
  if (price < 0) throw new Error(messages.subscriptionPriceInvalid);
  const plan = await SubscriptionPlan.findOneAndUpdate(
    { planId },
    { priceUsdt: price },
    { new: true }
  );
  if (!plan) throw new Error(messages.subscriptionInvalidPlan);
  return plan;
}

async function expireStaleOrders() {
  await SubscriptionOrder.updateMany(
    { status: 'pending', expiresAt: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
}

async function cancelPendingOrders(userId) {
  await SubscriptionOrder.updateMany(
    { userId: String(userId), status: 'pending' },
    { $set: { status: 'cancelled' } }
  );
}

async function createOrder(userId, username, planId) {
  await expireStaleOrders();
  const plan = await getPlan(planId);
  if (!plan) throw new Error(messages.subscriptionInvalidPlan);

  const wallet = await getUsdtWalletAddress();
  if (!wallet) throw new Error(messages.subscriptionNoWallet);

  await cancelPendingOrders(userId);

  const baseAmount = roundUsdt(plan.priceUsdt);
  let expectedAmount = roundUsdt(baseAmount + generateUniqueSuffix());
  let attempts = 0;
  while (attempts < 10) {
    const clash = await SubscriptionOrder.findOne({
      status: 'pending',
      expectedAmount,
      expiresAt: { $gt: new Date() }
    }).lean();
    if (!clash) break;
    expectedAmount = roundUsdt(baseAmount + generateUniqueSuffix());
    attempts += 1;
  }

  const expiresAt = new Date(Date.now() + ORDER_TTL_MIN * 60 * 1000);
  const order = await SubscriptionOrder.create({
    userId: String(userId),
    username: username || '',
    planId,
    baseAmount,
    expectedAmount,
    status: 'pending',
    expiresAt
  });

  return { order, plan, wallet, orderTtlMin: ORDER_TTL_MIN };
}

function addDuration(fromDate, durationDays) {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + durationDays);
  return d;
}

async function activateSubscription(userId, username, planId, order, txHash, txMeta = {}) {
  const plan = await getPlan(planId);
  if (!plan) throw new Error(messages.subscriptionInvalidPlan);

  const now = new Date();
  let sub = await UserSubscription.findOne({ userId: String(userId) });
  let baseDate = now;
  if (sub && sub.expiresAt > now) {
    baseDate = sub.expiresAt;
  }
  const expiresAt = addDuration(baseDate, plan.durationDays);

  sub = await UserSubscription.findOneAndUpdate(
    { userId: String(userId) },
    {
      userId: String(userId),
      username: username || sub?.username || '',
      planId,
      expiresAt,
      lastOrderId: order._id
    },
    { upsert: true, new: true }
  );

  await SubscriptionOrder.findByIdAndUpdate(order._id, {
    status: 'paid',
    txHash,
    paidAt: now
  });

  if (txHash) {
    await UsdtTransaction.findOneAndUpdate(
      { txHash },
      {
        txHash,
        orderId: order._id,
        userId: String(userId),
        amount: order.expectedAmount,
        fromAddress: txMeta.fromAddress || '',
        toAddress: txMeta.toAddress || '',
        blockTimestamp: txMeta.blockTimestamp || now
      },
      { upsert: true }
    );
  }

  return { sub, plan, expiresAt };
}

async function grantSubscription(userId, username, planId) {
  const plan = await getPlan(planId);
  if (!plan) throw new Error(messages.subscriptionInvalidPlan);

  const now = new Date();
  let sub = await UserSubscription.findOne({ userId: String(userId) });
  let baseDate = now;
  if (sub && sub.expiresAt > now) baseDate = sub.expiresAt;
  const expiresAt = addDuration(baseDate, plan.durationDays);

  sub = await UserSubscription.findOneAndUpdate(
    { userId: String(userId) },
    {
      userId: String(userId),
      username: username || '',
      planId,
      expiresAt
    },
    { upsert: true, new: true }
  );

  return { sub, plan, expiresAt };
}

async function getUserSubscription(userId) {
  return UserSubscription.findOne({ userId: String(userId) }).lean();
}

async function hasActiveSubscription(userId) {
  if (!userId) return false;
  const uid = String(userId);
  if (await isUserOwner(uid)) return true;
  if (await isUserAdmin(uid)) return true;

  const sub = await UserSubscription.findOne({ userId: uid }).lean();
  if (!sub || !sub.expiresAt) return false;
  return new Date(sub.expiresAt) > new Date();
}

async function getPendingOrders() {
  await expireStaleOrders();
  return SubscriptionOrder.find({
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).lean();
}

module.exports = {
  ORDER_TTL_MIN,
  formatUsdt,
  formatUsdtDisplay,
  roundUsdt,
  getUsdtWalletAddress,
  getPlans,
  getPlan,
  setPlanPrice,
  createOrder,
  activateSubscription,
  grantSubscription,
  getUserSubscription,
  hasActiveSubscription,
  getPendingOrders,
  expireStaleOrders
};
