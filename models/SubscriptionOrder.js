const mongoose = require('mongoose');

const SubscriptionOrderSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, default: '' },
  planId: { type: String, required: true, enum: ['day', 'month', 'year'] },
  baseAmount: { type: Number, required: true },
  expectedAmount: { type: Number, required: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'paid', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },
  expiresAt: { type: Date, required: true, index: true },
  txHash: { type: String, default: '' },
  paidAt: { type: Date, default: null }
}, { timestamps: true });

SubscriptionOrderSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('SubscriptionOrder', SubscriptionOrderSchema);
