const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  sequelize.define(
    "userIcons",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true, // When userId is null, it means the icon is a default icon
        field: "user_id",
      },
      iconUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: "icon_url",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "is_active",
      }
    },
    {
      tableName: "user_icons",
      timestamps: true,
      indexes: [{ fields: ["user_id"] }],
    },
  );
};
