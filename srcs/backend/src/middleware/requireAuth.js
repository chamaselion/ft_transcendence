const jwt = require('jsonwebtoken');
const { requireEnv } = require('../config');
const sequelize = require('../db');
const {
  ensureSession,
  getTokenFromCookie,
  isSessionActive,
} = require('../controllers/auth/helpers');

// Reusable auth guard. Mirrors the token check used in the auth
// controllers (cookie JWT + active session), but exposes it as an
// Express middleware so protected routes don't repeat the logic.
// On success it attaches the authenticated user to `req.user`.
const createRequireAuth = ({
  userModel,
  tokenLib = jwt,
  secret = requireEnv('JWT_SECRET'),
} = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const requireAuth = async (req, res, next) => {
    try {
      const token = getTokenFromCookie(req);
      if (!token) return res.status(401).json({ error: 'Not authenticated' });

      const payload = tokenLib.verify(token, secret);
      if (!(await isSessionActive(token))) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await resolvedUserModel.findByPk(payload.id, {
        attributes: ['id', 'login', 'email'],
      });
      if (!user) return res.status(401).json({ error: 'Not authenticated' });

      await ensureSession({ token, user });
      req.user = user;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
  };

  return { requireAuth };
};

module.exports = { createRequireAuth };
