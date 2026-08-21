const sequelize = require('../../db');
const { purgeSessionsForUser } = require('../auth/helpers');
const { validateEmail, validateLogin, validateUuid } = require('../auth/validation');
const { pick } = require('../../utils/pick');

// Admin-only CRUD on user accounts. Routes are gated by requireRole('admin')
// (see routes/users.js), so this controller assumes the caller is already an
// admin and only adds the two guards the role check itself can't express:
// an admin may not change their own role (update) and may not delete their
// own account (remove).
//
// Deliberate design decision: an admin *can* change another user's login or
// email without the one-time-code confirmation that the self-service
// PATCH /api/auth/me flow requires. Combined with the password reset flow
// that amounts to account takeover - it is accepted as inherent to the admin
// role, not an oversight. See docs/API-s/users-api.md.
const ALLOWED_ROLES = ['admin', 'user'];
const PUBLIC_ATTRS = ['id', 'login', 'email', 'role', 'createdAt', 'updatedAt'];

const createUsersController = ({ userModel } = {}) => {
  const resolveUsers = () => userModel || sequelize.models.user;

  // `:id` is a UUID. Validating it here keeps a malformed id from reaching
  // Postgres, which rejects it as invalid uuid syntax and would turn a client
  // mistake into a 500.
  const readId = (req, res) => {
    const result = validateUuid(req.params.id);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return null;
    }
    return result.value;
  };

  // Postgres compares uuid values case-insensitively, so a lowercase string
  // comparison would let an uppercased copy of your own id slip past the
  // self-guards below.
  const isSelf = (req, id) =>
    String(req.user.id).toLowerCase() === String(id).toLowerCase();

  // GET /api/users
  const list = async (req, res) => {
    try {
      const users = await resolveUsers().findAll({
        attributes: PUBLIC_ATTRS,
        order: [['createdAt', 'ASC']],
      });
      return res.json({ users });
    } catch (err) {
      console.error('[USERS] list failed:', err);
      return res.status(500).json({ error: 'Failed to list users' });
    }
  };

  // GET /api/users/:id
  const get = async (req, res) => {
    try {
      const id = readId(req, res);
      if (!id) return undefined;

      const user = await resolveUsers().findByPk(id, { attributes: PUBLIC_ATTRS });
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({ user });
    } catch (err) {
      console.error('[USERS] get failed:', err);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }
  };

  // PATCH /api/users/:id   { login?, email?, role? }
  const update = async (req, res) => {
    try {
      const id = readId(req, res);
      if (!id) return undefined;

      const { login, email, role } = req.body || {};

      if (login === undefined && email === undefined && role === undefined) {
        return res.status(400).json({ error: 'Nothing to update' });
      }

      let normalizedLogin;
      if (login !== undefined) {
        const result = validateLogin(login);
        if (!result.ok) return res.status(400).json({ error: result.error });
        normalizedLogin = result.value;
      }

      let normalizedEmail;
      if (email !== undefined) {
        const result = validateEmail(email);
        if (!result.ok) return res.status(400).json({ error: result.error });
        normalizedEmail = result.value;
      }

      if (role !== undefined) {
        if (!ALLOWED_ROLES.includes(role)) {
          return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(', ')}` });
        }

        // An admin never changes their own role, not even to the same value.
        // Self-demotion can leave the system without a single admin, and the
        // only way back is the ADMIN_EMAIL bootstrap plus a backend restart.
        // Role changes always go through a *different* admin.
        if (isSelf(req, id)) {
          return res.status(400).json({ error: 'You cannot change your own role' });
        }
      }

      const user = await resolveUsers().findByPk(id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (normalizedLogin !== undefined) user.login = normalizedLogin;
      if (normalizedEmail !== undefined) user.email = normalizedEmail;
      if (role !== undefined) user.role = role;

      try {
        await user.save();
      } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
          return res.status(409).json({ error: 'Login or email already in use' });
        }
        throw err;
      }

      return res.json({ user: pick(user, PUBLIC_ATTRS) });
    } catch (err) {
      console.error('[USERS] update failed:', err);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  };

  // DELETE /api/users/:id
  const remove = async (req, res) => {
    try {
      const id = readId(req, res);
      if (!id) return undefined;

      if (isSelf(req, id)) {
        return res.status(400).json({ error: 'Use the account deletion flow to delete your own account' });
      }

      const users = resolveUsers();
      const user = await users.findByPk(id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Mirror the GDPR deletion flow in controllers/gdpr/dataDeletionConfirm.js.
      // authSessions and documents are removed by the FK cascade declared in
      // db/associations.js, but the two GDPR tables have no association and
      // would be left behind as orphaned rows about a user who no longer
      // exists - exactly what the GDPR module is supposed to prevent.
      const { gdprExportQuota, gdprAuditEvent } = sequelize.models;

      await sequelize.transaction(async (dbTransaction) => {
        if (gdprExportQuota) {
          await gdprExportQuota.destroy({
            where: { userId: user.id },
            transaction: dbTransaction,
          });
        }

        if (gdprAuditEvent) {
          await gdprAuditEvent.destroy({
            where: { userId: user.id },
            transaction: dbTransaction,
          });
        }

        await users.destroy({
          where: { id: user.id },
          transaction: dbTransaction,
        });
      });

      // Also drop the deleted user's sessions from the in-memory session cache,
      // so they aren't flushed back into the DB on shutdown.
      await purgeSessionsForUser(user.id);

      return res.status(204).send();
    } catch (err) {
      console.error('[USERS] delete failed:', err);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  };

  return { list, get, update, remove };
};

module.exports = { createUsersController };
