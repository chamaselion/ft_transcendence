const { Op } = require('sequelize');
const sequelize = require('../../db');
const { validateUuid } = require('../auth/validation');
const { pick } = require('../../utils/pick');
const { sanitizePlainText } = require('./sanitize');
const { resolvePermission, atLeast } = require('./permissions');
const { parseListQuery, likePattern, paginationOf } = require('../../utils/listQuery');


const createDocumentsController = ({ documentModel, shareModel, userModel } = {}) => {
  const resolvedModel = documentModel || sequelize.models.document;
  const resolveShareModel = () => shareModel || sequelize.models.documentShare;
  const resolveUserModel = () => userModel || sequelize.models.user;

  const PUBLIC_ATTRS = ['id', 'title', 'content', 'createdAt', 'updatedAt'];
  const ADMIN_ATTRS = [...PUBLIC_ATTRS, 'ownerId'];


  const OWNER_ATTRS = ['id', 'login'];
  const SORTABLE = ['updatedAt', 'createdAt', 'title'];
  const SCOPES = ['own', 'shared', 'all'];

  const isAdmin = (user) => user.role === 'admin';
  const attrsFor = (user) => (isAdmin(user) ? ADMIN_ATTRS : PUBLIC_ATTRS);

  const isNonEmptyString = (value) =>
    typeof value === 'string' && value.trim().length > 0;


  const readId = (req, res) => {
    const result = validateUuid(req.params.id, 'document id');
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return null;
    }
    return result.value;
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

  const permissionFor = (user, id) =>
    resolvePermission(user, id, {
      documentModel: resolvedModel,
      shareModel: resolveShareModel(),
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
        document: present(document, req.user, 'owner'),
      });
    } catch (err) {
      console.error('[DOCUMENTS] create failed:', err);
      return res.status(500).json({ error: 'Failed to create document' });
    }
  };

  // GET /api/documents

  const list = async (req, res) => {
    try {
      const parsed = parseListQuery(req.query, {
        sortable: SORTABLE,
        defaultSort: 'updatedAt',
        defaultOrder: 'DESC',
      });
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      const { q, sort, order, limit, offset } = parsed.value;

      const scope = req.query.scope === undefined ? 'all' : String(req.query.scope).trim();
      if (!SCOPES.includes(scope)) {
        return res.status(400).json({ error: `scope must be one of: ${SCOPES.join(', ')}` });
      }


      const shares = isAdmin(req.user)
        ? []
        : await resolveShareModel().findAll({
            where: { userId: req.user.id },
            attributes: ['documentId', 'permission'],
          });
      const sharedPermissions = new Map(
        shares.map((share) => [String(share.documentId).toLowerCase(), share.permission]),
      );

      const ownClause = { ownerId: req.user.id };
      const sharedClause = { id: { [Op.in]: [...sharedPermissions.keys()] } };
      const visibility = {
        own: ownClause,
        shared: sharedClause,
        all: isAdmin(req.user) ? null : { [Op.or]: [ownClause, sharedClause] },
      }[scope];

      const search = q
        ? {
            [Op.or]: [
              { title: { [Op.iLike]: likePattern(q) } },
              { content: { [Op.iLike]: likePattern(q) } },
            ],
          }
        : null;

      const clauses = [visibility, search].filter(Boolean);

      const { rows: documents, count: total } = await resolvedModel.findAndCountAll({
        where: clauses.length ? { [Op.and]: clauses } : undefined,

        attributes: ADMIN_ATTRS,

        include: isAdmin(req.user)
          ? []
          : [{ model: resolveUserModel(), as: 'owner', attributes: OWNER_ATTRS }],
        order: [[sort, order]],
        limit,
        offset,
      });

      const permissionOf = (document) => {
        if (isAdmin(req.user)) return 'owner';
        if (String(document.ownerId).toLowerCase() === String(req.user.id).toLowerCase()) {
          return 'owner';
        }
        return sharedPermissions.get(String(document.id).toLowerCase()) || 'viewer';
      };

      return res.json({
        documents: documents.map((document) =>
          present(document, req.user, permissionOf(document), document.owner)),
        pagination: paginationOf({ total, limit, offset }),
      });
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

      const { document, permission } = await permissionFor(req.user, id);
      if (!atLeast(permission, 'viewer')) {
        return res.status(404).json({ error: 'Document not found' });
      }


      const owner = permission === 'owner'
        ? null
        : await resolveUserModel().findByPk(document.ownerId, { attributes: OWNER_ATTRS });

      return res.json({ document: present(document, req.user, permission, owner) });
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


      const sanitizedTitle = title !== undefined ? sanitizePlainText(title.trim()) : undefined;
      const sanitizedContent = content !== undefined ? sanitizePlainText(content) : undefined;
      if (sanitizedTitle !== undefined && !isNonEmptyString(sanitizedTitle)) {
        return res.status(400).json({ error: 'title must be a non-empty string' });
      }


      const { document, permission } = await permissionFor(req.user, id);
      if (!atLeast(permission, 'editor')) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (sanitizedTitle !== undefined) document.title = sanitizedTitle;
      if (sanitizedContent !== undefined) document.content = sanitizedContent;
      await document.save();

      return res.json({ document: present(document, req.user, permission) });
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


      const { document, permission } = await permissionFor(req.user, id);
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

  return { create, list, get, update, remove };
};

module.exports = { createDocumentsController };
