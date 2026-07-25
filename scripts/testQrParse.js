const { parseBankInfoFromLabels } = require('../utils/qrBankKeywords');
const { parseBankInfo } = require('../controllers/qrCommands');

const sample =
  '账号 : 0336157167\n' +
  '持卡人姓名 : Dương Tuấn Anh\n' +
  '银行名称 : VietinBank \n' +
  '金额 :  810,000 vnd \n' +
  '备注: HTTH chuyen tien';

console.log('labels', JSON.stringify(parseBankInfoFromLabels(sample), null, 2));
console.log('merged', JSON.stringify(parseBankInfo(sample), null, 2));

const plain =
  '0336157167\n' +
  'Dương Tuấn Anh\n' +
  'VietinBank\n' +
  '810000\n' +
  'note';
console.log('plain', JSON.stringify(parseBankInfo(plain), null, 2));

const noAmount =
  '银行名称 : Vietin Bank\n' +
  '账号 : 0336157167\n' +
  '持卡人姓名 : Dương Tuấn Anh\n' +
  '备注: CK';
console.log('noAmount', JSON.stringify(parseBankInfo(noAmount), null, 2));

const reordered =
  '金额 : 500.000 vnd\n' +
  '银行名称 : Vietcombank\n' +
  'số tk: 1234567890123\n' +
  'tên chủ tài khoản : Nguyễn Văn A\n' +
  'ghi chú: test order';
console.log('reordered', JSON.stringify(parseBankInfo(reordered), null, 2));

const stkSpaceLabels =
  'stk 2349785\n' +
  'ten Ha van tien\n' +
  'bidv\n' +
  '12000000\n' +
  '5623';
console.log('stkSpaceLabels', JSON.stringify(parseBankInfo(stkSpaceLabels), null, 2));

const chineseSemicolon =
  '银行；VietinBank\n' +
  '名字；NGUYEN QUOC SU\n' +
  '账户；107005610224\n' +
  '下发；8453000vnd';
console.log('chineseSemicolon', JSON.stringify(parseBankInfo(chineseSemicolon), null, 2));

const mixedDelimiters =
  '银行：Vikki\n' +
  '名字: VU VAN DOAN\n' +
  '账号 : 240220014\n' +
  '下发；14873000vnd';
console.log('mixedDelimiters', JSON.stringify(parseBankInfo(mixedDelimiters), null, 2));
