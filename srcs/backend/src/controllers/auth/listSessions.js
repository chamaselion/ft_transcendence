const jwt = require('jsonwebtoken');
const { requireEnv } = require('../../config');
const sequelize = require('../../db');
const { activeSessions, ensureSession, getTokenFromCookie, isSessionActive, purgeExpiredSessions } = require('./helpers');

const createListSessionsHandler = ({ userModel, tokenLib = jwt, secret = requireEnv('JWT_SECRET') } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const listSessions = async (req, res) => {
    try {
      const token = getTokenFromCookie(req);
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const payload = tokenLib.verify(token, secret);
      if (!isSessionActive(token)) return res.status(401).json({ error: 'Unauthorized' });

      const requester = await resolvedUserModel.findByPk(payload.id, {
        attributes: ['id', 'login', 'email'],
      });

      if (!requester) return res.status(401).json({ error: 'Unauthorized' });

      ensureSession({ token, user: requester });
      purgeExpiredSessions();

      return res.json({
        count: activeSessions.size,
        sessions: [...activeSessions.values()],
      });
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };

  return { listSessions };
};

module.exports = { createListSessionsHandler };