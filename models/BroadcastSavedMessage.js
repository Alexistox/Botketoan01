const mongoose = require('mongoose');

const BroadcastSavedMessageSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  fromChatId: {
    type: String,
    required: true
  },
  messageId: {
    type: Number,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('BroadcastSavedMessage', BroadcastSavedMessageSchema);
