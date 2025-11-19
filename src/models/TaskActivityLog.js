const { DataTypes } = require('sequelize');
const database = require('../config/database');

const TaskActivityLog = database.define('TaskActivityLog', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  task_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  project_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  activity_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'created, updated, completed, assigned, comment, status_changed, priority_changed, etc.'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  old_value: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  new_value: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  updated_by: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
}, {
  tableName: 'task_activity_logs',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['task_id']
    },
    {
      fields: ['project_id']
    },
    {
      fields: ['updated_by']
    },
    {
      fields: ['activity_type']
    },
    {
      fields: ['created_at']
    }
  ]
});

module.exports = TaskActivityLog;

