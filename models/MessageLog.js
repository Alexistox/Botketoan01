const mongoose = require('mongoose');

const MessageLogSchema = new mongoose.Schema({
  groupName: {
    type: String,
    default: ''
  },
  chatId: {
    type: String,
    required: true
  },
  chatType: {
    type: String,
    default: ''
  },
  senderId: {
    type: String,
    default: ''
  },
  senderName: {
    type: String,
    default: ''
  },
  username: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  content: {
    type: String,
    default: ''
  },
  photoUrl: {
    type: String,
    default: ''
  },
  videoUrl: {
    type: String,
    default: ''
  },
  voiceUrl: {
    type: String,
    default: ''
  },
  documentUrl: {
    type: String,
    default: ''
  },
  photoFileId: {
    type: String,
    default: ''
  },
  videoFileId: {
    type: String,
    default: ''
  },
  voiceFileId: {
    type: String,
    default: ''
  },
  documentFileId: {
    type: String,
    default: ''
  }
}, { timestamps: true });

MessageLogSchema.index({ chatId: 1, timestamp: -1 });
MessageLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('MessageLog', MessageLogSchema);
