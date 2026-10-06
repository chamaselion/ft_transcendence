const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define('oauthStateIntent', {
    stateId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      field: 'state_id',
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'user_id',
    },
    provider: {
      type: DataTypes.ENUM('github', '42'),
      allowNull: false,
    },
    mode: {
      type: DataTypes.ENUM('login', 'link'),
      allowNull: false,
    },
    next: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '/',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
  }, {
    tableName: 'oauth_state_intents',
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['provider'] },
      { fields: ['expires_at'] },
    ],
  });
};