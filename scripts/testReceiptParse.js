const {
  extractMoneyFromBankNotification,
  extractMoneyFromText
} = require('../utils/textParser');

const sample =
  '-  入款: +600,000 đ\n' +
  '- 账户: 101036888 tại MBBank Ocean VN\n' +
  '- 时间: 2026-04-06 20:40:00\n' +
  '- 备注: QR   HA THI PHO RIN Chuyen tien- Ma GD ACSP/ W8730647';

const bank = extractMoneyFromBankNotification(sample);
const text = extractMoneyFromText(sample);
const fallback = bank != null && bank > 0 ? bank : text;

console.log('extractMoneyFromBankNotification', bank);
console.log('extractMoneyFromText', text);
console.log('effective (reply 1 path)', fallback);
if (fallback !== 600000) {
  process.exit(1);
}
