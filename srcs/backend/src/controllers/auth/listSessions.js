const jwt = require('jsonwebtoken');
const { requireEnv } = require('../../config');
const sequelize = require('../../db');
const { ensureSession, getTokenFromCookie, isSessionActive, listActiveSessionsForUser, purgeExpiredSessions } = require('./helpers');

const createListSessionsHandler = ({ userModel, tokenLib = jwt, secret = requireEnv('JWT_SECRET') } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const listSessions = async (req, res) => {
    try {
      const token = getTokenFromCookie(req);
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const payload = tokenLib.verify(token, secret);
      if (!(await isSessionActive(token))) return res.status(401).json({ error: 'Unauthorized' });

      const requester = await resolvedUserModel.findByPk(payload.id, {
        attributes: ['id', 'login', 'email'],
      });

      if (!requester) return res.status(401).json({ error: 'Unauthorized' });

      await ensureSession({ token, user: requester });
      await purgeExpiredSessions();

      const userSessions = await listActiveSessionsForUser(requester.id);

      return res.json({
        count: userSessions.length,
        sessions: userSessions,
      });
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };

  return { listSessions };
};

module.exports = { createListSessionsHandler };