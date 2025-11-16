const { DataTypes } = require('sequelize');
const database = require('../config/database');

const Section = database.define('Section', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  project_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  position: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'sections',
  timestamps: true,
  underscored: true,
});

module.exports = Section;

