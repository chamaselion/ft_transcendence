const sequelize = require('../../db');
const { validateUuid } = require('../auth/validation');
const { pick } = require('../../utils/pick');
const { stripTags } = require('./sanitize');
const { resolvePermission } = require('./permissions');

const PUBLIC_ATTRS = ['id', 'title', 'content', 'createdAt', 'updatedAt'];
const ADMIN_ATTRS = [...PUBLIC_ATTRS, 'ownerId'];
const OWNER_ATTRS = ['id', 'login'];

const isAdmin = (user) => user.role === 'admin';
const attrsFor = (user) => (isAdmin(user) ? ADMIN_ATTRS : PUBLIC_ATTRS);

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

const resolveModels = ({ documentModel, shareModel, userModel } = {}) => ({
  documents: () => documentModel || sequelize.models.document,
  shares: () => shareModel || sequelize.models.documentShare,
  users: () => userModel || sequelize.models.user,
});

const readId = (req, res) => {
  const result = validateUuid(req.params.id, 'document id');
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return null;
  }
  return result.value;
};

const sanitizeContent = (content) => {
  if (typeof content !== 'string') return content;
  try {
    const parsed = JSON.parse(content);
    // Block documents are stored as a JSON array; sanitize each block's text
    // field individually so the HTML sanitizer never runs over serialized JSON.
    if (!Array.isArray(parsed)) return stripTags(content);
    return JSON.stringify(
      parsed.map((block) =>
        block && typeof block === 'object'
          ? { ...block, text: typeof block.text === 'string' ? stripTags(block.text) : block.text }
          : block,
      ),
    );
  } catch {
    // Legacy plain-text content.
    return stripTags(content);
  }
};

const readDocumentFields = ({ title, content }) => {
  if (title !== undefined && !isNonEmptyString(title)) {
    return { ok: false, error: 'title must be a non-empty string' };
  }
  if (content !== undefined && typeof content !== 'string') {
    return { ok: false, error: 'content must be a string' };
  }

  const sanitizedTitle = title !== undefined ? stripTags(title.trim()) : undefined;
  const sanitizedContent = content !== undefined ? sanitizeContent(content) : undefined;
  if (sanitizedTitle !== undefined && !isNonEmptyString(sanitizedTitle)) {
    return { ok: false, error: 'title must be a non-empty string' };
  }

  return { ok: true, value: { title: sanitizedTitle, content: sanitizedContent } };
};

const present = (document, user, permission, owner) => {
  const presented = {
    ...pick(document, attrsFor(user)),
    permission,
  };

  if (permission !== 'owner' && owner) {
    presented.owner = { id: owner.id, login: owner.login };
  }
  return presented;
};

const permissionFor = (models, user, id) =>
  resolvePermission(user, id, {
    documentModel: models.documents(),
    shareModel: models.shares(),
  });

module.exports = {
  PUBLIC_ATTRS,
  ADMIN_ATTRS,
  OWNER_ATTRS,
  isAdmin,
  resolveModels,
  readId,
  readDocumentFields,
  present,
  permissionFor,
};
