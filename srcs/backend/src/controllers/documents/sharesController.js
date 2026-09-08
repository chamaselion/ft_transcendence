const sequelize = require('../../db');
const { validateEmail, validateUuid } = require('../auth/validation');
const { resolvePermission, atLeast, PERMISSION_VALUES } = require('./permissions');
const { evictFromDocument, syncLivePermission } = require('../../ws/documentSocket');

// Share management for a single document.
//
// Managing shares is owner-only (admins included, since they resolve to
// 'owner'). Editors deliberately cannot re-share: otherwise every editor could
// widen the circle further and the owner would lose control over who reaches
// the document.
//
// Grants are addressed by *email*, not by user id. That is not cosmetic:
// GET /api/users is admin-only, so a regular user has no way to turn an email
// into an id and the feature would be unusable for everyone but admins. The
// lookup therefore happens server-side.

const createSharesController = ({ documentModel, shareModel, userModel } = {}) => {
  const resolveDocuments = () => documentModel || sequelize.models.document;
  const resolveShares = () => shareModel || sequelize.models.documentShare;
  const resolveUsers = () => userModel || sequelize.models.user;

  const SHARE_USER_ATTRS = ['id', 'login', 'email'];

  const readUuid = (res, value, fieldName) => {
    const result = validateUuid(value, fieldName);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return null;
    }
    return result.value;
  };

  // Every route here needs the caller to own the document. A caller who does
  // not gets the same 404 the documents controller gives, so share routes
  // cannot be used to probe which document ids exist either.
  const requireOwnedDocument = async (req, res) => {
    const documentId = readUuid(res, req.params.id, 'document id');
    if (!documentId) return null;

    const { document, permission } = await resolvePermission(req.user, documentId, {
      documentModel: resolveDocuments(),
      shareModel: resolveShares(),
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

  // GET /api/documents/:id/shares
  const list = async (req, res) => {
    try {
      const document = await requireOwnedDocument(req, res);
      if (!document) return undefined;

      const shares = await resolveShares().findAll({
        where: { documentId: document.id },
        include: [{ model: resolveUsers(), as: 'user', attributes: SHARE_USER_ATTRS }],
        order: [['createdAt', 'ASC']],
      });

      return res.json({
        shares: shares
          // A share whose user vanished should not take the whole listing down
          // with a null dereference; the cascade normally prevents this.
          .filter((share) => share.user)
          .map((share) => presentShare(share, share.user)),
      });
    } catch (err) {
      console.error('[SHARES] list failed:', err);
      return res.status(500).json({ error: 'Failed to list shares' });
    }
  };

  // POST /api/documents/:id/shares   { email, permission }
  const create = async (req, res) => {
    try {
      const document = await requireOwnedDocument(req, res);
      if (!document) return undefined;

      const { email, permission } = req.body || {};

      const emailResult = validateEmail(email);
      if (!emailResult.ok) return res.status(400).json({ error: emailResult.error });

      const requestedPermission = readPermission(res, permission);
      if (!requestedPermission) return undefined;

      // Emails are stored as the user typed them at registration, so match
      // case-insensitively - the same reason adminBootstrap lowercases both
      // sides before comparing.
      const target = await resolveUsers().findOne({
        where: sequelize.where(
          sequelize.fn('lower', sequelize.col('email')),
          emailResult.value.toLowerCase(),
        ),
        attributes: SHARE_USER_ATTRS,
      });
      if (!target) return res.status(404).json({ error: 'User not found' });

      if (String(target.id).toLowerCase() === String(document.ownerId).toLowerCase()) {
        return res.status(400).json({ error: 'The owner already has full access' });
      }
      if (String(target.id).toLowerCase() === String(req.user.id).toLowerCase()) {
        return res.status(400).json({ error: 'You cannot share a document with yourself' });
      }

      const shares = resolveShares();
      const existing = await shares.findOne({
        where: { documentId: document.id, userId: target.id },
      });

      // Re-sharing with someone who already has access changes their level
      // instead of hitting the unique index with a duplicate row.
      if (existing) {
        existing.permission = requestedPermission;
        await existing.save();
        syncLivePermission(document.id, target.id, requestedPermission);
        return res.json({ share: presentShare(existing, target) });
      }

      const share = await shares.create({
        documentId: document.id,
        userId: target.id,
        permission: requestedPermission,
      });

      return res.status(201).json({ share: presentShare(share, target) });
    } catch (err) {
      console.error('[SHARES] create failed:', err);
      return res.status(500).json({ error: 'Failed to share document' });
    }
  };

  // PATCH /api/documents/:id/shares/:userId   { permission }
  const update = async (req, res) => {
    try {
      const document = await requireOwnedDocument(req, res);
      if (!document) return undefined;

      const userId = readUuid(res, req.params.userId, 'user id');
      if (!userId) return undefined;

      const requestedPermission = readPermission(res, (req.body || {}).permission);
      if (!requestedPermission) return undefined;

      const share = await resolveShares().findOne({
        where: { documentId: document.id, userId },
      });
      if (!share) return res.status(404).json({ error: 'Share not found' });

      // Load the target *before* writing. The other way round, a vanished
      // account produces a 404 after the level has already been changed and
      // pushed to the live socket - a request that fails and still leaves the
      // system altered.
      const target = await resolveUsers().findByPk(userId, { attributes: SHARE_USER_ATTRS });
      if (!target) return res.status(404).json({ error: 'User not found' });

      share.permission = requestedPermission;
      await share.save();

      // Push the new level into any open connection. Without this a user
      // downgraded to viewer keeps writing until they reload the page.
      syncLivePermission(document.id, userId, requestedPermission);

      return res.json({ share: presentShare(share, target) });
    } catch (err) {
      console.error('[SHARES] update failed:', err);
      return res.status(500).json({ error: 'Failed to update share' });
    }
  };

  // DELETE /api/documents/:id/shares/:userId
  const remove = async (req, res) => {
    try {
      const document = await requireOwnedDocument(req, res);
      if (!document) return undefined;

      const userId = readUuid(res, req.params.userId, 'user id');
      if (!userId) return undefined;

      const destroyed = await resolveShares().destroy({
        where: { documentId: document.id, userId },
      });
      if (!destroyed) return res.status(404).json({ error: 'Share not found' });

      // Revoking has to reach the live session too, or the former editor keeps
      // typing into a document they no longer have access to.
      evictFromDocument(document.id, userId);

      return res.status(204).send();
    } catch (err) {
      console.error('[SHARES] delete failed:', err);
      return res.status(500).json({ error: 'Failed to remove share' });
    }
  };

  return { list, create, update, remove };
};

module.exports = { createSharesController };
