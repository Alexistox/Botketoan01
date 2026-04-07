const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    unique: true
  },
  totalVND: {
    type: Number,
    default: 0
  },
  totalUSDT: {
    type: Number,
    default: 0
  },
  // Các trường mới để tracking riêng deposit và withdraw
  totalDepositUSDT: {
    type: Number,
    default: 0
  },
  totalDepositVND: {
    type: Number,
    default: 0
  },
  totalWithdrawUSDT: {
    type: Number,
    default: 0
  },
  totalWithdrawVND: {
    type: Number,
    default: 0
  },
  usdtPaid: {
    type: Number,
    default: 0
  },
  remainingUSDT: {
    type: Number,
    default: 0
  },
  rate: {
    type: Number,
    default: 0
  },
  exchangeRate: {
    type: Number,
    default: 0
  },
  // Các trường mới cho phí và tỷ giá xuất tiền
  withdrawRate: {
    type: Number,
    default: null
  },
  withdrawExchangeRate: {
    type: Number,
    default: null
  },
  numberFormat: {
    type: String,
    enum: ['default', 'formatted'],
    default: 'formatted'
  },
  lastClearDate: {
    type: Date,
    default: Date.now
  },
  operators: {
    type: [{
      userId: String,
      username: String,
      dateAdded: {
        type: Date,
        default: Date.now
      }
    }],
    default: []
  },
  reportToken: {
    type: String,
    default: null
  },
  reportTokenExpiry: {
    type: Date,
    default: null
  },
  ownerId: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Group', GroupSchema); 