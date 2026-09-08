const sequelize = require('../../db');

// Effective permission levels, ordered. 'owner' is not a stored value - it is
// derived from document.ownerId (and granted to admins) - the other two come
// from the documentShare rows.
const RANK = { viewer: 1, editor: 2, owner: 3 };

const PERMISSION_VALUES = ['viewer', 'editor'];

// Resolves what `user` may do with `documentId`. This is the single place the
// question is answered: the REST controllers and the WebSocket both go through
// it, so the admin bypass and the owner rule exist exactly once.
//
// Returns { document, permission }. `permission` is null when there is no
// access at all.
//
// IMPORTANT: callers must answer 404 when `permission` is null and must not
// leak the returned document. It is handed back only so the caller does not
// have to query the same row twice. Answering 403 here would let a caller
// probe which document ids exist, which is why every rejection in these
// controllers looks like a missing document.
const resolvePermission = async (user, documentId, { documentModel, shareModel } = {}) => {
  const documents = documentModel || sequelize.models.document;
  const shares = shareModel || sequelize.models.documentShare;

  const document = await documents.findByPk(documentId);
  if (!document) return { document: null, permission: null };

  // Admins reach every document, exactly as they did before shares existed.
  if (user.role === 'admin') return { document, permission: 'owner' };

  // Postgres compares uuid values case-insensitively, so compare lowercased
  // strings - the same trap the users controller documents for its self-guards.
  if (String(document.ownerId).toLowerCase() === String(user.id).toLowerCase()) {
    return { document, permission: 'owner' };
  }

  const share = await shares.findOne({
    where: { documentId: document.id, userId: user.id },
  });

  return { document, permission: share ? share.permission : null };
};

// Ranked comparison, so callers ask for the level they need ('editor') instead
// of enumerating the levels that happen to satisfy it.
const atLeast = (permission, required) =>
  Boolean(permission) && RANK[permission] >= RANK[required];

module.exports = { resolvePermission, atLeast, RANK, PERMISSION_VALUES };
