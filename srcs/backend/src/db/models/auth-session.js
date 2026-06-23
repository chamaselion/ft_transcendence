const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define('authSession', {
    token: {
      type: DataTypes.TEXT,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    loginAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    timestamps: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['expires_at'] },
    ],
  });
};