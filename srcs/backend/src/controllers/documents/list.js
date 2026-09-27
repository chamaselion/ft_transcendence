const { Op } = require('sequelize');
const {
  ADMIN_ATTRS,
  OWNER_ATTRS,
  isAdmin,
  resolveModels,
  present,
} = require('./helpers');

// GET /api/documents
const createListDocumentsHandler = ({ documentModel, shareModel, userModel } = {}) => {
  const models = resolveModels({ documentModel, shareModel, userModel });

  const listDocuments = async (req, res) => {
    try {
      const shares = isAdmin(req.user)
        ? []
        : await models.shares().findAll({
            where: { userId: req.user.id },
            attributes: ['documentId', 'permission'],
          });
      const sharedPermissions = new Map(
        shares.map((share) => [String(share.documentId).toLowerCase(), share.permission]),
      );

      const documents = await models.documents().findAll({
        where: isAdmin(req.user)
          ? undefined
          : {
              [Op.or]: [
                { ownerId: req.user.id },
                { id: { [Op.in]: [...sharedPermissions.keys()] } },
              ],
            },
        attributes: ADMIN_ATTRS,
        include: isAdmin(req.user)
          ? []
          : [{ model: models.users(), as: 'owner', attributes: OWNER_ATTRS }],
        order: [['updatedAt', 'DESC']],
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
      });
    } catch (err) {
      console.error('[DOCUMENTS] list failed:', err);
      return res.status(500).json({ error: 'Failed to list documents' });
    }
  };

  return { listDocuments };
};

module.exports = { createListDocumentsHandler };
