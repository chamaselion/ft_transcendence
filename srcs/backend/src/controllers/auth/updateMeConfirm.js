const jwt = require('jsonwebtoken');
const sequelize = require('../../db');
const { requireEnv } = require('../../config');
const {
  ensureSession,
  getTokenFromCookie,
  isSessionActive,
  removeSessionByToken,
  setAuthCookie,
} = require('./helpers');
const { oneTimeCodeService: defaultOneTimeCodeService } = require('./oneTimeCodeToolkit');
const {
  normalizeText,
  validateChallengeId,
  validateEmail,
  validateOtpCode,
  validateOptionalEmail,
  validateOptionalLogin,
} = require('./validation');

const JWT_EXPIRES_IN = requireEnv('JWT_EXPIRES_IN');

const createUpdateMeConfirmHandler = ({
  userModel,
  tokenLib = jwt,
  secret = requireEnv('JWT_SECRET'),
  oneTimeCodeService = defaultOneTimeCodeService,
} = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const loadUser = async (userId) => resolvedUserModel.findByPk(userId, {
    attributes: ['id', 'login', 'email'],
  });

  const updateMeConfirm = async (req, res) => {
    try {
      const token = getTokenFromCookie(req);
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      let payload;
      try {
        payload = tokenLib.verify(token, secret);
      } catch {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!(await isSessionActive(token))) return res.status(401).json({ error: 'Unauthorized' });

      const confirmationIdValidation = validateChallengeId(req.body?.confirmationId, 'confirmationId');
      if (!confirmationIdValidation.ok) return res.status(400).json({ error: confirmationIdValidation.error });

      const emailValidation = validateEmail(req.body?.email);
      if (!emailValidation.ok) return res.status(400).json({ error: emailValidation.error });

      const codeValidation = validateOtpCode(req.body?.code);
      if (!codeValidation.ok) return res.status(400).json({ error: codeValidation.error });

      const confirmationId = confirmationIdValidation.value;
      const email = emailValidation.value;
      const code = codeValidation.value;

      const verification = await oneTimeCodeService.verifyChallenge({
        challengeId: confirmationId,
        recipient: email,
        purpose: 'profile update',
        code,
      });

      if (!verification.ok) {
        return res.status(verification.statusCode || 400).json({
          error: verification.error,
          attemptsRemaining: verification.attemptsRemaining,
        });
      }

      if (String(verification.payload.userId) !== String(payload.id)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await loadUser(payload.id);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const requestedChanges = verification.payload.changes || {};
      const requestedLoginValidation = validateOptionalLogin(requestedChanges.login);
      if (!requestedLoginValidation.ok) return res.status(400).json({ error: requestedLoginValidation.error });

      const requestedEmailValidation = validateOptionalEmail(requestedChanges.email);
      if (!requestedEmailValidation.ok) return res.status(400).json({ error: requestedEmailValidation.error });

      const requestedLogin = normalizeText(requestedLoginValidation.value);
      const requestedEmail = normalizeText(requestedEmailValidation.value);

      const updatePayload = {};

      if (requestedLogin && requestedLogin !== user.login) {
        const existingLogin = await resolvedUserModel.findOne({ where: { login: requestedLogin } });
        if (existingLogin && existingLogin.id !== user.id) {
          return res.status(409).json({ error: 'Login already in use' });
        }

        updatePayload.login = requestedLogin;
      }

      if (requestedEmail && requestedEmail !== user.email) {
        const existingEmail = await resolvedUserModel.findOne({ where: { email: requestedEmail } });
        if (existingEmail && existingEmail.id !== user.id) {
          return res.status(409).json({ error: 'Email already in use' });
        }

        updatePayload.email = requestedEmail;
      }

      if (!Object.keys(updatePayload).length) {
        return res.status(400).json({ error: 'No changes requested' });
      }

      await user.update(updatePayload);

      const updatedUser = await loadUser(user.id);
      const nextToken = tokenLib.sign({ id: updatedUser.id, email: updatedUser.email }, secret, {
        expiresIn: JWT_EXPIRES_IN,
      });

      await removeSessionByToken(token);
      setAuthCookie(res, nextToken);
      await ensureSession({ token: nextToken, user: updatedUser });

      return res.json({
        updated: true,
        loggedIn: true,
        user: updatedUser,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  return { updateMeConfirm };
};

module.exports = { createUpdateMeConfirmHandler };