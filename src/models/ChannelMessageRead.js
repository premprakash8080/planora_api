const { DataTypes } = require('sequelize');
const database = require('../config/database');

const ChannelMessageRead = database.define('ChannelMessageRead', {
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
  firestore_message_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Firestore message document ID',
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'channel_message_reads',
  timestamps: false,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['channel_id', 'user_id', 'firestore_message_id'],
    },
  ],
});

module.exports = ChannelMessageRead;

