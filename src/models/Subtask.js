const { DataTypes } = require('sequelize');
const database = require('../config/database');

const Subtask = database.define('Subtask', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  task_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  is_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'subtasks',
  timestamps: true,
  underscored: true,
});

module.exports = Subtask;

