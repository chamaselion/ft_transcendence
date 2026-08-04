const { DataTypes } = require('sequelize');


module.exports = (sequelize) => {
  return sequelize.define('document', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Untitled',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
  });
};
