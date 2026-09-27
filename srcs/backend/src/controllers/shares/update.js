const { syncLivePermission } = require('../../ws/documentSocket');
const {
  SHARE_USER_ATTRS,
  resolveModels,
  readUuid,
  requireOwnedDocument,
  readPermission,
  presentShare,
} = require('./helpers');

// PATCH /api/documents/:id/shares/:userId   { permission }
const createUpdateShareHandler = ({ documentModel, shareModel, userModel } = {}) => {
  const models = resolveModels({ documentModel, shareModel, userModel });

  const updateShare = async (req, res) => {
    try {
      const document = await requireOwnedDocument(models, req, res);
      if (!document) return undefined;

      const userId = readUuid(res, req.params.userId, 'user id');
      if (!userId) return undefined;

      const requestedPermission = readPermission(res, (req.body || {}).permission);
      if (!requestedPermission) return undefined;

      const share = await models.shares().findOne({
        where: { documentId: document.id, userId },
      });
      if (!share) return res.status(404).json({ error: 'Share not found' });

      const target = await models.users().findByPk(userId, { attributes: SHARE_USER_ATTRS });
      if (!target) return res.status(404).json({ error: 'User not found' });

      share.permission = requestedPermission;
      await share.save();

      syncLivePermission(document.id, userId, requestedPermission);

      return res.json({ share: presentShare(share, target) });
    } catch (err) {
      console.error('[SHARES] update failed:', err);
      return res.status(500).json({ error: 'Failed to update share' });
    }
  };

  return { updateShare };
};

module.exports = { createUpdateShareHandler };
