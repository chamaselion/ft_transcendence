const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define('oneTimeChallenge', {
    challengeId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    purpose: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    recipient: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    codeHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    attemptsRemaining: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  }, {
    timestamps: true,
    indexes: [
      { fields: ['recipient'] },
      { fields: ['purpose'] },
      { fields: ['expires_at'] },
      { fields: ['user_id'] },
    ],
  });
};