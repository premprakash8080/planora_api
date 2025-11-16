const { DataTypes } = require('sequelize');
const database = require('../config/database');

const TaskComment = database.define('TaskComment', {
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
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  tableName: 'task_comments',
  timestamps: true,
  underscored: true,
});

module.exports = TaskComment;

