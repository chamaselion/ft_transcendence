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
      field: 'user_id',
    },
    provider: {
      type: DataTypes.ENUM('github', '42'),
      allowNull: false,
    },
    providerUserId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'provider_user_id',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'email_verified',
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'display_name',
    },
    avatarUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'avatar_url',
    },
    accessTokenHash: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'access_token_hash',
    },
    refreshTokenHash: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'refresh_token_hash',
    },
  }, {
    tableName: 'user_oauth_accounts',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['provider', 'provider_user_id'],
      },
      {
        unique: true,
        fields: ['user_id', 'provider'],
      },
    ],
  });
};
