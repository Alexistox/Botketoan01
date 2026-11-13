const {
  AMOUNT_VND,
  EXCHANGES
} = require('../services/p2pPriceService');

function formatPrice(price) {
  return Math.round(Number(price)).toLocaleString('en-US');
}

function formatAmountLabel(amount) {
  if (amount >= 1_000_000) {
    return `${amount / 1_000_000}tr VND`;
  }
  return `${amount.toLocaleString('en-US')} VND`;
}

function buildPriceMessage(exchangeLabel, items) {
  const header =
    `📊 ${exchangeLabel} P2P USDT/VND — Mua (${formatAmountLabel(AMOUNT_VND)})\n` +
    `Bỏ qua thương nhân đầu · 10 giá trị\n` +
    `────────────────`;

  if (!items || items.length === 0) {
    return `${header}\nKhông có dữ liệu phù hợp.`;
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
    await bot.sendMessage(chatId, 'Sàn không hợp lệ.');
    return;
  }

  try {
    const waiting = await bot.sendMessage(
      chatId,
      `⏳ Đang lấy giá ${exchange.label} P2P...`
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
      `❌ Không lấy được giá ${exchange.label} P2P. Vui lòng thử lại sau.`
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
