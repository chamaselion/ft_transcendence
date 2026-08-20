function applyAssociations(sequelize) {
  const { user, authSession, document } = sequelize.models;

  if (authSession) {
    user.hasMany(authSession, { foreignKey: 'userId', onDelete: 'CASCADE' });
    authSession.belongsTo(user, { foreignKey: 'userId' });
  }

  if (document) {
    user.hasMany(document, { foreignKey: 'ownerId', onDelete: 'CASCADE' });
    document.belongsTo(user, { as: 'owner', foreignKey: 'ownerId' });
  }
}

module.exports = { applyAssociations };
