const {
  SHARE_USER_ATTRS,
  resolveModels,
  requireOwnedDocument,
  presentShare,
} = require('./helpers');

// GET /api/documents/:id/shares
const createListSharesHandler = ({ documentModel, shareModel, userModel } = {}) => {
  const models = resolveModels({ documentModel, shareModel, userModel });

  const listShares = async (req, res) => {
    try {
      const document = await requireOwnedDocument(models, req, res);
      if (!document) return undefined;

      const shares = await models.shares().findAll({
        where: { documentId: document.id },
        include: [{ model: models.users(), as: 'user', attributes: SHARE_USER_ATTRS }],
        order: [['createdAt', 'ASC']],
      });

      return res.json({
        shares: shares
          .filter((share) => share.user)
          .map((share) => presentShare(share, share.user)),
      });
    } catch (err) {
      console.error('[SHARES] list failed:', err);
      return res.status(500).json({ error: 'Failed to list shares' });
    }
  };

  return { listShares };
};

module.exports = { createListSharesHandler };
