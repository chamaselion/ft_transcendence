const { atLeast } = require('./permissions');
const {
  OWNER_ATTRS,
  resolveModels,
  readId,
  present,
  permissionFor,
} = require('./helpers');

// GET /api/documents/:id
const createGetDocumentHandler = ({ documentModel, shareModel, userModel } = {}) => {
  const models = resolveModels({ documentModel, shareModel, userModel });

  const getDocument = async (req, res) => {
    try {
      const id = readId(req, res);
      if (!id) return undefined;

      const { document, permission } = await permissionFor(models, req.user, id);
      if (!atLeast(permission, 'viewer')) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const owner = permission === 'owner'
        ? null
        : await models.users().findByPk(document.ownerId, { attributes: OWNER_ATTRS });

      return res.json({ document: present(document, req.user, permission, owner) });
    } catch (err) {
      console.error('[DOCUMENTS] get failed:', err);
      return res.status(500).json({ error: 'Failed to fetch document' });
    }
  };

  return { getDocument };
};

module.exports = { createGetDocumentHandler };
