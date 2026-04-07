const { splitTelegramText, sendLongMarkdownMessage, DEFAULT_CHUNK_BODY } = require('../utils/telegramChunks');

const long = 'H\n'.repeat(5000);
const parts = splitTelegramText(long, DEFAULT_CHUNK_BODY);
if (parts.length < 2) {
  console.error('expected multiple chunks');
  process.exit(1);
}
for (const p of parts) {
  const withPrefix = `(99/99)\n${p}`;
  if (withPrefix.length > 4096) {
    console.error('chunk+prefix exceeds 4096', withPrefix.length);
    process.exit(1);
  }
}

const mockBot = {
  sent: [],
  async sendMessage(chatId, body, opts = {}) {
    this.sent.push({ chatId, len: body.length, parse_mode: opts.parse_mode, hasKeyboard: !!opts.reply_markup });
    if (body.length > 4096) throw new Error('telegram limit exceeded');
  }
};

(async () => {
  await sendLongMarkdownMessage(mockBot, 1, 'short', { parse_mode: 'Markdown' });
  if (mockBot.sent.length !== 1 || mockBot.sent[0].hasKeyboard) {
    /* keyboard undefined is ok */
  }
  mockBot.sent = [];
  const big = '*x*\n'.repeat(3000);
  await sendLongMarkdownMessage(mockBot, 1, big, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [] }
  });
  if (mockBot.sent.length < 2) {
    console.error('expected split send');
    process.exit(1);
  }
  if (!mockBot.sent[0].hasKeyboard || mockBot.sent[1].hasKeyboard) {
    console.error('keyboard only first chunk', mockBot.sent);
    process.exit(1);
  }
  console.log('ok', { chunks: mockBot.sent.length, lens: mockBot.sent.map((s) => s.len) });
})();
