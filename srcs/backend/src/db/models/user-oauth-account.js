const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define('userOauthAccount', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    provider: {
      type: DataTypes.ENUM('github', '42'),
      allowNull: false,
    },
    providerUserId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    avatarUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    accessTokenHash: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refreshTokenHash: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'user_oauth_accounts',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['provider', 'providerUserId'],
      },
      {
        unique: true,
        fields: ['userId', 'provider'],
      },
    ],
  });
};
