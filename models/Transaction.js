const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    ref: 'Group'
  },
  type: {
    type: String,
    enum: ['deposit', 'withdraw', 'payment', 'setRate', 'setExchangeRate', 'setWithdrawRate', 'clear', 'delete', 'skip'],
    required: true
  },
  amount: {
    type: Number,
    default: 0
  },
  usdtAmount: {
    type: Number,
    default: 0
  },
  cardCode: {
    type: String,
    default: ''
  },
  limit: {
    type: Number,
    default: 0
  },
  senderName: {
    type: String,
    required: true
  },
  senderId: {
    type: String,
    default: null
  },
  senderUsername: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    default: ''
  },
  details: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  rate: {
    type: Number,
    default: 0
  },
  exchangeRate: {
    type: Number,
    default: 0
  },
  messageId: {
    type: String,
    default: null
  },
  skipped: {
    type: Boolean,
    default: false
  },
  skipReason: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema); 