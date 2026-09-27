const { evictFromDocument } = require('../../ws/documentSocket');
const { resolveModels, readUuid, requireOwnedDocument } = require('./helpers');

// DELETE /api/documents/:id/shares/:userId
const createDeleteShareHandler = ({ documentModel, shareModel } = {}) => {
  const models = resolveModels({ documentModel, shareModel });

  const deleteShare = async (req, res) => {
    try {
      const document = await requireOwnedDocument(models, req, res);
      if (!document) return undefined;

      const userId = readUuid(res, req.params.userId, 'user id');
      if (!userId) return undefined;

      const destroyed = await models.shares().destroy({
        where: { documentId: document.id, userId },
      });
      if (!destroyed) return res.status(404).json({ error: 'Share not found' });

      evictFromDocument(document.id, userId);

      return res.status(204).send();
    } catch (err) {
      console.error('[SHARES] delete failed:', err);
      return res.status(500).json({ error: 'Failed to remove share' });
    }
  };

  return { deleteShare };
};

module.exports = { createDeleteShareHandler };
