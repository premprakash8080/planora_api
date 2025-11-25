const { DataTypes } = require('sequelize');
const database = require('../config/database');

const ChannelMember = database.define('ChannelMember', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  channel_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('owner', 'admin', 'member'),
    defaultValue: 'member',
  },
  last_read_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last time user read messages in this channel',
  },
  unread_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Cached unread message count',
  },
  is_muted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'User muted notifications for this channel',
  },
}, {
  tableName: 'channel_members',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['channel_id', 'user_id'],
    },
  ],
});

module.exports = ChannelMember;

