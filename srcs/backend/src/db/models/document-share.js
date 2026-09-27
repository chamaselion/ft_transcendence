const { DataTypes } = require('sequelize');

// One row per (document, user) grant. The owner deliberately has *no* row
// here - ownership stays `document.ownerId` and outranks every share, so
// there is only ever one answer to "who owns this document" and deleting the
// last share can never leave a document without an owner.

module.exports = (sequelize) => {
  return sequelize.define('documentShare', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    permission: {
      type: DataTypes.ENUM('viewer', 'editor'),
      allowNull: false,
      defaultValue: 'viewer',
    },
  }, {
    indexes: [
      { unique: true, fields: ['document_id', 'user_id'] },
    ],
  });
};
