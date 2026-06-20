const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define('gdprExportQuota', {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    windowStartAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    exportCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastExportAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    timestamps: false,
  });
};