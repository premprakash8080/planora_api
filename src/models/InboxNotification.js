const { DataTypes } = require('sequelize');
const database = require('../config/database');

const InboxNotification = database.define('InboxNotification', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  task_id: {
    type: DataTypes.BIGINT,
    allowNull: true, // null for non-task notifications
  },
  project_id: {
    type: DataTypes.BIGINT,
    allowNull: true, // null for non-project notifications
  },
  notification_type: {
    type: DataTypes.ENUM('task_assigned', 'task_mentioned', 'task_updated', 'task_commented', 'project_mentioned', 'team_mentioned', 'custom'),
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true, // Store additional notification data
  },
}, {
  tableName: 'inbox_notifications',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['task_id']
    },
    {
      fields: ['project_id']
    },
    {
      fields: ['notification_type']
    },
    {
      fields: ['is_read']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['created_at']
    }
  ]
});

module.exports = InboxNotification;

