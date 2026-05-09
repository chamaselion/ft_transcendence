const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  login: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  refreshTokenHash: {
    type: DataTypes.STRING,
	allowNull: true,
  },
  isDeleted: {
	type: DataTypes.BOOLEAN,
	allowNull: false,
	defaultValue: false
  },
  deletedAt: {
	type: DataTypes.DATE,
	allowNull:true,
  }
}, {
  tableName: 'users',
  timestamps: true,
});

module.exports = User;
