const mongoose = require('mongoose');

const ServerLicenseSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'server'
  },
  paidUntil: {
    type: Date,
    required: true
  },
  feeEnabled: {
    type: Boolean,
    default: false
  },
  lastRemindedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('ServerLicense', ServerLicenseSchema);
