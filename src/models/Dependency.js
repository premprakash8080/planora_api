const { DataTypes } = require('sequelize');
const database = require('../config/database');

const Dependency = database.define('Dependency', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  task_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  depends_on_task_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  dependency_type: {
    type: DataTypes.ENUM('blocks', 'blocked_by', 'related_to'),
    defaultValue: 'blocks',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'dependencies',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['task_id', 'depends_on_task_id', 'dependency_type'],
    },
    {
      fields: ['task_id']
    },
    {
      fields: ['depends_on_task_id']
    },
    {
      fields: ['is_active']
    }
  ],
});

module.exports = Dependency;

