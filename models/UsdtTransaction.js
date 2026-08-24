const mongoose = require('mongoose');

const UsdtTransactionSchema = new mongoose.Schema({
  txHash: { type: String, required: true, unique: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionOrder', default: null },
  userId: { type: String, default: '' },
  amount: { type: Number, required: true },
  fromAddress: { type: String, default: '' },
  toAddress: { type: String, default: '' },
  blockTimestamp: { type: Date, default: null },
  processedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('UsdtTransaction', UsdtTransactionSchema);
