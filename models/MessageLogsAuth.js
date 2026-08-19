const mongoose = require('mongoose');

/**
 * Token truy cập dashboard Message Logs (một document duy nhất).
 */
const MessageLogsAuthSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'default',
    unique: true
  },
  token: {
    type: String,
    default: ''
  },
  tokenExpiry: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('MessageLogsAuth', MessageLogsAuthSchema);
