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

/**
 * Đã có /d2 (出款费率·汇率) nhưng chưa cấu /d (入款): rate và exchangeRate vẫn 0 → mặc định 0/1.
 * Giúp +/t/v và báo cáo không bị chặn vì thiếu tỷ giá nhập.
 */
function applyDepositDefaultIfD2Only(doc) {
  if (!doc) return;
  if (doc.withdrawRate == null || doc.withdrawExchangeRate == null) return;
  const r = Number(doc.rate) || 0;
  const ex = Number(doc.exchangeRate) || 0;
  if (r === 0 && ex === 0) {
    doc.rate = 0;
    doc.exchangeRate = 1;
  }
}

GroupSchema.pre('save', function applyD2DepositDefault(next) {
  applyDepositDefaultIfD2Only(this);
  next();
});

GroupSchema.post('findOne', function applyD2DepositDefaultOnFindOne(doc) {
  applyDepositDefaultIfD2Only(doc);
});

GroupSchema.post('find', function applyD2DepositDefaultOnFind(docs) {
  if (!docs || !docs.length) return;
  docs.forEach(applyDepositDefaultIfD2Only);
});

module.exports = mongoose.model('Group', GroupSchema); 