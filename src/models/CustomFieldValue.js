const { DataTypes } = require('sequelize');
const database = require('../config/database');

const CustomFieldValue = database.define('CustomFieldValue', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  task_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  custom_field_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'custom_field_values',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['task_id', 'custom_field_id'],
    },
    {
      fields: ['task_id']
    },
    {
      fields: ['custom_field_id']
    },
    {
      fields: ['is_active']
    }
  ],
});

module.exports = CustomFieldValue;

