const { Op } = require('sequelize');
const sequelize = require('../../db');
const { purgeUserData } = require('../auth/helpers');
const { validateEmail, validateLogin, validateUuid } = require('../auth/validation');
const { pick } = require('../../utils/pick');
const { parseListQuery, likePattern, paginationOf } = require('../../utils/listQuery');
const { deleteUserIcon, iconKey } = require('../../services/userIconService');


const ALLOWED_ROLES = ['admin', 'user'];
const PUBLIC_ATTRS = ['id', 'login', 'email', 'role', 'createdAt', 'updatedAt'];
const SORTABLE = ['login', 'email', 'createdAt'];

const createUsersController = ({ userModel } = {}) => {
  const resolveUsers = () => userModel || sequelize.models.user;

  const readId = (req, res) => {
    const result = validateUuid(req.params.id);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return null;
    }
    return result.value;
  };


  const isSelf = (req, id) =>
    String(req.user.id).toLowerCase() === String(id).toLowerCase();

  // GET /api/users

  const list = async (req, res) => {
    try {
      const parsed = parseListQuery(req.query, {
        sortable: SORTABLE,
        defaultSort: 'createdAt',
        defaultOrder: 'ASC',
      });
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      const { q, sort, order, limit, offset } = parsed.value;

      const role = req.query.role === undefined ? null : String(req.query.role).trim();
      if (role !== null && !ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(', ')}` });
      }

      const clauses = [];
      if (role) clauses.push({ role });
      if (q) {
        clauses.push({
          [Op.or]: [
            { login: { [Op.iLike]: likePattern(q) } },
            { email: { [Op.iLike]: likePattern(q) } },
          ],
        });
      }


      const { rows: users, count: total } = await resolveUsers().findAndCountAll({
        where: clauses.length ? { [Op.and]: clauses } : undefined,
        attributes: PUBLIC_ATTRS,
        order: [[sort, order]],
        limit,
        offset,
      });

      return res.json({ users, pagination: paginationOf({ total, limit, offset }) });
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

      await deleteUserIcon(iconKey(user.id));
      await purgeUserData(user.id, { userModel: users });

      return res.status(204).send();
    } catch (err) {
      console.error('[USERS] delete failed:', err);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  };

  return { list, get, update, remove };
};

module.exports = { createUsersController };
