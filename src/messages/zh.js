module.exports = {
  errorProcessingMessage: '处理消息时出错，请稍后再试。',
  adminOnly: '⛔ 仅管理员/所有者可用此命令。',
  endOfWork: '感谢大家的辛勤付出，祝大家发财！ 💰💸🍀',

  // 订阅套餐 USDT
  subscriptionExpired:
    '⛔ *订阅套餐已过期*\n\n' +
    '使用记账功能需要有效套餐。\n' +
    '• 查看套餐：`/plan` 或 `/套餐`\n' +
    '• 订阅：`/subscribe day|month|year` 或 `/订阅`\n' +
    '• 我的套餐：`/mysub` 或 `/我的套餐`',
  subscriptionNoPlans: '暂无可用套餐，请管理员先配置。',
  subscriptionSubscribeUsage: '用法：`/subscribe day|month|year`\n例如：`/subscribe month`',
  subscriptionSetplanUsage: '用法：`/setplan day|month|year <usdt>`\n例如：`/setplan month 30`',
  subscriptionGrantsubUsage: '用法：`/grantsub @username day|month|year`',
  subscriptionAdminBypass: '✅ 您是所有者/管理员 — 无需订阅套餐。',
  subscriptionIntro:
    '👋 *欢迎使用记账机器人！*\n\n' +
    '🧮 *免费功能：* 计算器（`3+5`）、`/t`、`/v` — 无需套餐即可使用。\n\n' +
    '📒 *需要订阅套餐* 才能使用群组记账：入账 `+`、出账 `-`、下发 `%`、设置汇率 `/d` 等。\n\n' +
    '💳 支持 USDT（TRC20）支付，约 1–2 分钟自动确认。\n' +
    '👇 请选择下方套餐：',
  subscriptionPlanMenu:
    '📦 *USDT 订阅套餐（TRC20）*\n\n' +
    '请选择下方套餐进行订阅。\n' +
    '计算器（`/t`、`/v`、表达式）仍可免费使用。',
  subscriptionBtnDay: '📅 日卡',
  subscriptionBtnMonth: '📆 月卡',
  subscriptionBtnYear: '🗓 年卡',
  subscriptionBtnMysub: '📋 我的套餐',
  subscriptionReplyMenuHint: '👇 快捷菜单 — 点击下方按钮：',
  subscriptionReplyPlan: '📦 USDT套餐',
  subscriptionReplyMysub: '📋 我的套餐',
  subscriptionReplyHelp: '❓ 帮助',
  subscriptionReplyCalcBtn: '🧮 计算器',
  subscriptionReplyCalcHint:
    '🧮 *免费计算器*\n\n' +
    '• 表达式：`1000+500`、`3*25`\n' +
    '• VND → USDT：`/t 1000000`\n' +
    '• USDT → VND：`/v 100`',
  subscriptionReplyHide: '⌨️ 隐藏菜单',
  subscriptionMenuHidden: '✅ 已隐藏菜单。',
  subscriptionPayTitle: '💳 *支付套餐：{label}*',
  subscriptionPayBody:
    '套餐：{label} — {price} USDT\n' +
    '请转账准确金额：`{amount} USDT`（TRC20）\n' +
    '收款地址：`{wallet}`\n' +
    '订单有效：{ttl} 分钟（截止 {expires}）\n\n' +
    '转账后系统约 1–2 分钟自动确认。',
  subscriptionActive:
    '✅ *套餐生效中*\n\n套餐：{label}（`{planId}`）\n到期时间：{expires}\n\n选择下方套餐可续费：',
  subscriptionPaidConfirm:
    '✅ USDT 支付已确认！\n' +
    '套餐：{planId}\n' +
    '金额：{amount} USDT\n' +
    '到期时间：{expires}\n' +
    'Tx：{txShort}...',
  subscriptionSetplanOk: '✅ 已更新套餐 *{label}*（`{planId}`）：*{price} USDT*',
  subscriptionGrantOk: '✅ 已为 @{user} 开通套餐 *{label}*\n到期时间：{expires}',
  subscriptionGrantDm: '✅ 管理员已为您开通套餐 *{label}*\n到期时间：{expires}',
  subscriptionInvalidPrice: '❌ USDT 价格无效。',
  subscriptionUserNotFound: '❌ 未找到该用户。对方需先私聊机器人至少一次。',
  subscriptionInvalidPlan: '套餐无效。请使用：day、month、year',
  subscriptionNoWallet: '尚未配置 USDT 收款地址。管理员请先使用 /usdt 设置。',
  subscriptionPriceInvalid: '价格无效'
};
