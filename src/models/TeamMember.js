const { DataTypes } = require('sequelize');
const database = require('../config/database');

const TeamMember = database.define('TeamMember', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  team_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('owner', 'admin', 'member'),
    defaultValue: 'member',
  },
}, {
  tableName: 'team_members',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['team_id', 'user_id'],
    },
  ],
});

module.exports = TeamMember;

