function applyAssociations(sequelize) {
  const { user, authSession, document, documentShare } = sequelize.models;

  if (authSession) {
    user.hasMany(authSession, { foreignKey: 'userId', onDelete: 'CASCADE' });
    authSession.belongsTo(user, { foreignKey: 'userId' });
  }

  if (document) {
    user.hasMany(document, { foreignKey: 'ownerId', onDelete: 'CASCADE' });
    document.belongsTo(user, { as: 'owner', foreignKey: 'ownerId' });
  }

  if (document && documentShare) {
    const shareDocumentKey = { name: 'documentId', allowNull: false };
    const shareUserKey = { name: 'userId', allowNull: false };

    document.hasMany(documentShare, { foreignKey: shareDocumentKey, as: 'shares', onDelete: 'CASCADE' });
    documentShare.belongsTo(document, { foreignKey: shareDocumentKey });

    user.hasMany(documentShare, { foreignKey: shareUserKey, onDelete: 'CASCADE' });
    documentShare.belongsTo(user, { as: 'user', foreignKey: shareUserKey });
  }
}

module.exports = { applyAssociations };
