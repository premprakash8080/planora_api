const { Channel, ChannelMember, User, ChannelMessageRead } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { syncChannelToFirestore, removeChannelFromFirestore } = require('../services/firebase-sync.service');

const channelController = () => {
  /**
   * Generate Firestore path for a channel
   */
  const generateFirestorePath = (channelId, type) => {
    if (type === 'direct') {
      return `directMessages/${channelId}`;
    }
    return `channels/${channelId}`;
  };

  /**
   * Generate channel name for direct messages
   */
  const generateDirectMessageName = (user1, user2) => {
    const names = [user1.full_name, user2.full_name].sort();
    return `${names[0]}, ${names[1]}`;
  };

  /**
   * Create a new channel
   */
  /**
   * Start a direct message conversation with another user
   * POST /api/channels/direct
   */
  const startDirectMessage = async (req, res) => {
    try {
      const userId = req.user.id;
      const { userId: otherUserId } = req.body;

      if (!otherUserId) {
        return res.status(400).json(errorResponse('User ID is required', 400));
      }

      if (parseInt(otherUserId) === userId) {
        return res.status(400).json(errorResponse('Cannot start a direct message with yourself', 400));
      }

      // Check if user exists
      const otherUser = await User.findByPk(otherUserId, {
        attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
      });

      if (!otherUser) {
        return res.status(404).json(errorResponse('User not found', 404));
      }

      // Check if direct message channel already exists between these two users
      const existingDirectChannel = await Channel.findOne({
        where: {
          type: 'direct',
          deleted_at: null,
        },
        include: [
          {
            model: ChannelMember,
            as: 'members',
            where: {
              user_id: { [Op.in]: [userId, otherUserId] },
            },
          },
        ],
      });

      if (existingDirectChannel) {
        // Check if both users are members
        const memberCount = await ChannelMember.count({
          where: {
            channel_id: existingDirectChannel.id,
            user_id: { [Op.in]: [userId, otherUserId] },
          },
        });

        if (memberCount === 2) {
          // Return existing channel
          const channel = await Channel.findByPk(existingDirectChannel.id, {
            include: [
              {
                model: ChannelMember,
                as: 'members',
                include: [
                  {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
                  },
                ],
              },
              {
                model: User,
                as: 'creator',
                attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
              },
            ],
          });

          return res.json(successResponse({ channel: formatChannel(channel, userId) }));
        }
      }

      // Get current user info
      const currentUser = await User.findByPk(userId, {
        attributes: ['id', 'full_name'],
      });

      if (!currentUser) {
        return res.status(404).json(errorResponse('Current user not found', 404));
      }

      // Generate channel name from member names before creating
      const channelName = generateDirectMessageName(currentUser, otherUser);

      // Create new direct message channel with name
      const channel = await Channel.create({
        name: channelName,
        description: null,
        type: 'direct',
        created_by: userId,
        firestore_path: null,
      });

      // Set firestore path
      channel.firestore_path = generateFirestorePath(channel.id, 'direct');
      await channel.save();

      // Add both users as members
      await ChannelMember.bulkCreate([
        {
          channel_id: channel.id,
          user_id: userId,
          role: 'owner',
        },
        {
          channel_id: channel.id,
          user_id: otherUserId,
          role: 'member',
        },
      ]);

      // Fetch complete channel with members
      const completeChannel = await Channel.findByPk(channel.id, {
        include: [
          {
            model: ChannelMember,
            as: 'members',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
              },
            ],
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
          },
        ],
      });

      // Sync to Firestore
      await syncChannelToFirestore(completeChannel, completeChannel.members || []);

      res.status(201).json(successResponse({ channel: formatChannel(completeChannel, userId) }));
    } catch (error) {
      console.error('Error starting direct message:', error);
      res.status(500).json(errorResponse(`Failed to start direct message: ${error.message}`, 500));
    }
  };

  /**
   * Get all direct message conversations for the current user
   * GET /api/channels/direct
   */
  const getDirectMessages = async (req, res) => {
    try {
      const userId = req.user.id;

      // Get all direct message channels where user is a member
      const channelMemberships = await ChannelMember.findAll({
        where: { user_id: userId },
        include: [
          {
            model: Channel,
            as: 'channel',
            where: {
              type: 'direct',
              deleted_at: null,
            },
            include: [
              {
                model: ChannelMember,
                as: 'members',
                include: [
                  {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
                  },
                ],
              },
              {
                model: User,
                as: 'creator',
                attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
              },
            ],
          },
        ],
        order: [
          [Sequelize.literal('ISNULL(`Channel`.`last_message_at`)'), 'ASC'],
          [{ model: Channel, as: 'channel' }, 'last_message_at', 'DESC'],
          [{ model: Channel, as: 'channel' }, 'created_at', 'DESC'],
        ],
      });

      const channels = channelMemberships
        .map(membership => membership.channel)
        .filter(channel => channel !== null)
        .map(channel => formatChannel(channel, userId));

      res.json(successResponse({ channels }));
    } catch (error) {
      console.error('Error fetching direct messages:', error);
      res.status(500).json(errorResponse(`Failed to fetch direct messages: ${error.message}`, 500));
    }
  };

  /**
   * Create a channel (group, public, or private)
   */
  const createChannel = async (req, res) => {
    try {
      const userId = req.user.id;
      const { name, description, type = 'group', memberIds = [] } = req.body;

      // Validate channel type
      const validTypes = ['direct', 'group', 'public', 'private'];
      if (!validTypes.includes(type)) {
        return res.status(400).json(errorResponse(`Invalid channel type. Must be one of: ${validTypes.join(', ')}`, 400));
      }

      // For non-direct channels, name is required
      if (!name || name.trim() === '') {
        return res.status(400).json(errorResponse('Channel name is required', 400));
      }

      // Don't allow creating direct messages through this endpoint
      if (type === 'direct') {
        return res.status(400).json(errorResponse('Use POST /api/channels/direct to start a direct message', 400));
      }

      // Create channel
      const channel = await Channel.create({
        name: name.trim(),
        description: description?.trim() || null,
        type,
        created_by: userId,
        firestore_path: null, // Will be set after channel is created
      });

      // Set firestore path
      channel.firestore_path = generateFirestorePath(channel.id, type);
      await channel.save();

      // Add creator as member with owner role
      await ChannelMember.create({
        channel_id: channel.id,
        user_id: userId,
        role: 'owner',
      });

      // Add other members
      if (memberIds.length > 0) {
        const membersToAdd = memberIds
          .filter(id => id !== userId) // Don't add creator again
          .map(id => ({
            channel_id: channel.id,
            user_id: id,
            role: 'member',
          }));

        if (membersToAdd.length > 0) {
          await ChannelMember.bulkCreate(membersToAdd);
        }
      }

      // Fetch complete channel with members
      const completeChannel = await Channel.findByPk(channel.id, {
        include: [
          {
            model: ChannelMember,
            as: 'members',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
              },
            ],
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
          },
        ],
      });

      // Sync to Firestore
      await syncChannelToFirestore(completeChannel, completeChannel.members || []);

      res.status(201).json(successResponse({ channel: formatChannel(completeChannel, userId) }));
    } catch (error) {
      console.error('Error creating channel:', error);
      res.status(500).json(errorResponse(`Failed to create channel: ${error.message}`, 500));
    }
  };

  /**
   * Get all channels for the current user
   */
  const getChannels = async (req, res) => {
    try {
      const userId = req.user.id;
      const { type, archived = false } = req.query;

      // Build where clause
      const whereClause = {
        deleted_at: null,
        is_archived: archived === 'true',
      };

      if (type && ['direct', 'group', 'public', 'private'].includes(type)) {
        whereClause.type = type;
      }

      // Get channels where user is a member
      const channelMemberships = await ChannelMember.findAll({
        where: { user_id: userId },
        include: [
          {
            model: Channel,
            as: 'channel',
            where: whereClause,
            include: [
              {
                model: ChannelMember,
                as: 'members',
                include: [
                  {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
                  },
                ],
              },
              {
                model: User,
                as: 'creator',
                attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
              },
            ],
          },
        ],
        order: [
          [Sequelize.literal('ISNULL(`Channel`.`last_message_at`)'), 'ASC'],
          [{ model: Channel, as: 'channel' }, 'last_message_at', 'DESC'],
          [{ model: Channel, as: 'channel' }, 'created_at', 'DESC'],
        ],
      });

      const channels = channelMemberships
        .map(membership => membership.channel)
        .filter(channel => channel !== null)
        .map(channel => formatChannel(channel, userId));

      res.json(successResponse({ channels }));
    } catch (error) {
      console.error('Error fetching channels:', error);
      res.status(500).json(errorResponse(`Failed to fetch channels: ${error.message}`, 500));
    }
  };

  /**
   * Get channel by ID
   */
  const getChannelById = async (req, res) => {
    try {
      const userId = req.user.id;
      const { channelId } = req.params;

      const channel = await Channel.findByPk(channelId, {
        include: [
          {
            model: ChannelMember,
            as: 'members',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
              },
            ],
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
          },
        ],
      });

      if (!channel) {
        return res.status(404).json(errorResponse('Channel not found', 404));
      }

      // Check if user is a member
      const membership = await ChannelMember.findOne({
        where: {
          channel_id: channelId,
          user_id: userId,
        },
      });

      if (!membership) {
        return res.status(403).json(errorResponse('You are not a member of this channel', 403));
      }

      res.json(successResponse({ channel: formatChannel(channel, userId) }));
    } catch (error) {
      console.error('Error fetching channel:', error);
      res.status(500).json(errorResponse(`Failed to fetch channel: ${error.message}`, 500));
    }
  };

  /**
   * Update channel
   */
  const updateChannel = async (req, res) => {
    try {
      const userId = req.user.id;
      const { channelId } = req.params;
      const { name, description, is_archived } = req.body;

      const channel = await Channel.findByPk(channelId);

      if (!channel) {
        return res.status(404).json(errorResponse('Channel not found', 404));
      }

      // Check permissions (owner or admin can update)
      const membership = await ChannelMember.findOne({
        where: {
          channel_id: channelId,
          user_id: userId,
        },
      });

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json(errorResponse('Only channel owners and admins can update channels', 403));
      }

      // Don't allow updating direct message channels
      if (channel.type === 'direct') {
        return res.status(400).json(errorResponse('Direct message channels cannot be updated', 400));
      }

      // Update fields
      if (name !== undefined) channel.name = name.trim();
      if (description !== undefined) channel.description = description?.trim() || null;
      if (is_archived !== undefined) channel.is_archived = is_archived;

      await channel.save();

      // Fetch updated channel with members for sync
      const updatedChannel = await Channel.findByPk(channelId, {
        include: [
          {
            model: ChannelMember,
            as: 'members',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
              },
            ],
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
          },
        ],
      });

      res.json(successResponse({ channel: formatChannel(updatedChannel, userId) }));
    } catch (error) {
      console.error('Error updating channel:', error);
      res.status(500).json(errorResponse(`Failed to update channel: ${error.message}`, 500));
    }
  };

  /**
   * Delete channel
   */
  const deleteChannel = async (req, res) => {
    try {
      const userId = req.user.id;
      const { channelId } = req.params;

      const channel = await Channel.findByPk(channelId);

      if (!channel) {
        return res.status(404).json(errorResponse('Channel not found', 404));
      }

      // Only owner can delete
      const membership = await ChannelMember.findOne({
        where: {
          channel_id: channelId,
          user_id: userId,
          role: 'owner',
        },
      });

      if (!membership) {
        return res.status(403).json(errorResponse('Only channel owner can delete the channel', 403));
      }

      // Soft delete
      await channel.destroy();

      // Remove from Firestore
      await removeChannelFromFirestore(channelId);

      res.json(successResponse({ message: 'Channel deleted successfully' }));
    } catch (error) {
      console.error('Error deleting channel:', error);
      res.status(500).json(errorResponse(`Failed to delete channel: ${error.message}`, 500));
    }
  };

  /**
   * Add member to channel
   */
  const addMember = async (req, res) => {
    try {
      const userId = req.user.id;
      const { channelId } = req.params;
      const { userId: memberId } = req.body;

      if (!memberId) {
        return res.status(400).json(errorResponse('User ID is required', 400));
      }

      const channel = await Channel.findByPk(channelId);

      if (!channel) {
        return res.status(404).json(errorResponse('Channel not found', 404));
      }

      // Check if requester has permission (owner or admin)
      const requesterMembership = await ChannelMember.findOne({
        where: {
          channel_id: channelId,
          user_id: userId,
        },
      });

      if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
        return res.status(403).json(errorResponse('Only channel owners and admins can add members', 403));
      }

      // Don't allow adding members to direct messages
      if (channel.type === 'direct') {
        return res.status(400).json(errorResponse('Cannot add members to direct message channels', 400));
      }

      // Check if user exists
      const user = await User.findByPk(memberId);
      if (!user) {
        return res.status(404).json(errorResponse('User not found', 404));
      }

      // Check if already a member
      const existingMembership = await ChannelMember.findOne({
        where: {
          channel_id: channelId,
          user_id: memberId,
        },
      });

      if (existingMembership) {
        return res.status(400).json(errorResponse('User is already a member of this channel', 400));
      }

      // Add member
      await ChannelMember.create({
        channel_id: channelId,
        user_id: memberId,
        role: 'member',
      });

      // Fetch updated channel
      const updatedChannel = await Channel.findByPk(channelId, {
        include: [
          {
            model: ChannelMember,
            as: 'members',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
              },
            ],
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
          },
        ],
      });

      // Sync to Firestore
      await syncChannelToFirestore(updatedChannel, updatedChannel.members || []);

      res.json(successResponse({ channel: formatChannel(updatedChannel, userId) }));
    } catch (error) {
      console.error('Error adding member:', error);
      res.status(500).json(errorResponse(`Failed to add member: ${error.message}`, 500));
    }
  };

  /**
   * Remove member from channel
   */
  const removeMember = async (req, res) => {
    try {
      const userId = req.user.id;
      const { channelId, memberId } = req.params;

      const channel = await Channel.findByPk(channelId);

      if (!channel) {
        return res.status(404).json(errorResponse('Channel not found', 404));
      }

      // Check permissions
      const requesterMembership = await ChannelMember.findOne({
        where: {
          channel_id: channelId,
          user_id: userId,
        },
      });

      // User can remove themselves, or owner/admin can remove others
      const canRemove = requesterMembership && (
        parseInt(memberId) === userId ||
        ['owner', 'admin'].includes(requesterMembership.role)
      );

      if (!canRemove) {
        return res.status(403).json(errorResponse('You do not have permission to remove this member', 403));
      }

      // Don't allow removing owner
      const memberToRemove = await ChannelMember.findOne({
        where: {
          channel_id: channelId,
          user_id: memberId,
        },
      });

      if (memberToRemove && memberToRemove.role === 'owner' && parseInt(memberId) !== userId) {
        return res.status(403).json(errorResponse('Cannot remove channel owner', 403));
      }

      // Remove member
      await ChannelMember.destroy({
        where: {
          channel_id: channelId,
          user_id: memberId,
        },
      });

      // Fetch updated channel
      const updatedChannel = await Channel.findByPk(channelId, {
        include: [
          {
            model: ChannelMember,
            as: 'members',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
              },
            ],
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials'],
          },
        ],
      });

      // Sync to Firestore
      await syncChannelToFirestore(updatedChannel, updatedChannel.members || []);

      res.json(successResponse({ channel: formatChannel(updatedChannel, userId) }));
    } catch (error) {
      console.error('Error removing member:', error);
      res.status(500).json(errorResponse(`Failed to remove member: ${error.message}`, 500));
    }
  };

  /**
   * Mark messages as read
   */
  const markMessagesAsRead = async (req, res) => {
    try {
      const userId = req.user.id;
      const { channelId } = req.params;
      const { firestoreMessageIds = [] } = req.body;

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

      // Update last_read_at
      membership.last_read_at = new Date();
      membership.unread_count = 0;
      await membership.save();

      // Record individual message reads if provided
      if (firestoreMessageIds.length > 0) {
        const readsToCreate = firestoreMessageIds.map(messageId => ({
          channel_id: channelId,
          user_id: userId,
          firestore_message_id: messageId,
        }));

        // Use bulkCreate with ignoreDuplicates to handle existing reads
        await ChannelMessageRead.bulkCreate(readsToCreate, {
          ignoreDuplicates: true,
        });
      }

      res.json(successResponse({ message: 'Messages marked as read' }));
    } catch (error) {
      console.error('Error marking messages as read:', error);
      res.status(500).json(errorResponse(`Failed to mark messages as read: ${error.message}`, 500));
    }
  };

  /**
   * Get unread message counts for all channels
   */
  const getUnreadCounts = async (req, res) => {
    try {
      const userId = req.user.id;

      const memberships = await ChannelMember.findAll({
        where: { user_id: userId },
        include: [
          {
            model: Channel,
            as: 'channel',
            attributes: ['id', 'name', 'type'],
          },
        ],
      });

      const unreadCounts = memberships.map(membership => ({
        channelId: membership.channel_id,
        channelName: membership.channel?.name,
        channelType: membership.channel?.type,
        unreadCount: membership.unread_count || 0,
        lastReadAt: membership.last_read_at,
      }));

      const totalUnread = unreadCounts.reduce((sum, item) => sum + item.unreadCount, 0);

      res.json(successResponse({
        unreadCounts,
        totalUnread,
      }));
    } catch (error) {
      console.error('Error fetching unread counts:', error);
      res.status(500).json(errorResponse(`Failed to fetch unread counts: ${error.message}`, 500));
    }
  };

  /**
   * Update member role
   */
  const updateMemberRole = async (req, res) => {
    try {
      const userId = req.user.id;
      const { channelId, memberId } = req.params;
      const { role } = req.body;

      if (!['owner', 'admin', 'member'].includes(role)) {
        return res.status(400).json(errorResponse('Invalid role. Must be owner, admin, or member', 400));
      }

      // Check if requester is owner
      const requesterMembership = await ChannelMember.findOne({
        where: {
          channel_id: channelId,
          user_id: userId,
          role: 'owner',
        },
      });

      if (!requesterMembership) {
        return res.status(403).json(errorResponse('Only channel owner can update member roles', 403));
      }

      // Don't allow changing owner role
      if (parseInt(memberId) === userId && role !== 'owner') {
        return res.status(400).json(errorResponse('Cannot change your own role from owner', 400));
      }

      const membership = await ChannelMember.findOne({
        where: {
          channel_id: channelId,
          user_id: memberId,
        },
      });

      if (!membership) {
        return res.status(404).json(errorResponse('Member not found', 404));
      }

      membership.role = role;
      await membership.save();

      res.json(successResponse({ message: 'Member role updated successfully' }));
    } catch (error) {
      console.error('Error updating member role:', error);
      res.status(500).json(errorResponse(`Failed to update member role: ${error.message}`, 500));
    }
  };

  /**
   * Format channel for response
   */
  const formatChannel = (channel, currentUserId) => {
    if (!channel) return null;

    const plain = channel.toJSON ? channel.toJSON() : channel;
    const membership = plain.members?.find(m => m.user_id === parseInt(currentUserId));

    return {
      id: plain.id.toString(),
      name: plain.name,
      description: plain.description,
      type: plain.type,
      createdBy: plain.creator ? {
        id: plain.creator.id.toString(),
        fullName: plain.creator.full_name,
        email: plain.creator.email,
        avatarUrl: plain.creator.avatar_url,
        avatarColor: plain.creator.avatar_color,
        initials: plain.creator.initials,
      } : null,
      members: plain.members?.map(m => ({
        id: m.user.id.toString(),
        fullName: m.user.full_name,
        email: m.user.email,
        avatarUrl: m.user.avatar_url,
        avatarColor: m.user.avatar_color,
        initials: m.user.initials,
        role: m.role,
        joinedAt: m.joined_at,
        lastReadAt: m.last_read_at,
        unreadCount: m.unread_count || 0,
        isMuted: m.is_muted || false,
      })) || [],
      memberCount: plain.members?.length || 0,
      myRole: membership?.role || null,
      myUnreadCount: membership?.unread_count || 0,
      myLastReadAt: membership?.last_read_at || null,
      isArchived: plain.is_archived || false,
      firestorePath: plain.firestore_path,
      lastMessageAt: plain.last_message_at,
      createdAt: plain.created_at,
      updatedAt: plain.updated_at,
    };
  };

  return {
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
  };
};

module.exports = channelController;

