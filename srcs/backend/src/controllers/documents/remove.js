const { atLeast } = require('./permissions');
const { resolveModels, readId, permissionFor } = require('./helpers');

// DELETE /api/documents/:id
const createDeleteDocumentHandler = ({ documentModel, shareModel } = {}) => {
  const models = resolveModels({ documentModel, shareModel });

  const deleteDocument = async (req, res) => {
    try {
      const id = readId(req, res);
      if (!id) return undefined;

      const { document, permission } = await permissionFor(models, req.user, id);
      if (!atLeast(permission, 'owner')) {
        return res.status(404).json({ error: 'Document not found' });
      }
      await document.destroy();
      return res.status(204).send();
    } catch (err) {
      console.error('[DOCUMENTS] delete failed:', err);
      return res.status(500).json({ error: 'Failed to delete document' });
    }
  };

  return { deleteDocument };
};

module.exports = { createDeleteDocumentHandler };
