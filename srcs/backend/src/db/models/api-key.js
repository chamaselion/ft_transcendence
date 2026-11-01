const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define(
    'apiKey',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'API key',
      },
      keyHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      prefix: {
        type: DataTypes.STRING(24),
        allowNull: false,
      },
      lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      underscored: true,
      indexes: [{ fields: ['user_id'] }],
    },
  );
};
