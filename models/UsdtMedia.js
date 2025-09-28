const mongoose = require('mongoose');

const UsdtMediaSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    ref: 'Group'
  },
  usdtAddress: {
    type: String,
    required: true
  },
  mediaFiles: [{
    fileId: {
      type: String,
      required: true
    },
    fileType: {
      type: String,
      enum: ['photo', 'video', 'animation', 'document'],
      required: true
    },
    caption: {
      type: String,
      default: ''
    },
    messageId: {
      type: String,
      default: null
    }
  }],
  senderId: {
    type: String,
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Index để tìm kiếm nhanh
UsdtMediaSchema.index({ chatId: 1, isActive: 1 });
UsdtMediaSchema.index({ usdtAddress: 1 });

module.exports = mongoose.model('UsdtMedia', UsdtMediaSchema);