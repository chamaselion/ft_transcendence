const sequelize = require('../../db');
const { sanitizePlainText } = require('./sanitize');

// CRUD for the generic collaborative document.
// All handlers are owner-scoped: a user only sees and edits their own
// documents. Sharing / roles come later with the permissions module.
const createDocumentsController = ({ documentModel } = {}) => {
  const resolvedModel = documentModel || sequelize.models.document;

  const PUBLIC_ATTRS = ['id', 'title', 'content', 'createdAt', 'updatedAt'];

  const isNonEmptyString = (value) =>
    typeof value === 'string' && value.trim().length > 0;

  // POST /api/documents
  const create = async (req, res) => {
    try {
      const { title, content } = req.body || {};

      if (title !== undefined && !isNonEmptyString(title)) {
        return res.status(400).json({ error: 'title must be a non-empty string' });
      }
      if (content !== undefined && typeof content !== 'string') {
        return res.status(400).json({ error: 'content must be a string' });
      }

      // Sanitize before re-checking non-emptiness: a title/content that is
      // only markup (e.g. a bare "<script>...</script>") passes the raw
      // non-empty check above but can collapse to "" once stripped, so we
      // validate again on the sanitized value rather than store blanks.
      const sanitizedTitle = title !== undefined ? sanitizePlainText(title.trim()) : undefined;
      const sanitizedContent = content !== undefined ? sanitizePlainText(content) : undefined;
      if (sanitizedTitle !== undefined && !isNonEmptyString(sanitizedTitle)) {
        return res.status(400).json({ error: 'title must be a non-empty string' });
      }

      const document = await resolvedModel.create({
        title: sanitizedTitle,
        content: sanitizedContent,
        ownerId: req.user.id,
      });

      return res.status(201).json({
        document: pick(document, PUBLIC_ATTRS),
      });
    } catch (err) {
      console.error('[DOCUMENTS] create failed:', err);
      return res.status(500).json({ error: 'Failed to create document' });
    }
  };

  // GET /api/documents
  const list = async (req, res) => {
    try {
      const documents = await resolvedModel.findAll({
        where: { ownerId: req.user.id },
        attributes: PUBLIC_ATTRS,
        order: [['updatedAt', 'DESC']],
      });
      return res.json({ documents });
    } catch (err) {
      console.error('[DOCUMENTS] list failed:', err);
      return res.status(500).json({ error: 'Failed to list documents' });
    }
  };

  // GET /api/documents/:id
  const get = async (req, res) => {
    try {
      const document = await findOwned(req.params.id, req.user.id);
      if (!document) return res.status(404).json({ error: 'Document not found' });
      return res.json({ document: pick(document, PUBLIC_ATTRS) });
    } catch (err) {
      console.error('[DOCUMENTS] get failed:', err);
      return res.status(500).json({ error: 'Failed to fetch document' });
    }
  };

  // PATCH /api/documents/:id
  const update = async (req, res) => {
    try {
      const { title, content } = req.body || {};

      if (title === undefined && content === undefined) {
        return res.status(400).json({ error: 'Nothing to update' });
      }
      if (title !== undefined && !isNonEmptyString(title)) {
        return res.status(400).json({ error: 'title must be a non-empty string' });
      }
      if (content !== undefined && typeof content !== 'string') {
        return res.status(400).json({ error: 'content must be a string' });
      }

      // See create(): re-check non-emptiness after sanitizing, since
      // markup-only input can collapse to "" once stripped.
      const sanitizedTitle = title !== undefined ? sanitizePlainText(title.trim()) : undefined;
      const sanitizedContent = content !== undefined ? sanitizePlainText(content) : undefined;
      if (sanitizedTitle !== undefined && !isNonEmptyString(sanitizedTitle)) {
        return res.status(400).json({ error: 'title must be a non-empty string' });
      }

      const document = await findOwned(req.params.id, req.user.id);
      if (!document) return res.status(404).json({ error: 'Document not found' });

      if (sanitizedTitle !== undefined) document.title = sanitizedTitle;
      if (sanitizedContent !== undefined) document.content = sanitizedContent;
      await document.save();

      return res.json({ document: pick(document, PUBLIC_ATTRS) });
    } catch (err) {
      console.error('[DOCUMENTS] update failed:', err);
      return res.status(500).json({ error: 'Failed to update document' });
    }
  };

  // DELETE /api/documents/:id
  const remove = async (req, res) => {
    try {
      const document = await findOwned(req.params.id, req.user.id);
      if (!document) return res.status(404).json({ error: 'Document not found' });
      await document.destroy();
      return res.status(204).send();
    } catch (err) {
      console.error('[DOCUMENTS] delete failed:', err);
      return res.status(500).json({ error: 'Failed to delete document' });
    }
  };

  const findOwned = (id, ownerId) =>
    resolvedModel.findOne({ where: { id, ownerId } });

  return { create, list, get, update, remove };
};

// Small helper: return a plain object with only the listed attributes.
const pick = (instance, attrs) => {
  const data = typeof instance.get === 'function' ? instance.get({ plain: true }) : instance;
  return attrs.reduce((acc, key) => {
    acc[key] = data[key];
    return acc;
  }, {});
};

module.exports = { createDocumentsController };
