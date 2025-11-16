const { DataTypes } = require('sequelize');
const database = require('../config/database');

const TaskLabel = database.define('TaskLabel', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  task_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  label_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
}, {
  tableName: 'task_labels',
  timestamps: false,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['task_id', 'label_id'],
    },
  ],
});

module.exports = TaskLabel;

