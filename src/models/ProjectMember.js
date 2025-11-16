const { DataTypes } = require('sequelize');
const database = require('../config/database');

const ProjectMember = database.define('ProjectMember', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  project_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('owner', 'manager', 'member'),
    defaultValue: 'member',
  },
}, {
  tableName: 'project_members',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['project_id', 'user_id'],
    },
  ],
});

module.exports = ProjectMember;

