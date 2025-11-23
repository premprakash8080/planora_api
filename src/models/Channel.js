const { DataTypes } = require('sequelize');
const database = require('../config/database');

const Channel = database.define('Channel', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM('direct', 'group', 'public', 'private'),
    allowNull: false,
    defaultValue: 'group',
  },
  created_by: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  is_archived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  firestore_path: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Firestore collection path for this channel',
  },
  last_message_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last message timestamp for sorting',
  },
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'channels',
  timestamps: true,
  underscored: true,
  paranoid: true,
  deletedAt: 'deleted_at',
});

module.exports = Channel;

