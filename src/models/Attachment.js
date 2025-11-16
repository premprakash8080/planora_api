const { DataTypes } = require('sequelize');
const database = require('../config/database');

const Attachment = database.define('Attachment', {
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
  file_url: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  file_size: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
}, {
  tableName: 'attachments',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Attachment;

