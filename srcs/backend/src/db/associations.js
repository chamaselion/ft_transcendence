function applyAssociations(sequelize) {
  const {
    user,
    userIcons,
    userOauthAccount,
    oauthStateIntent,
    authSession,
    document,
    documentShare,
  } = sequelize.models;

  if (userOauthAccount) {
    user.hasMany(userOauthAccount, {
      foreignKey: "userId",
      onDelete: "CASCADE",
    });
    userOauthAccount.belongsTo(user, { foreignKey: "userId" });
  }

  if (authSession) {
    user.hasMany(authSession, { foreignKey: "userId", onDelete: "CASCADE" });
    authSession.belongsTo(user, { foreignKey: "userId" });
  }

  if (oauthStateIntent) {
    user.hasMany(oauthStateIntent, {
      foreignKey: "userId",
      onDelete: "CASCADE",
    });
    oauthStateIntent.belongsTo(user, { foreignKey: "userId" });
  }

  if (document) {
    user.hasMany(document, { foreignKey: "ownerId", onDelete: "CASCADE" });
    document.belongsTo(user, { as: "owner", foreignKey: "ownerId" });
  }

  if (document && documentShare) {
    const shareDocumentKey = { name: "documentId", allowNull: false };
    const shareUserKey = { name: "userId", allowNull: false };

    document.hasMany(documentShare, {
      foreignKey: shareDocumentKey,
      as: "shares",
      onDelete: "CASCADE",
    });
    documentShare.belongsTo(document, { foreignKey: shareDocumentKey });

    user.hasMany(documentShare, {
      foreignKey: shareUserKey,
      onDelete: "CASCADE",
    });
    documentShare.belongsTo(user, { as: "user", foreignKey: shareUserKey });
  }

  if (userIcons) {
    user.hasMany(userIcons, {
      as: "icons",
      foreignKey: "userId",
      onDelete: "CASCADE",
    });

    userIcons.belongsTo(user, {
      as: "user",
      foreignKey: "userId",
      onDelete: "CASCADE",
    });
  }
}

module.exports = { applyAssociations };
