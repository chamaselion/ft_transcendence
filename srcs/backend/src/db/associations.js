function applyAssociations(sequelize) {
  const { user, authSession } = sequelize.models;

  if (authSession) {
    user.hasMany(authSession, { foreignKey: 'userId', onDelete: 'CASCADE' });
    authSession.belongsTo(user, { foreignKey: 'userId' });
  }
}

module.exports = { applyAssociations };
