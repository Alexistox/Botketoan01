const {
  AMOUNT_VND,
  EXCHANGES
} = require('../services/p2pPriceService');

function formatPrice(price) {
  return Math.round(Number(price)).toLocaleString('en-US');
}

function formatAmountLabel(amount) {
  if (amount >= 100_000_000) {
    return `${amount / 100_000_000}亿越南盾`;
  }
  if (amount >= 10_000) {
    return `${amount / 10_000}万越南盾`;
  }
  return `${amount.toLocaleString('en-US')} 越南盾`;
}

function buildPriceMessage(exchangeLabel, items) {
  const header =
    `📊 ${exchangeLabel} P2P USDT/VND — 买入（${formatAmountLabel(AMOUNT_VND)}）\n` +
    `跳过首位商家 · 10个报价\n` +
    `────────────────`;

  if (!items || items.length === 0) {
    return `${header}\n暂无合适数据。`;
  }

  const lines = items.map((item, index) => {
    const name = (item.nickName || '').trim();
    const pricePart = formatPrice(item.price);
    return name
      ? `${index + 1}. ${pricePart} — ${name}`
      : `${index + 1}. ${pricePart}`;
  });

  return `${header}\n${lines.join('\n')}`;
}

/**
 * Xử lý /z0 /z1 /z2 — giá P2P mua USDT/VND mức 100tr, bỏ qua thương nhân đầu.
 */
const handleP2pPriceCommand = async (bot, msg, exchangeKey) => {
  const chatId = msg.chat.id;
  const exchange = EXCHANGES[exchangeKey];

  if (!exchange) {
    await bot.sendMessage(chatId, '无效的交易所。');
    return;
  }

  try {
    const waiting = await bot.sendMessage(
      chatId,
      `⏳ 正在获取 ${exchange.label} P2P 价格...`
    );

    const items = await exchange.fetch();
    const text = buildPriceMessage(exchange.label, items);

    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: waiting.message_id
      });
    } catch (editError) {
      await bot.sendMessage(chatId, text);
    }
  } catch (error) {
    console.error(`Error in handleP2pPriceCommand (${exchangeKey}):`, error.message || error);
    await bot.sendMessage(
      chatId,
      `❌ 无法获取 ${exchange.label} P2P 价格，请稍后再试。`
    );
  }
};

const handleZ0Command = (bot, msg) => handleP2pPriceCommand(bot, msg, 'binance');
const handleZ1Command = (bot, msg) => handleP2pPriceCommand(bot, msg, 'okx');
const handleZ2Command = (bot, msg) => handleP2pPriceCommand(bot, msg, 'bybit');

module.exports = {
  handleP2pPriceCommand,
  handleZ0Command,
  handleZ1Command,
  handleZ2Command,
  buildPriceMessage
};
