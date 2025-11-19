const { Mail, User } = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

const mailController = () => {
  // Helper function to format mails
  const formatMails = (mails) => {
    return mails.map(mail => ({
      id: mail.id.toString(),
      sender: mail.sender?.full_name || 'Unknown',
      senderEmail: mail.sender?.email || '',
      senderAvatarUrl: mail.sender?.avatar_url,
      senderAvatarColor: mail.sender?.avatar_color,
      recipient: mail.recipient?.full_name || 'Unknown',
      recipientEmail: mail.recipient?.email || '',
      subject: mail.subject,
      preview: mail.body.length > 90 ? `${mail.body.substring(0, 87)}...` : mail.body,
      body: mail.body,
      timestamp: mail.created_at,
      isRead: mail.is_read,
      isStarred: mail.is_starred,
      isArchived: mail.is_archived
    }));
  };

  // Get all mails for current user (inbox - received mails)
  const getInboxMails = async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      const mails = await Mail.findAll({
        where: {
          recipient_id: userId,
          deleted_at: null,
          is_archived: false
        },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          },
          {
            model: User,
            as: 'recipient',
            attributes: ['id', 'full_name', 'email']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(successResponse({ mails: formatMails(mails) }));
    } catch (error) {
      console.error('Error fetching inbox mails:', error);
      res.status(500).json(errorResponse(`Failed to fetch mails: ${error.message}`, 500));
    }
  };

  // Get unread mails
  const getUnreadMails = async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      const mails = await Mail.findAll({
        where: {
          recipient_id: userId,
          deleted_at: null,
          is_read: false,
          is_archived: false
        },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          },
          {
            model: User,
            as: 'recipient',
            attributes: ['id', 'full_name', 'email']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(successResponse({ mails: formatMails(mails) }));
    } catch (error) {
      console.error('Error fetching unread mails:', error);
      res.status(500).json(errorResponse(`Failed to fetch unread mails: ${error.message}`, 500));
    }
  };

  // Get starred mails
  const getStarredMails = async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      const mails = await Mail.findAll({
        where: {
          recipient_id: userId,
          deleted_at: null,
          is_starred: true,
          is_archived: false
        },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          },
          {
            model: User,
            as: 'recipient',
            attributes: ['id', 'full_name', 'email']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(successResponse({ mails: formatMails(mails) }));
    } catch (error) {
      console.error('Error fetching starred mails:', error);
      res.status(500).json(errorResponse(`Failed to fetch starred mails: ${error.message}`, 500));
    }
  };

  // Get archived mails
  const getArchivedMails = async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      const mails = await Mail.findAll({
        where: {
          recipient_id: userId,
          deleted_at: null,
          is_archived: true
        },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          },
          {
            model: User,
            as: 'recipient',
            attributes: ['id', 'full_name', 'email']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(successResponse({ mails: formatMails(mails) }));
    } catch (error) {
      console.error('Error fetching archived mails:', error);
      res.status(500).json(errorResponse(`Failed to fetch archived mails: ${error.message}`, 500));
    }
  };

  // Get sent mails
  const getSentMails = async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      const mails = await Mail.findAll({
        where: {
          sender_id: userId,
          deleted_at: null
        },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          },
          {
            model: User,
            as: 'recipient',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      const formattedMails = mails.map(mail => ({
        id: mail.id.toString(),
        sender: mail.sender?.full_name || 'You',
        senderEmail: mail.sender?.email || '',
        senderAvatarUrl: mail.sender?.avatar_url,
        senderAvatarColor: mail.sender?.avatar_color,
        recipient: mail.recipient?.full_name || 'Unknown',
        recipientEmail: mail.recipient?.email || '',
        subject: mail.subject,
        preview: mail.body.length > 90 ? `${mail.body.substring(0, 87)}...` : mail.body,
        body: mail.body,
        timestamp: mail.created_at,
        isRead: mail.is_read,
        isStarred: mail.is_starred
      }));

      res.json(successResponse({ mails: formattedMails }));
    } catch (error) {
      console.error('Error fetching sent mails:', error);
      res.status(500).json(errorResponse(`Failed to fetch sent mails: ${error.message}`, 500));
    }
  };

  // Get mail by ID
  const getMailById = async (req, res) => {
    const { mailId } = req.params;
    const userId = req.user.id;

    try {
      if (!mailId || isNaN(parseInt(mailId))) {
        return res.status(400).json(errorResponse('Invalid mail ID', 400));
      }

      const mail = await Mail.findByPk(mailId, {
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          },
          {
            model: User,
            as: 'recipient',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          }
        ]
      });

      if (!mail) {
        return res.status(404).json(errorResponse('Mail not found', 404));
      }

      // Check if user is sender or recipient
      if (mail.sender_id !== userId && mail.recipient_id !== userId) {
        return res.status(403).json(errorResponse('You do not have permission to view this mail', 403));
      }

      // Mark as read if user is recipient
      if (mail.recipient_id === userId && !mail.is_read) {
        await mail.update({ is_read: true });
        mail.is_read = true;
      }

      const formattedMail = {
        id: mail.id.toString(),
        sender: mail.sender?.full_name || 'Unknown',
        senderEmail: mail.sender?.email || '',
        senderAvatarUrl: mail.sender?.avatar_url,
        senderAvatarColor: mail.sender?.avatar_color,
        recipient: mail.recipient?.full_name || 'Unknown',
        recipientEmail: mail.recipient?.email || '',
        subject: mail.subject,
        preview: mail.body.length > 90 ? `${mail.body.substring(0, 87)}...` : mail.body,
        body: mail.body,
        timestamp: mail.created_at,
        isRead: mail.is_read,
        isStarred: mail.is_starred,
        isArchived: mail.is_archived
      };

      res.json(successResponse({ mail: formattedMail }));
    } catch (error) {
      console.error('Error fetching mail:', error);
      res.status(500).json(errorResponse(`Failed to fetch mail: ${error.message}`, 500));
    }
  };

  // Send mail
  const sendMail = async (req, res) => {
    const { recipient_email, subject, body } = req.body;
    const sender_id = req.user.id;

    try {
      if (!(recipient_email && subject && body)) {
        return res.status(400).json(errorResponse('Missing params: recipient_email, subject, and body are required', 400));
      }

      if (!subject.trim()) {
        return res.status(400).json(errorResponse('Subject cannot be empty', 400));
      }

      if (!body.trim()) {
        return res.status(400).json(errorResponse('Body cannot be empty', 400));
      }

      // Find recipient by email
      const recipient = await User.findOne({
        where: { email: recipient_email }
      });

      if (!recipient) {
        return res.status(404).json(errorResponse('Recipient not found', 404));
      }

      const mail = await Mail.create({
        sender_id,
        recipient_id: recipient.id,
        subject,
        body,
        is_read: false,
        is_starred: false,
        is_archived: false
      });

      const mailWithRelations = await Mail.findByPk(mail.id, {
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          },
          {
            model: User,
            as: 'recipient',
            attributes: ['id', 'full_name', 'email', 'avatar_url', 'avatar_color', 'initials']
          }
        ]
      });

      const formattedMail = {
        id: mailWithRelations.id.toString(),
        sender: mailWithRelations.sender?.full_name || 'You',
        senderEmail: mailWithRelations.sender?.email || '',
        senderAvatarUrl: mailWithRelations.sender?.avatar_url,
        senderAvatarColor: mailWithRelations.sender?.avatar_color,
        recipient: mailWithRelations.recipient?.full_name || 'Unknown',
        recipientEmail: mailWithRelations.recipient?.email || '',
        subject: mailWithRelations.subject,
        preview: mailWithRelations.body.length > 90 ? `${mailWithRelations.body.substring(0, 87)}...` : mailWithRelations.body,
        body: mailWithRelations.body,
        timestamp: mailWithRelations.created_at,
        isRead: mailWithRelations.is_read,
        isStarred: mailWithRelations.is_starred
      };

      res.status(201).json(successResponse({ mail: formattedMail }, 'Mail sent successfully'));
    } catch (error) {
      console.error('Error sending mail:', error);
      res.status(500).json(errorResponse(`Failed to send mail: ${error.message}`, 500));
    }
  };

  // Update mail (mark as read, star, archive, etc.)
  const updateMail = async (req, res) => {
    const { mailId } = req.params;
    const userId = req.user.id;
    const { is_read, is_starred, is_archived } = req.body;

    try {
      if (!mailId || isNaN(parseInt(mailId))) {
        return res.status(400).json(errorResponse('Invalid mail ID', 400));
      }

      const mail = await Mail.findByPk(mailId);

      if (!mail) {
        return res.status(404).json(errorResponse('Mail not found', 404));
      }

      // Check if user is sender or recipient
      if (mail.sender_id !== userId && mail.recipient_id !== userId) {
        return res.status(403).json(errorResponse('You do not have permission to update this mail', 403));
      }

      // Update fields
      const updateData = {};
      if (is_read !== undefined) updateData.is_read = is_read;
      if (is_starred !== undefined) updateData.is_starred = is_starred;
      if (is_archived !== undefined) updateData.is_archived = is_archived;

      await mail.update(updateData);

      res.json(successResponse({ mail }, 'Mail updated successfully'));
    } catch (error) {
      console.error('Error updating mail:', error);
      res.status(500).json(errorResponse(`Failed to update mail: ${error.message}`, 500));
    }
  };

  // Delete mail (soft delete)
  const deleteMail = async (req, res) => {
    const { mailId } = req.params;
    const userId = req.user.id;

    try {
      if (!mailId || isNaN(parseInt(mailId))) {
        return res.status(400).json(errorResponse('Invalid mail ID', 400));
      }

      const mail = await Mail.findByPk(mailId);

      if (!mail) {
        return res.status(404).json(errorResponse('Mail not found', 404));
      }

      // Check if user is sender or recipient
      if (mail.sender_id !== userId && mail.recipient_id !== userId) {
        return res.status(403).json(errorResponse('You do not have permission to delete this mail', 403));
      }

      // Soft delete
      await mail.update({ deleted_at: new Date() });

      res.json(successResponse(null, 'Mail deleted successfully'));
    } catch (error) {
      console.error('Error deleting mail:', error);
      res.status(500).json(errorResponse(`Failed to delete mail: ${error.message}`, 500));
    }
  };

  return {
    getInboxMails,
    getUnreadMails,
    getStarredMails,
    getArchivedMails,
    getSentMails,
    getMailById,
    sendMail,
    updateMail,
    deleteMail
  };
};

module.exports = mailController;

