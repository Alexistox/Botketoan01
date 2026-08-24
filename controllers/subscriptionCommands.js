const { isUserAdmin, extractUserFromCommand } = require('../utils/permissions');
const {
  getPlans,
  createOrder,
  getUserSubscription,
  setPlanPrice,
  grantSubscription,
  formatUsdt,
  formatUsdtDisplay,
  hasActiveSubscription
} = require('../services/subscriptionService');
const messages = require('../src/messages/zh');

const PLAN_LABELS = { day: '日卡', month: '月卡', year: '年卡' };
const BTN_LABELS = {
  day: messages.subscriptionBtnDay,
  month: messages.subscriptionBtnMonth,
  year: messages.subscriptionBtnYear
};

function planLabel(plan) {
  return plan.nameZh || PLAN_LABELS[plan.planId] || plan.planId;
}

function planButtonLabel(plan) {
  const label = planLabel(plan);
  return `${BTN_LABELS[plan.planId] || label} — ${formatUsdtDisplay(plan.priceUsdt)} USDT`;
}

function buildPlanInlineKeyboard(plans) {
  const rows = [];
  for (let i = 0; i < plans.length; i += 2) {
    const row = [
      {
        text: planButtonLabel(plans[i]),
        callback_data: `sub:plan:${plans[i].planId}`
      }
    ];
    if (plans[i + 1]) {
      row.push({
        text: planButtonLabel(plans[i + 1]),
        callback_data: `sub:plan:${plans[i + 1].planId}`
      });
    }
    rows.push(row);
  }
  rows.push([{ text: messages.subscriptionBtnMysub, callback_data: 'sub:mysub' }]);
  return { inline_keyboard: rows };
}

async function sendPlanMenu(bot, chatId, textOverride) {
  const plans = await getPlans();
  if (!plans.length) {
    await bot.sendMessage(chatId, messages.subscriptionNoPlans);
    return;
  }
  const text = textOverride || messages.subscriptionPlanMenu;
  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: buildPlanInlineKeyboard(plans)
  });
}

async function sendSubscriptionIntro(bot, chatId) {
  await sendPlanMenu(bot, chatId, messages.subscriptionIntro);
  await sendMainReplyKeyboard(bot, chatId);
}

function buildMainReplyKeyboard() {
  return {
    keyboard: [
      [
        { text: messages.subscriptionReplyPlan },
        { text: messages.subscriptionReplyMysub },
        { text: messages.subscriptionReplyHelp }
      ],
      [
        { text: messages.subscriptionReplyCalcBtn },
        { text: messages.subscriptionReplyHide }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

async function sendMainReplyKeyboard(bot, chatId) {
  await bot.sendMessage(chatId, messages.subscriptionReplyMenuHint, {
    reply_markup: buildMainReplyKeyboard()
  });
}

async function handleReplyMenuAction(bot, msg) {
  const text = (msg.text || '').trim();
  const chatId = msg.chat.id;

  if (text === messages.subscriptionReplyPlan) {
    await sendPlanMenu(bot, chatId);
    return true;
  }
  if (text === messages.subscriptionReplyMysub) {
    await handleMysubCommand(bot, msg);
    return true;
  }
  if (text === messages.subscriptionReplyHelp) {
    const { handleHelpCommand } = require('./utilCommands');
    await handleHelpCommand(bot, chatId);
    return true;
  }
  if (text === messages.subscriptionReplyCalcBtn) {
    await bot.sendMessage(chatId, messages.subscriptionReplyCalcHint, { parse_mode: 'Markdown' });
    return true;
  }
  if (text === messages.subscriptionReplyHide) {
    await bot.sendMessage(chatId, messages.subscriptionMenuHidden, {
      reply_markup: { remove_keyboard: true }
    });
    return true;
  }
  return false;
}

async function createOrderAndReply(bot, chatId, userId, username, planId) {
  const { order, plan, wallet, orderTtlMin } = await createOrder(userId, username, planId);
  const expOrder = new Date(order.expiresAt).toLocaleString('zh-CN', { hour12: false });
  const label = planLabel(plan);

  const payMsg =
    messages.subscriptionPayTitle.replace('{label}', label) +
    '\n\n' +
    messages.subscriptionPayBody
      .replace(/\{label\}/g, label)
      .replace('{price}', formatUsdtDisplay(plan.priceUsdt))
      .replace('{amount}', formatUsdt(order.expectedAmount))
      .replace('{wallet}', wallet)
      .replace('{ttl}', String(orderTtlMin))
      .replace('{expires}', expOrder);

  await bot.sendMessage(chatId, payMsg, { parse_mode: 'Markdown' });
}

async function replyMysub(bot, chatId, userId) {
  if (await hasActiveSubscription(userId)) {
    const sub = await getUserSubscription(userId);
    if (!sub) {
      await bot.sendMessage(chatId, messages.subscriptionAdminBypass);
      return;
    }
    const expStr = new Date(sub.expiresAt).toLocaleString('zh-CN', { hour12: false });
    const label = PLAN_LABELS[sub.planId] || sub.planId;
    await bot.sendMessage(
      chatId,
      messages.subscriptionActive
        .replace('{label}', label)
        .replace('{planId}', sub.planId)
        .replace('{expires}', expStr),
      { parse_mode: 'Markdown', reply_markup: buildPlanInlineKeyboard(await getPlans()) }
    );
    return;
  }
  await bot.sendMessage(chatId, messages.subscriptionExpired, {
    parse_mode: 'Markdown',
    reply_markup: buildPlanInlineKeyboard(await getPlans())
  });
}

const handlePlanCommand = async (bot, msg) => {
  try {
    await sendPlanMenu(bot, msg.chat.id);
  } catch (error) {
    console.error('Error in handlePlanCommand:', error);
    bot.sendMessage(msg.chat.id, messages.errorProcessingMessage);
  }
};

const handleSubscribeCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || '';
    const parts = (msg.text || '').trim().split(/\s+/);

    if (parts.length < 2) {
      await sendPlanMenu(bot, chatId);
      return;
    }

    let planId = parts[1].toLowerCase();
    const zhMap = { 日: 'day', 日卡: 'day', 月: 'month', 月卡: 'month', 年: 'year', 年卡: 'year' };
    if (zhMap[parts[1]]) planId = zhMap[parts[1]];

    await createOrderAndReply(bot, chatId, userId, username, planId);
  } catch (error) {
    console.error('Error in handleSubscribeCommand:', error);
    bot.sendMessage(msg.chat.id, `❌ ${error.message || messages.errorProcessingMessage}`);
  }
};

const handleMysubCommand = async (bot, msg) => {
  try {
    await replyMysub(bot, msg.chat.id, msg.from.id);
  } catch (error) {
    console.error('Error in handleMysubCommand:', error);
    bot.sendMessage(msg.chat.id, messages.errorProcessingMessage);
  }
};

const handleSubscriptionCallback = async (bot, callbackQuery) => {
  try {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const username = callbackQuery.from.username || '';
    const data = callbackQuery.data || '';

    await bot.answerCallbackQuery(callbackQuery.id);

    if (data === 'sub:mysub') {
      await replyMysub(bot, chatId, userId);
      return;
    }

    if (data.startsWith('sub:plan:')) {
      const planId = data.replace('sub:plan:', '');
      await createOrderAndReply(bot, chatId, userId, username, planId);
    }
  } catch (error) {
    console.error('Error in handleSubscriptionCallback:', error);
    try {
      await bot.sendMessage(
        callbackQuery.message.chat.id,
        `❌ ${error.message || messages.errorProcessingMessage}`
      );
    } catch (_) {
      // ignore
    }
  }
};

const handleSetplanCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!(await isUserAdmin(userId))) {
      bot.sendMessage(chatId, messages.adminOnly);
      return;
    }

    const parts = (msg.text || '').trim().split(/\s+/);
    if (parts.length < 3) {
      bot.sendMessage(chatId, messages.subscriptionSetplanUsage, { parse_mode: 'Markdown' });
      return;
    }

    const planId = parts[1].toLowerCase();
    const price = parseFloat(parts[2].replace(/,/g, ''));
    if (Number.isNaN(price) || price < 0) {
      bot.sendMessage(chatId, messages.subscriptionInvalidPrice);
      return;
    }

    const plan = await setPlanPrice(planId, price);
    const label = planLabel(plan);
    bot.sendMessage(
      chatId,
      messages.subscriptionSetplanOk
        .replace('{label}', label)
        .replace('{planId}', plan.planId)
        .replace('{price}', formatUsdtDisplay(plan.priceUsdt)),
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error in handleSetplanCommand:', error);
    bot.sendMessage(msg.chat.id, `❌ ${error.message || messages.errorProcessingMessage}`);
  }
};

const handleGrantsubCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!(await isUserAdmin(userId))) {
      bot.sendMessage(chatId, messages.adminOnly);
      return;
    }

    const parts = (msg.text || '').trim().split(/\s+/);
    if (parts.length < 3) {
      bot.sendMessage(chatId, messages.subscriptionGrantsubUsage, { parse_mode: 'Markdown' });
      return;
    }

    const targetUser = await extractUserFromCommand(parts[1]);
    if (!targetUser) {
      bot.sendMessage(chatId, messages.subscriptionUserNotFound);
      return;
    }

    let planId = parts[2].toLowerCase();
    const zhMap = { 日: 'day', 日卡: 'day', 月: 'month', 月卡: 'month', 年: 'year', 年卡: 'year' };
    if (zhMap[parts[2]]) planId = zhMap[parts[2]];

    const { plan, expiresAt } = await grantSubscription(
      targetUser.userId,
      targetUser.username,
      planId
    );
    const expStr = expiresAt.toLocaleString('zh-CN', { hour12: false });
    const label = planLabel(plan);
    const userTag = targetUser.username || targetUser.userId;

    bot.sendMessage(
      chatId,
      messages.subscriptionGrantOk
        .replace('{user}', userTag)
        .replace('{label}', label)
        .replace('{expires}', expStr),
      { parse_mode: 'Markdown' }
    );

    try {
      await bot.sendMessage(
        targetUser.userId,
        messages.subscriptionGrantDm.replace('{label}', label).replace('{expires}', expStr),
        { parse_mode: 'Markdown' }
      );
    } catch (dmErr) {
      console.warn('Could not DM user after grantsub:', dmErr.message);
    }
  } catch (error) {
    console.error('Error in handleGrantsubCommand:', error);
    bot.sendMessage(msg.chat.id, `❌ ${error.message || messages.errorProcessingMessage}`);
  }
};

module.exports = {
  buildPlanInlineKeyboard,
  buildMainReplyKeyboard,
  sendPlanMenu,
  sendSubscriptionIntro,
  sendMainReplyKeyboard,
  createOrderAndReply,
  handlePlanCommand,
  handleSubscribeCommand,
  handleMysubCommand,
  handleSetplanCommand,
  handleGrantsubCommand,
  handleSubscriptionCallback,
  handleReplyMenuAction,
  isReplyMenuAction: require('../utils/subscriptionGate').isReplyMenuAction
};
