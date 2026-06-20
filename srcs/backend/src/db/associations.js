function applyAssociations(sequelize) {
  const {
    user,
    asset,
    assetValuation,
    transaction
  } = sequelize.models;

  asset.hasOne(user);
  user.belongsTo(asset);

  user.hasMany(transaction);
  transaction.belongsTo(user);

  asset.hasMany(transaction);
  transaction.belongsTo(asset);

  asset.hasMany(assetValuation);
  assetValuation.belongsTo(asset);
}

module.exports = { applyAssociations };
