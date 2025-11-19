const { DataTypes } = require('sequelize');
const database = require('../config/database');

const TaskFollower = database.define('TaskFollower', {
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
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'task_followers',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['task_id', 'user_id'],
    },
    {
      fields: ['task_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['is_active']
    }
  ],
});

module.exports = TaskFollower;

