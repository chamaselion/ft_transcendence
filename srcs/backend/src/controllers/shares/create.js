const sequelize = require('../../db');
const { validateEmail } = require('../auth/validation');
const { syncLivePermission } = require('../../ws/documentSocket');
const {
  SHARE_USER_ATTRS,
  resolveModels,
  requireOwnedDocument,
  readPermission,
  presentShare,
} = require('./helpers');

// POST /api/documents/:id/shares   { email, permission }
const createCreateShareHandler = ({ documentModel, shareModel, userModel } = {}) => {
  const models = resolveModels({ documentModel, shareModel, userModel });

  const createShare = async (req, res) => {
    try {
      const document = await requireOwnedDocument(models, req, res);
      if (!document) return undefined;

      const { email, permission } = req.body || {};

      const emailResult = validateEmail(email);
      if (!emailResult.ok) return res.status(400).json({ error: emailResult.error });

      const requestedPermission = readPermission(res, permission);
      if (!requestedPermission) return undefined;

      const target = await models.users().findOne({
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

      const shares = models.shares();
      const existing = await shares.findOne({
        where: { documentId: document.id, userId: target.id },
      });

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

  return { createShare };
};

module.exports = { createCreateShareHandler };
