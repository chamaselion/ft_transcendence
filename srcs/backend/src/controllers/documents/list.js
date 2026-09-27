const { Op } = require('sequelize');
const { parseListQuery, likePattern, paginationOf } = require('../../utils/listQuery');
const {
  ADMIN_ATTRS,
  OWNER_ATTRS,
  isAdmin,
  resolveModels,
  present,
} = require('./helpers');

const SORTABLE = ['updatedAt', 'createdAt', 'title'];
const SCOPES = ['own', 'shared', 'all'];

// GET /api/documents
const createListDocumentsHandler = ({ documentModel, shareModel, userModel } = {}) => {
  const models = resolveModels({ documentModel, shareModel, userModel });

  const listDocuments = async (req, res) => {
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
        : await models.shares().findAll({
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

      const { rows: documents, count: total } = await models.documents().findAndCountAll({
        where: clauses.length ? { [Op.and]: clauses } : undefined,
        attributes: ADMIN_ATTRS,
        include: isAdmin(req.user)
          ? []
          : [{ model: models.users(), as: 'owner', attributes: OWNER_ATTRS }],
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

  return { listDocuments };
};

module.exports = { createListDocumentsHandler };
