function applyAssociations(sequelize) {
  const {
    user,
    asset,
    assetValuation,
    transaction,
    authSession,
  } = sequelize.models;

  asset.hasOne(user);
  user.belongsTo(asset);

  user.hasMany(transaction);
  transaction.belongsTo(user);

  asset.hasMany(transaction);
  transaction.belongsTo(asset);

  asset.hasMany(assetValuation);
  assetValuation.belongsTo(asset);

  if (authSession) {
    user.hasMany(authSession, { foreignKey: 'userId', onDelete: 'CASCADE' });
    authSession.belongsTo(user, { foreignKey: 'userId' });
  }
}

module.exports = { applyAssociations };
