const sequelize = require('../../db');
const { validateUuid } = require('../auth/validation');
const { pick } = require('../../utils/pick');
const { sanitizePlainText } = require('./sanitize');

// CRUD for the generic collaborative document.
//
// Regular users are owner-scoped: they only ever see and edit their own
// documents. Admins are the exception - they can list, read, edit and delete
// every document in the system, and their responses additionally carry
// `ownerId` so they can tell whose document they are looking at. That is the
// "different views and actions depending on role" half of the permissions
// module. Sharing between regular users still comes later.
const createDocumentsController = ({ documentModel } = {}) => {
  const resolvedModel = documentModel || sequelize.models.document;

  const PUBLIC_ATTRS = ['id', 'title', 'content', 'createdAt', 'updatedAt'];
  const ADMIN_ATTRS = [...PUBLIC_ATTRS, 'ownerId'];

  const isAdmin = (user) => user.role === 'admin';
  const attrsFor = (user) => (isAdmin(user) ? ADMIN_ATTRS : PUBLIC_ATTRS);

  const isNonEmptyString = (value) =>
    typeof value === 'string' && value.trim().length > 0;

  // `:id` is a UUID. Validating it here keeps a malformed id from reaching
  // Postgres, which rejects it as invalid uuid syntax and would turn a client
  // mistake into a 500.
  const readId = (req, res) => {
    const result = validateUuid(req.params.id, 'document id');
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return null;
    }
    return result.value;
  };

  // Admins reach every document, everyone else only their own. Both cases end
  // in the same 404 so a non-admin can't use the response to probe which
  // document ids exist.
  const findAccessible = (id, user) =>
    resolvedModel.findOne({
      where: isAdmin(user) ? { id } : { id, ownerId: user.id },
    });

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
        document: pick(document, attrsFor(req.user)),
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
        where: isAdmin(req.user) ? undefined : { ownerId: req.user.id },
        attributes: attrsFor(req.user),
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
      const id = readId(req, res);
      if (!id) return undefined;

      const document = await findAccessible(id, req.user);
      if (!document) return res.status(404).json({ error: 'Document not found' });
      return res.json({ document: pick(document, attrsFor(req.user)) });
    } catch (err) {
      console.error('[DOCUMENTS] get failed:', err);
      return res.status(500).json({ error: 'Failed to fetch document' });
    }
  };

  // PATCH /api/documents/:id
  const update = async (req, res) => {
    try {
      const id = readId(req, res);
      if (!id) return undefined;

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

      const document = await findAccessible(id, req.user);
      if (!document) return res.status(404).json({ error: 'Document not found' });

      if (sanitizedTitle !== undefined) document.title = sanitizedTitle;
      if (sanitizedContent !== undefined) document.content = sanitizedContent;
      await document.save();

      return res.json({ document: pick(document, attrsFor(req.user)) });
    } catch (err) {
      console.error('[DOCUMENTS] update failed:', err);
      return res.status(500).json({ error: 'Failed to update document' });
    }
  };

  // DELETE /api/documents/:id
  const remove = async (req, res) => {
    try {
      const id = readId(req, res);
      if (!id) return undefined;

      const document = await findAccessible(id, req.user);
      if (!document) return res.status(404).json({ error: 'Document not found' });
      await document.destroy();
      return res.status(204).send();
    } catch (err) {
      console.error('[DOCUMENTS] delete failed:', err);
      return res.status(500).json({ error: 'Failed to delete document' });
    }
  };

  return { create, list, get, update, remove };
};

module.exports = { createDocumentsController };
