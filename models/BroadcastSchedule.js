const mongoose = require('mongoose');

/**
 * Lịch gửi cố định hàng ngày (/cs).
 * Nguồn tin: msgCode (/cm) HOẶC fromChatId+messageId (reply).
 */
const BroadcastScheduleSchema = new mongoose.Schema({
  msgCode: {
    type: String,
    default: null,
    trim: true,
    lowercase: true
  },
  fromChatId: {
    type: String,
    default: null
  },
  messageId: {
    type: Number,
    default: null
  },
  target: {
    type: String,
    required: true,
    trim: true
  },
  timeHHmm: {
    type: String,
    required: true,
    trim: true
  },
  /** 1=Mon … 7=Sun (ISO). [] / missing = mọi ngày trong tuần */
  daysOfWeek: {
    type: [Number],
    default: []
  },
  enabled: {
    type: Boolean,
    default: true
  },
  /** YYYY-MM-DD theo Asia/Phnom_Penh (Campuchia) — chống gửi trùng trong ngày */
  lastFiredDate: {
    type: String,
    default: null
  },
  createdBy: {
    type: String,
    default: ''
  }
}, { timestamps: true });

BroadcastScheduleSchema.index({ enabled: 1, timeHHmm: 1 });

module.exports = mongoose.model('BroadcastSchedule', BroadcastScheduleSchema);
