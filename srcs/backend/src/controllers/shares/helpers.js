const sequelize = require('../../db');
const { validateUuid } = require('../auth/validation');
const { resolvePermission, atLeast, PERMISSION_VALUES } = require('../documents/permissions');

const SHARE_USER_ATTRS = ['id', 'login', 'email'];

const resolveModels = ({ documentModel, shareModel, userModel } = {}) => ({
  documents: () => documentModel || sequelize.models.document,
  shares: () => shareModel || sequelize.models.documentShare,
  users: () => userModel || sequelize.models.user,
});

const readUuid = (res, value, fieldName) => {
  const result = validateUuid(value, fieldName);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return null;
  }
  return result.value;
};

const requireOwnedDocument = async (models, req, res) => {
  const documentId = readUuid(res, req.params.id, 'document id');
  if (!documentId) return null;

  const { document, permission } = await resolvePermission(req.user, documentId, {
    documentModel: models.documents(),
    shareModel: models.shares(),
  });

  if (!atLeast(permission, 'owner')) {
    res.status(404).json({ error: 'Document not found' });
    return null;
  }
  return document;
};

const readPermission = (res, value) => {
  if (!PERMISSION_VALUES.includes(value)) {
    res.status(400).json({ error: `permission must be one of: ${PERMISSION_VALUES.join(', ')}` });
    return null;
  }
  return value;
};

const presentShare = (share, user) => ({
  userId: user.id,
  login: user.login,
  email: user.email,
  permission: share.permission,
  createdAt: share.createdAt,
});

module.exports = {
  SHARE_USER_ATTRS,
  resolveModels,
  readUuid,
  requireOwnedDocument,
  readPermission,
  presentShare,
};
