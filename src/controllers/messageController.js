/**
 * Message Controller
 * Handles sending messages to channels (group and direct messages)
 * Messages are stored in Firestore: chat_channels/{channelId}/messages/{messageId}
 */

const { Channel, ChannelMember, User } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { 
  getChannelMessagesRef, 
  ensureChannelExists, 
  updateChannelLastMessage,
  incrementUnreadCount 
} = require('../services/firebase-sync.service');
const { firestore, isReady } = require('../config/firebase-admin');
const admin = require('firebase-admin');

const messageController = () => {
  /**
   * Send a message to a channel
   * POST /api/channels/:channelId/messages
   */
  const sendMessage = async (req, res) => {
    try {
      const userId = req.user.id;
      const { channelId } = req.params;
      const { content } = req.body;

      // Validate input
      if (!content || content.trim() === '') {
        return res.status(400).json(errorResponse('Message content is required', 400));
      }

      // Check if Firebase is ready
      if (!isReady || !firestore) {
        return res.status(503).json(errorResponse('Firebase is not available. Please configure Firebase.', 503));
      }

      // Verify channel exists
      const channel = await Channel.findByPk(channelId);
      if (!channel) {
        return res.status(404).json(errorResponse('Channel not found', 404));
      }

      // Verify user is a member
      const membership = await ChannelMember.findOne({
        where: {
          channel_id: channelId,
          user_id: userId,
        },
      });

      if (!membership) {
        return res.status(403).json(errorResponse('You are not a member of this channel', 403));
      }

      // Get user info for message
      const user = await User.findByPk(userId, {
        attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
      });

      if (!user) {
        return res.status(404).json(errorResponse('User not found', 404));
      }

      // Ensure channel exists in Firestore
      await ensureChannelExists(channelId, {
        memberIds: [], // Will be updated by sync if needed
        name: channel.name,
        type: channel.type,
      });

      // Get messages collection reference
      const messagesRef = getChannelMessagesRef(channelId);
      if (!messagesRef) {
        return res.status(503).json(errorResponse('Firestore messages collection not available', 503));
      }

      // Create message document in Firestore
      const messageData = {
        content: content.trim(),
        senderId: userId.toString(),
        senderName: user.full_name,
        senderEmail: user.email,
        senderAvatar: user.avatar_url || null,
        senderAvatarColor: user.avatar_color || null,
        senderInitials: user.initials || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Add message to Firestore
      const messageRef = await messagesRef.add(messageData);
      const messageId = messageRef.id;

      // Get the created message with timestamp
      const messageDoc = await messageRef.get();
      const message = {
        id: messageId,
        ...messageDoc.data(),
        createdAt: messageDoc.data().createdAt?.toDate() || new Date(),
        updatedAt: messageDoc.data().updatedAt?.toDate() || new Date(),
      };

      // Update channel last message
      const timestamp = message.createdAt;
      await updateChannelLastMessage(channelId, content.trim(), timestamp);

      // Increment unread count for other members (not the sender)
      await incrementUnreadCount(channelId, userId);

      // Format response
      const formattedMessage = {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        senderName: message.senderName,
        senderEmail: message.senderEmail,
        senderAvatar: message.senderAvatar,
        senderAvatarColor: message.senderAvatarColor,
        senderInitials: message.senderInitials,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
      };

      res.status(201).json(successResponse({ 
        message: formattedMessage,
        channelId: channelId.toString(),
      }));
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json(errorResponse(`Failed to send message: ${error.message}`, 500));
    }
  };

  /**
   * Get messages from a channel
   * GET /api/channels/:channelId/messages
   */
  const getMessages = async (req, res) => {
    try {
      const userId = req.user.id;
      const { channelId } = req.params;
      const { limit = 50, before } = req.query; // before = messageId for pagination

      // Check if Firebase is ready
      if (!isReady || !firestore) {
        return res.status(503).json(errorResponse('Firebase is not available. Please configure Firebase.', 503));
      }

      // Verify channel exists
      const channel = await Channel.findByPk(channelId);
      if (!channel) {
        return res.status(404).json(errorResponse('Channel not found', 404));
      }

      // Verify user is a member
      const membership = await ChannelMember.findOne({
        where: {
          channel_id: channelId,
          user_id: userId,
        },
      });

      if (!membership) {
        return res.status(403).json(errorResponse('You are not a member of this channel', 403));
      }

      // Get messages collection reference
      const messagesRef = getChannelMessagesRef(channelId);
      if (!messagesRef) {
        return res.status(503).json(errorResponse('Firestore messages collection not available', 503));
      }

      // Build query
      let query = messagesRef.orderBy('createdAt', 'desc').limit(parseInt(limit));

      // Pagination: get messages before a specific message
      if (before) {
        const beforeDoc = await messagesRef.doc(before).get();
        if (beforeDoc.exists) {
          query = query.startAfter(beforeDoc);
        }
      }

      // Execute query
      const snapshot = await query.get();
      const messages = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          content: data.content,
          senderId: data.senderId,
          senderName: data.senderName,
          senderEmail: data.senderEmail,
          senderAvatar: data.senderAvatar,
          senderAvatarColor: data.senderAvatarColor,
          senderInitials: data.senderInitials,
          createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
        });
      });

      // Reverse to get chronological order (oldest first)
      messages.reverse();

      res.json(successResponse({ 
        messages,
        channelId: channelId.toString(),
        hasMore: snapshot.size === parseInt(limit), // If we got full limit, there might be more
      }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json(errorResponse(`Failed to fetch messages: ${error.message}`, 500));
    }
  };

  return {
    sendMessage,
    getMessages,
  };
};

module.exports = messageController;

