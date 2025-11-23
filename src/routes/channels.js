const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');

const {
  createChannel,
  startDirectMessage,
  getDirectMessages,
  getChannels,
  getChannelById,
  updateChannel,
  deleteChannel,
  addMember,
  removeMember,
  markMessagesAsRead,
  getUnreadCounts,
  updateMemberRole,
} = channelController();

const {
  sendMessage,
  getMessages,
} = messageController();

// All routes require authentication
router.use(authenticate);

// Channel routes
router.post('/', createChannel);
router.get('/', getChannels);
router.get('/unread-counts', getUnreadCounts);

// Direct message routes (must be before /:channelId to avoid route conflicts)
router.post('/direct', startDirectMessage);
router.get('/direct', getDirectMessages);

// Channel by ID routes
router.get('/:channelId', getChannelById);
router.put('/:channelId', updateChannel);
router.delete('/:channelId', deleteChannel);

// Member management routes
router.post('/:channelId/members', addMember);
router.delete('/:channelId/members/:memberId', removeMember);
router.patch('/:channelId/members/:memberId/role', updateMemberRole);

// Message read tracking
router.post('/:channelId/mark-read', markMessagesAsRead);

// Message routes
router.post('/:channelId/messages', sendMessage);
router.get('/:channelId/messages', getMessages);

// Test endpoint to verify Firebase collections
router.get('/test/firebase', async (req, res) => {
  try {
    const { testFirebaseConnection } = require('../services/firebase-sync.service');
    const { firestore, isReady } = require('../config/firebase-admin');
    
    if (!isReady || !firestore) {
      return res.status(503).json({
        success: false,
        message: 'Firebase not initialized',
      });
    }

    // Test connection
    const connectionTest = await testFirebaseConnection();
    
    // List existing channels
    const channelsSnapshot = await firestore.collection('chat_channels').limit(5).get();
    const channels = [];
    channelsSnapshot.forEach(doc => {
      channels.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    res.json({
      success: true,
      data: {
        firebaseReady: isReady,
        connectionTest,
        channelsCount: channels.length,
        channels,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;

