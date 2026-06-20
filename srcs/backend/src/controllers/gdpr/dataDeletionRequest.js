const jwt = require('jsonwebtoken');
const { requireEnv } = require('../../config');
const sequelize = require('../../db');
const { ensureSession, getTokenFromCookie, isSessionActive } = require('../auth/helpers');
const { oneTimeCodeService: defaultOneTimeCodeService } = require('../auth/oneTimeCodeToolkit');
const { recordGdprAuditEvent } = require('./audit');

const createDataDeletionRequestHandler = ({ userModel, tokenLib = jwt, secret = requireEnv('JWT_SECRET'), oneTimeCodeService = defaultOneTimeCodeService } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const dataDeletionRequest = async (req, res) => {
    try {
      console.log(`[AUTH] POST /me/data-deletion/request from ${req.ip}`, { token: getTokenFromCookie(req) ? 'present' : 'missing' });
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

      const reference = `deletion-${user.id}-${Date.now()}`;
      const challenge = await oneTimeCodeService.issueChallenge({
        purpose: 'data-deletion',
        recipient: user.email,
        subject: 'Confirm your data deletion request',
        payload: {
          userId: user.id,
          reference,
        },
        textBuilder: ({ code, expiresInMinutes, attemptsRemaining, purposeLabel }) => ([
          `Your ${purposeLabel} code is ${code}.`,
          `It expires in ${expiresInMinutes} minute(s).`,
          `You have ${attemptsRemaining} attempt(s) to enter it correctly.`,
          'If you did not request deletion of your data, you can ignore this message.',
        ].join(' ')),
      });

      void recordGdprAuditEvent({
        userId: user.id,
        actionType: 'data_deletion',
        status: 'challenge_issued',
        reference,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          endpoint: '/me/data-deletion/request',
          challengeId: challenge.challengeId,
          expiresAt: challenge.expiresAt,
        },
      });

      return res.status(202).json({
        deletionRequested: true,
        deletionConfirmationRequired: true,
        confirmationId: challenge.challengeId,
        reference,
        email: user.email,
        codeSent: true,
        attemptsRemaining: challenge.attemptsRemaining,
        codeLength: challenge.codeLength,
        expiresAt: challenge.expiresAt,
        debugCode: challenge.debugCode,
        message: 'A confirmation code has been sent. Confirm it to permanently delete your data.',
      });
    } catch (err) {
      console.error(`[AUTH] Data deletion request error: ${err.message}`);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  return { dataDeletionRequest };
};

module.exports = { createDataDeletionRequestHandler };