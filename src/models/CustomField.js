const { DataTypes } = require('sequelize');
const database = require('../config/database');

const CustomField = database.define('CustomField', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  project_id: {
    type: DataTypes.BIGINT,
    allowNull: true, // null means global/available to all projects
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  field_type: {
    type: DataTypes.ENUM('text', 'number', 'date', 'select', 'checkbox', 'url', 'email'),
    allowNull: false,
  },
  options: {
    type: DataTypes.JSON,
    allowNull: true, // For select fields, store options array
  },
  default_value: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  created_by: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
}, {
  tableName: 'custom_fields',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['project_id']
    },
    {
      fields: ['created_by']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['order']
    }
  ]
});

module.exports = CustomField;

