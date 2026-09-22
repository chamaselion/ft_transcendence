const jwt = require('jsonwebtoken');
const { requireEnv } = require('../../config');
const sequelize = require('../../db');
const { ensureSession, getTokenFromCookie, isSessionActive } = require('./helpers');

const createMeHandler = ({ userModel, tokenLib = jwt, secret = requireEnv('JWT_SECRET') } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const me = async (req, res) => {
    try {
      console.log(`[AUTH] GET /me from ${req.ip}`, { token: getTokenFromCookie(req) ? 'present' : 'missing' });
      const token = getTokenFromCookie(req);
      if (!token) return res.status(401).json({ loggedIn: false });

      const payload = tokenLib.verify(token, secret);
      if (!(await isSessionActive(token))) {
        return res.status(401).json({ loggedIn: false });
      }

      const user = await resolvedUserModel.findByPk(payload.id, {
        attributes: ['id', 'login', 'email', 'role'],
      });

      if (!user) return res.status(401).json({ loggedIn: false });
      await ensureSession({ token, user });
      return res.json({ loggedIn: true, user });
    } catch (err) {
      return res.status(401).json({ loggedIn: false });
    }
  };

  return { me };
};

module.exports = { createMeHandler };