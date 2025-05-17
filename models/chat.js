const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true,
  },
  receiverId: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  isOffer: {
    type: Boolean,
    default: false,
  },
  offerStatus: {
    type: String,
    enum: ['sent', 'accepted', 'rejected', 'cancelled'],
    required: false,
    default: undefined
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Create a compound index for efficient querying of chat history
chatSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat; 