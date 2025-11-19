const { DataTypes } = require('sequelize');
const database = require('../config/database');

const PriorityLabel = database.define('PriorityLabel', {
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
  color: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  icon: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
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
  tableName: 'priority_labels',
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
    },
    {
      fields: ['is_default']
    }
  ]
});

module.exports = PriorityLabel;

