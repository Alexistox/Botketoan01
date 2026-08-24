const mongoose = require('mongoose');

const SubscriptionPlanSchema = new mongoose.Schema({
  planId: {
    type: String,
    required: true,
    unique: true,
    enum: ['day', 'month', 'year']
  },
  nameVi: { type: String, default: '' },
  nameZh: { type: String, default: '' },
  durationDays: { type: Number, required: true },
  priceUsdt: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);
