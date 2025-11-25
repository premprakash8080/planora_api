/**
 * Firebase Sync Service
 * Syncs MySQL channel and user metadata to Firestore for real-time chat
 * 
 * Collection Structure:
 * chat_channels/{channelId}
 *   - memberIds: ["1", "2"] (array of strings)
 *   - name: "John & Jane"
 *   - type: "direct" | "group"
 *   - lastMessage: "Hey check this" (or null)
 *   - lastMessageAt: timestamp (or null)
 *   - messages/{messageId} (subcollection)
 *     - content: "Hello"
 *     - senderId: "1"
 *     - senderName: "John"
 *     - createdAt: timestamp
 */

const { firestore, auth, isReady } = require('../config/firebase-admin');
const admin = require('firebase-admin');

/**
 * Sync user data to Firestore
 */
const syncUserToFirestore = async (user) => {
  if (!isReady || !firestore) {
    return; // Graceful fallback - no error thrown
  }

  try {
    await firestore.collection('users').doc(user.id.toString()).set({
      mysqlUserId: user.id,
      fullName: user.full_name,
      email: user.email,
      avatarUrl: user.avatar_url || null,
      avatarColor: user.avatar_color || null,
      initials: user.initials || null,
      lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`✅ Synced user ${user.id} to Firestore`);
  } catch (error) {
    console.error('Error syncing user to Firestore:', error.message);
  }
};

/**
 * Sync channel metadata to Firestore
 * Creates chat_channels/{channelId} with proper structure
 */
const syncChannelToFirestore = async (channel, members = []) => {
  if (!isReady || !firestore) {
    console.warn('⚠️  Firebase not ready, skipping channel sync');
    return; // Graceful fallback
  }

  try {
    const channelId = channel.id.toString();
    const channelRef = firestore.collection('chat_channels').doc(channelId);

    // Extract member IDs as strings (ensure they're strings, not numbers)
    const memberIds = members
      .map(m => {
        const userId = m.user_id || m.user?.id || m.userId || m.id;
        return userId ? userId.toString() : null;
      })
      .filter(Boolean);

    // Build channel data matching the desired structure
    const channelData = {
      mysqlChannelId: channel.id,
      memberIds: memberIds, // Array of string IDs: ["1", "2"]
      name: channel.name || null,
      type: channel.type, // "direct" | "group" | "public" | "private"
      lastMessage: null, // Will be updated when messages are sent
      lastMessageAt: null, // Will be updated when messages are sent
      createdAt: channel.created_at 
        ? admin.firestore.Timestamp.fromDate(new Date(channel.created_at)) 
        : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Set the channel document (this creates the collection if it doesn't exist)
    await channelRef.set(channelData, { merge: true });

    console.log(`✅ Synced channel ${channelId} to Firestore`);
    console.log(`   Path: chat_channels/${channelId}`);
    console.log(`   Members: [${memberIds.join(', ')}]`);
    console.log(`   Type: ${channel.type}`);
  } catch (error) {
    console.error('❌ Error syncing channel to Firestore:', error.message);
    console.error('   Channel ID:', channel.id);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
  }
};

/**
 * Remove channel from Firestore
 */
const removeChannelFromFirestore = async (channelId) => {
  if (!isReady || !firestore) {
    return; // Graceful fallback
  }

  try {
    // Delete the channel document (this will also delete the messages subcollection)
    await firestore.collection('chat_channels').doc(channelId.toString()).delete();
    console.log(`✅ Removed channel ${channelId} from Firestore`);
  } catch (error) {
    console.error('Error removing channel from Firestore:', error.message);
  }
};

/**
 * Update channel last message
 * Updates lastMessage and lastMessageAt in chat_channels/{channelId}
 */
const updateChannelLastMessage = async (channelId, messageContent, timestamp) => {
  if (!isReady || !firestore) {
    return; // Graceful fallback
  }

  try {
    const channelRef = firestore.collection('chat_channels').doc(channelId.toString());
    
    // Ensure channel exists first
    const channelDoc = await channelRef.get();
    if (!channelDoc.exists) {
      console.warn(`⚠️  Channel ${channelId} doesn't exist in Firestore, creating it...`);
      await ensureChannelExists(channelId);
    }

    const updateData = {
      lastMessage: messageContent || null,
      lastMessageAt: timestamp 
        ? admin.firestore.Timestamp.fromDate(new Date(timestamp)) 
        : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await channelRef.update(updateData);

    // Also update MySQL
    const { Channel } = require('../models');
    await Channel.update(
      { last_message_at: timestamp || new Date() },
      { where: { id: channelId } }
    );

    console.log(`✅ Updated last message for channel ${channelId}`);
  } catch (error) {
    console.error('Error updating channel last message:', error.message);
  }
};

/**
 * Increment unread count for channel members (except sender)
 */
const incrementUnreadCount = async (channelId, excludeUserId) => {
  try {
    const { ChannelMember } = require('../models');
    await ChannelMember.increment('unread_count', {
      where: {
        channel_id: channelId,
        user_id: { [require('sequelize').Op.ne]: excludeUserId },
      },
    });
  } catch (error) {
    console.error('Error incrementing unread count:', error.message);
  }
};

/**
 * Generate Firebase custom token for user
 */
const generateFirebaseToken = async (mysqlUserId, userData) => {
  if (!isReady || !auth) {
    throw new Error('Firebase not initialized. Please configure Firebase service account.');
  }

  try {
    return await auth.createCustomToken(mysqlUserId.toString(), {
      email: userData.email,
      full_name: userData.full_name,
      mysql_user_id: mysqlUserId,
    });
  } catch (error) {
    console.error('Error generating Firebase token:', error.message);
    throw error;
  }
};

/**
 * Get channel messages subcollection reference
 * Returns reference to chat_channels/{channelId}/messages
 */
const getChannelMessagesRef = (channelId) => {
  if (!isReady || !firestore) {
    return null;
  }
  return firestore.collection('chat_channels').doc(channelId.toString()).collection('messages');
};

/**
 * Ensure channel exists in Firestore (creates if missing)
 * Useful for ensuring collection exists before adding messages
 */
const ensureChannelExists = async (channelId, channelData = {}) => {
  if (!isReady || !firestore) {
    return false;
  }

  try {
    const channelRef = firestore.collection('chat_channels').doc(channelId.toString());
    const channelDoc = await channelRef.get();

    if (!channelDoc.exists) {
      // Channel doesn't exist, create it with minimal data
      await channelRef.set({
        mysqlChannelId: parseInt(channelId),
        memberIds: channelData.memberIds || [],
        name: channelData.name || null,
        type: channelData.type || 'group',
        lastMessage: null,
        lastMessageAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log(`✅ Created channel ${channelId} in Firestore`);
    }

    return true;
  } catch (error) {
    console.error('Error ensuring channel exists:', error.message);
    return false;
  }
};

/**
 * Test Firebase connection and collection creation
 * Useful for debugging
 */
const testFirebaseConnection = async () => {
  if (!isReady || !firestore) {
    console.warn('⚠️  Firebase not initialized');
    return false;
  }

  try {
    // Try to write a test document
    const testRef = firestore.collection('_test').doc('connection');
    await testRef.set({
      test: true,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    // Read it back
    const doc = await testRef.get();
    if (doc.exists) {
      console.log('✅ Firebase connection test successful');
      // Clean up
      await testRef.delete();
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error.message);
    return false;
  }
};

module.exports = {
  syncUserToFirestore,
  syncChannelToFirestore,
  removeChannelFromFirestore,
  updateChannelLastMessage,
  incrementUnreadCount,
  generateFirebaseToken,
  getChannelMessagesRef,
  ensureChannelExists,
  testFirebaseConnection,
};
