const jwt = require('jsonwebtoken');
const { requireEnv } = require('../../config');
const sequelize = require('../../db');
const { ensureSession, getTokenFromCookie, isSessionActive } = require('../auth/helpers');
const { recordGdprAuditEvent } = require('./audit');
const { createGdprNotificationService } = require('../../services/gdprNotificationService');

const gdprNotificationService = createGdprNotificationService();

const createDataRequestHandler = ({ userModel, tokenLib = jwt, secret = requireEnv('JWT_SECRET') } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const dataRequest = async (req, res) => {
    try {
      console.log(`[AUTH] POST /me/data-request from ${req.ip}`, { token: getTokenFromCookie(req) ? 'present' : 'missing' });
      const token = getTokenFromCookie(req);
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const payload = tokenLib.verify(token, secret);
      if (!isSessionActive(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await resolvedUserModel.findByPk(payload.id, {
        attributes: ['id', 'login', 'email'],
      });

      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      ensureSession({ token, user });

      const reference = `request-${user.id}-${Date.now()}`;

      void recordGdprAuditEvent({
        userId: user.id,
        actionType: 'data_request',
        status: 'accepted',
        reference,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          endpoint: '/me/data-request',
        },
      });

      await gdprNotificationService.sendDataRequestConfirmation({
        to: user.email,
        reference,
      });

      return res.status(202).json({
        requestAccepted: true,
        reference,
        emailSent: true,
        message: 'Your data request has been received. A confirmation email has been sent.',
      });
    } catch (err) {
      console.error(`[AUTH] Data request error: ${err.message}`);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  return { dataRequest };
};

module.exports = { createDataRequestHandler };