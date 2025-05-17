const express = require('express');
const router = express.Router();
const Chat = require('../models/chat');
const { verifyToken } = require('../middleware/auth');
const User = require('../models/user');

// Get chat history between two users
router.get('/history/:userId/:otherUserId', verifyToken, async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;
    
    const messages = await Chat.find({
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId }
      ]
    })
    .sort({ timestamp: -1 })
    .limit(50);

    // Get user information for both users
    const [user, otherUser] = await Promise.all([
      User.findById(userId).lean(),
      User.findById(otherUserId).lean()
    ]);

    // Format messages with user information
    const formattedMessages = messages.map(msg => ({
      _id: msg._id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      message: msg.message,
      isOffer: msg.isOffer,
      offerStatus: msg.offerStatus,
      timestamp: msg.timestamp,
      sender: {
        name: msg.senderId === userId ? user?.name : otherUser?.name,
        profileImage: msg.senderId === userId ? user?.profileImage : otherUser?.profileImage
      },
      receiver: {
        name: msg.receiverId === userId ? user?.name : otherUser?.name,
        profileImage: msg.receiverId === userId ? user?.profileImage : otherUser?.profileImage
      }
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ message: 'Error fetching chat history' });
  }
});

// Get all chat conversations for a user
router.get('/conversations/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const conversations = await Chat.aggregate([
      {
        $match: {
          $or: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$senderId', userId] },
              '$receiverId',
              '$senderId'
            ]
          },
          lastMessage: { $first: '$$ROOT' }
        }
      }
    ]);

    // Populate partner info
    const populated = await Promise.all(conversations.map(async (conv) => {
      const partner = await User.findById(conv._id).lean();
      return {
        chatPartnerId: conv._id,
        partnerName: partner ? partner.name : 'Unknown',
        partnerProfileImage: partner ? partner.profileImage : '',
        lastMessage: conv.lastMessage.message,
        lastMessageTime: conv.lastMessage.timestamp,
        isOffer: conv.lastMessage.isOffer,
        offerStatus: conv.lastMessage.offerStatus,
        
      };
    }));

    res.json(populated);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});

module.exports = router; 