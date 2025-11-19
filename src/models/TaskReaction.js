const { DataTypes } = require('sequelize');
const database = require('../config/database');

const TaskReaction = database.define('TaskReaction', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  task_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  reaction_type: {
    type: DataTypes.ENUM('like', 'love', 'laugh', 'wow', 'sad', 'angry', 'thumbs_up', 'thumbs_down'),
    defaultValue: 'like',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'task_reactions',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['task_id', 'user_id', 'reaction_type'],
    },
    {
      fields: ['task_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['reaction_type']
    },
    {
      fields: ['is_active']
    }
  ],
});

module.exports = TaskReaction;

