const { DataTypes } = require('sequelize');
const database = require('../config/database');

const Task = database.define('Task', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  project_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  section_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  assigned_to: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  priority: {
    type: DataTypes.ENUM('Low', 'Medium', 'High'),
    defaultValue: 'Medium',
  },
  status: {
    type: DataTypes.ENUM('To Do', 'In Progress', 'Done', 'On Track', 'At Risk', 'Off Track'),
    defaultValue: 'To Do',
  },
  completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  comments_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'tasks',
  timestamps: true,
  underscored: true,
  paranoid: true,
  deletedAt: 'deleted_at',
});

module.exports = Task;

