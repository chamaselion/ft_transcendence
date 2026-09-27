const { atLeast } = require('./permissions');
const {
  resolveModels,
  readId,
  readDocumentFields,
  present,
  permissionFor,
} = require('./helpers');

// PATCH /api/documents/:id
const createUpdateDocumentHandler = ({ documentModel, shareModel } = {}) => {
  const models = resolveModels({ documentModel, shareModel });

  const updateDocument = async (req, res) => {
    try {
      const id = readId(req, res);
      if (!id) return undefined;

      const { title, content } = req.body || {};
      if (title === undefined && content === undefined) {
        return res.status(400).json({ error: 'Nothing to update' });
      }

      const fields = readDocumentFields({ title, content });
      if (!fields.ok) return res.status(400).json({ error: fields.error });

      const { document, permission } = await permissionFor(models, req.user, id);
      if (!atLeast(permission, 'editor')) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (fields.value.title !== undefined) document.title = fields.value.title;
      if (fields.value.content !== undefined) document.content = fields.value.content;
      await document.save();

      return res.json({ document: present(document, req.user, permission) });
    } catch (err) {
      console.error('[DOCUMENTS] update failed:', err);
      return res.status(500).json({ error: 'Failed to update document' });
    }
  };

  return { updateDocument };
};

module.exports = { createUpdateDocumentHandler };
