const jwt = require('jsonwebtoken');
const { requireEnv } = require('../../config');
const sequelize = require('../../db');
const {
  ensureSession,
  getTokenFromCookie,
  isSessionActive,
} = require('./helpers');
const { recordGdprAuditEvent } = require('../gdpr/audit');

const createDevFillDataHandler = ({
  userModel,
  tokenLib = jwt,
  secret = requireEnv('JWT_SECRET'),
} = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const fillData = async (req, res) => {
    try {
      const token = getTokenFromCookie(req);
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const payload = tokenLib.verify(token, secret);
      if (!(await isSessionActive(token))) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const requester = await resolvedUserModel.findByPk(payload.id, {
        attributes: ['id', 'login', 'email'],
      });

      if (!requester) return res.status(401).json({ error: 'Unauthorized' });

      await ensureSession({ token, user: requester });

      // Keep this endpoint user-domain only: no asset/transaction test fixtures.
      const reference = `dev-fill-${requester.id}-${Date.now()}`;
      await recordGdprAuditEvent({
        userId: requester.id,
        actionType: 'dev_fill_data',
        status: 'completed',
        reference,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          endpoint: '/me/dev/fill-data',
          scope: 'user-only',
        },
      });

      return res.json({
        ok: true,
        message: 'User-only development data flow executed.',
        reference,
      });
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };

  return { fillData };
};

module.exports = { createDevFillDataHandler };
