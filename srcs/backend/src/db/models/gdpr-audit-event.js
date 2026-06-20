const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define('gdprAuditEvent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    actionType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reference: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    eventAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  }, {
    timestamps: false,
  });
};