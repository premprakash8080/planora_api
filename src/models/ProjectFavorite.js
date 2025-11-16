const { DataTypes } = require('sequelize');
const database = require('../config/database');

const ProjectFavorite = database.define('ProjectFavorite', {
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
}, {
  tableName: 'project_favorites',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['project_id', 'user_id'],
    },
  ],
});

module.exports = ProjectFavorite;

