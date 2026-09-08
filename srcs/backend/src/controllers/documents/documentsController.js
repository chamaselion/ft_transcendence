const { Op } = require('sequelize');
const sequelize = require('../../db');
const { validateUuid } = require('../auth/validation');
const { pick } = require('../../utils/pick');
const { sanitizePlainText } = require('./sanitize');
const { resolvePermission, atLeast } = require('./permissions');

// CRUD for the generic collaborative document.
//
// Access comes from three sources, all resolved by ./permissions:
//   - ownership (document.ownerId)      -> 'owner'
//   - a documentShare row               -> 'editor' or 'viewer'
//   - the admin role                    -> 'owner' on every document
// Admin responses additionally carry `ownerId` so an admin can tell whose
// document they are looking at. Together with the per-level action gating
// below (viewer reads, editor writes, only the owner deletes) that is the
// "different views and actions depending on role" half of the permissions
// module.
const createDocumentsController = ({ documentModel, shareModel, userModel } = {}) => {
  const resolvedModel = documentModel || sequelize.models.document;
  const resolveShareModel = () => shareModel || sequelize.models.documentShare;
  const resolveUserModel = () => userModel || sequelize.models.user;

  const PUBLIC_ATTRS = ['id', 'title', 'content', 'createdAt', 'updatedAt'];
  const ADMIN_ATTRS = [...PUBLIC_ATTRS, 'ownerId'];

  // Shown on documents the caller does *not* own, so they can see who shared
  // it with them. The login, not just the id: GET /api/users is admin-only, so
  // a regular user has no way to resolve an owner id into a name - handing
  // back a bare uuid would be unusable, which is the same reason shares are
  // addressed by email.
  const OWNER_ATTRS = ['id', 'login'];

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

  // Every document that leaves this controller carries the caller's own
  // permission on it, so the client can render a viewer read-only instead of
  // asking again per document.
  //
  // `owner` is attached only where it says something: on a document the caller
  // owns, the owner is the caller. Admins already get `ownerId` instead, and
  // resolve to 'owner' everywhere, so they never take this branch.
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

  // Resolve once, with the models this controller was built with.
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
        document: present(document, req.user, 'owner'),
      });
    } catch (err) {
      console.error('[DOCUMENTS] create failed:', err);
      return res.status(500).json({ error: 'Failed to create document' });
    }
  };

  // GET /api/documents
  // Own documents plus everything shared with the caller. Deliberately two
  // queries rather than a join: the shared ids are needed as a lookup table
  // anyway, to label each row with the caller's permission.
  const list = async (req, res) => {
    try {
      // Admins resolve to 'owner' on every document, so their own share rows
      // would never be consulted - skip the query entirely for them.
      const shares = isAdmin(req.user)
        ? []
        : await resolveShareModel().findAll({
            where: { userId: req.user.id },
            attributes: ['documentId', 'permission'],
          });
      const sharedPermissions = new Map(
        shares.map((share) => [String(share.documentId).toLowerCase(), share.permission]),
      );

      const documents = await resolvedModel.findAll({
        where: isAdmin(req.user)
          ? undefined
          : {
              [Op.or]: [
                { ownerId: req.user.id },
                { id: { [Op.in]: [...sharedPermissions.keys()] } },
              ],
            },
        // Always select ownerId internally - it decides owner vs. share below -
        // and let present() strip it again for non-admins.
        attributes: ADMIN_ATTRS,
        // One join instead of a lookup per shared row. Admins do not need it:
        // they get ownerId directly.
        include: isAdmin(req.user)
          ? []
          : [{ model: resolveUserModel(), as: 'owner', attributes: OWNER_ATTRS }],
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

  // GET /api/documents/:id
  const get = async (req, res) => {
    try {
      const id = readId(req, res);
      if (!id) return undefined;

      const { document, permission } = await permissionFor(req.user, id);
      if (!atLeast(permission, 'viewer')) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Only a shared document needs this extra lookup; on your own documents
      // it would answer a question nobody asked.
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

      // See create(): re-check non-emptiness after sanitizing, since
      // markup-only input can collapse to "" once stripped.
      const sanitizedTitle = title !== undefined ? sanitizePlainText(title.trim()) : undefined;
      const sanitizedContent = content !== undefined ? sanitizePlainText(content) : undefined;
      if (sanitizedTitle !== undefined && !isNonEmptyString(sanitizedTitle)) {
        return res.status(400).json({ error: 'title must be a non-empty string' });
      }

      // Writing needs 'editor'; a viewer gets the same 404 as a stranger so the
      // response never confirms that the document exists.
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

      // Deleting is owner-only on purpose: an editor may change the contents
      // but must not be able to destroy the document and every share on it.
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
