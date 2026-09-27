const { resolveModels, readDocumentFields, present } = require('./helpers');

// POST /api/documents
const createCreateDocumentHandler = ({ documentModel } = {}) => {
  const models = resolveModels({ documentModel });

  const createDocument = async (req, res) => {
    try {
      const fields = readDocumentFields(req.body || {});
      if (!fields.ok) return res.status(400).json({ error: fields.error });

      const document = await models.documents().create({
        title: fields.value.title,
        content: fields.value.content,
        ownerId: req.user.id,
      });

      return res.status(201).json({
        document: present(document, req.user, 'owner'),
      });
    } catch (err) {
      console.error('[DOCUMENTS] create failed:', err);
      return res.status(500).json({ error: 'Failed to create document' });
    }
  };

  return { createDocument };
};

module.exports = { createCreateDocumentHandler };
