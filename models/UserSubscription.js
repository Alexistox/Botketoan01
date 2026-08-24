const mongoose = require('mongoose');

const UserSubscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  username: { type: String, default: '' },
  planId: { type: String, enum: ['day', 'month', 'year'], default: 'month' },
  expiresAt: { type: Date, required: true, index: true },
  lastOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionOrder', default: null }
}, { timestamps: true });

module.exports = mongoose.model('UserSubscription', UserSubscriptionSchema);
