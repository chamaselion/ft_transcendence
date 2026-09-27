const sequelize = require('../../db');


const RANK = { viewer: 1, editor: 2, owner: 3 };

const PERMISSION_VALUES = ['viewer', 'editor'];

const resolvePermission = async (user, documentId, { documentModel, shareModel } = {}) => {
  const documents = documentModel || sequelize.models.document;
  const shares = shareModel || sequelize.models.documentShare;

  const document = await documents.findByPk(documentId);
  if (!document) return { document: null, permission: null };

  if (user.role === 'admin') return { document, permission: 'owner' };

  if (String(document.ownerId).toLowerCase() === String(user.id).toLowerCase()) {
    return { document, permission: 'owner' };
  }

  const share = await shares.findOne({
    where: { documentId: document.id, userId: user.id },
  });

  return { document, permission: share ? share.permission : null };
};


const atLeast = (permission, required) =>
  Boolean(permission) && RANK[permission] >= RANK[required];

module.exports = { resolvePermission, atLeast, RANK, PERMISSION_VALUES };
