const mongoose = require('mongoose');

const BroadcastGroupSetSchema = new mongoose.Schema({
  tag: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  chatIds: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('BroadcastGroupSet', BroadcastGroupSetSchema);
