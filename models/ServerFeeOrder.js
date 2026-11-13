const mongoose = require('mongoose');

const ServerFeeOrderSchema = new mongoose.Schema({
  baseAmount: { type: Number, required: true },
  expectedAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'paid', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },
  expiresAt: { type: Date, required: true },
  txHash: { type: String, default: null },
  paidAt: { type: Date, default: null },
  fromAddress: { type: String, default: '' },
  toAddress: { type: String, default: '' }
}, { timestamps: true });

ServerFeeOrderSchema.index({ status: 1, expiresAt: 1 });
ServerFeeOrderSchema.index(
  { txHash: 1 },
  { unique: true, partialFilterExpression: { txHash: { $type: 'string' } } }
);

module.exports = mongoose.model('ServerFeeOrder', ServerFeeOrderSchema);
