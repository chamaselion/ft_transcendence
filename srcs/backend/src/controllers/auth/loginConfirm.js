const jwt = require('jsonwebtoken');
const { requireEnv } = require('../../config');
const sequelize = require('../../db');
const { ensureSession, setAuthCookie } = require('./helpers');
const { oneTimeCodeService: defaultOneTimeCodeService } = require('./oneTimeCodeToolkit');
const { validateChallengeId, validateEmail, validateOtpCode } = require('./validation');

const JWT_EXPIRES_IN = requireEnv('JWT_EXPIRES_IN');

const createLoginConfirmHandler = ({
  userModel,
  oneTimeCodeService = defaultOneTimeCodeService,
  tokenLib = jwt,
  secret = requireEnv('JWT_SECRET'),
} = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const loginConfirm = async (req, res) => {
    try {
      const challengeIdValidation = validateChallengeId(req.body?.challengeId);
      if (!challengeIdValidation.ok) return res.status(400).json({ error: challengeIdValidation.error });

      const emailValidation = validateEmail(req.body?.email);
      if (!emailValidation.ok) return res.status(400).json({ error: emailValidation.error });

      const codeValidation = validateOtpCode(req.body?.code);
      if (!codeValidation.ok) return res.status(400).json({ error: codeValidation.error });

      const challengeId = challengeIdValidation.value;
      const email = emailValidation.value;
      const code = codeValidation.value;

      const verification = await oneTimeCodeService.verifyChallenge({
        challengeId,
        recipient: email,
        purpose: 'login 2fa',
        code,
      });

      if (!verification.ok) {
        return res.status(verification.statusCode || 400).json({
          error: verification.error,
          attemptsRemaining: verification.attemptsRemaining,
        });
      }

      const { userId } = verification.payload;
      const user = await resolvedUserModel.findByPk(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.email !== email) {
        return res.status(400).json({ error: 'Confirmation code recipient mismatch' });
      }

      const token = tokenLib.sign({ id: user.id, email: user.email }, secret, { expiresIn: JWT_EXPIRES_IN });
      setAuthCookie(res, token);
      await ensureSession({ token, user });

      return res.json({ id: user.id, login: user.login, email: user.email, loggedIn: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  return { loginConfirm };
};

module.exports = { createLoginConfirmHandler };
