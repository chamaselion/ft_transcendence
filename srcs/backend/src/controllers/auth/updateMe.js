const jwt = require('jsonwebtoken');
const sequelize = require('../../db');
const { requireEnv } = require('../../config');
const { ensureSession, getTokenFromCookie, isSessionActive } = require('./helpers');
const { oneTimeCodeService: defaultOneTimeCodeService } = require('./oneTimeCodeToolkit');
const { validateOptionalEmail, validateOptionalLogin } = require('./validation');

const createUpdateMeHandler = ({
  userModel,
  tokenLib = jwt,
  secret = requireEnv('JWT_SECRET'),
  oneTimeCodeService = defaultOneTimeCodeService,
} = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const loadUser = async (userId) => resolvedUserModel.findByPk(userId, {
    attributes: ['id', 'login', 'email'],
  });

  const respondWithChallenge = async (res, token, user, challenge, recipientEmail, requestedChanges) => {
    const refreshedUser = await loadUser(user.id);
    await ensureSession({ token, user: refreshedUser });

    return res.status(202).json({
      profileUpdateConfirmationRequired: true,
      confirmationId: challenge.challengeId,
      email: recipientEmail,
      attemptsRemaining: challenge.attemptsRemaining,
      codeLength: challenge.codeLength,
      expiresAt: challenge.expiresAt,
      codeSent: true,
      debugCode: challenge.debugCode,
      message: 'A profile update confirmation code has been sent.',
      pendingUpdate: requestedChanges,
      user: refreshedUser,
    });
  };

  const updateMe = async (req, res) => {
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

      const user = await loadUser(payload.id);

      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      await ensureSession({ token, user });

      const requestedLoginValidation = validateOptionalLogin(req.body?.login);
      if (!requestedLoginValidation.ok) return res.status(400).json({ error: requestedLoginValidation.error });

      const requestedEmailValidation = validateOptionalEmail(req.body?.email);
      if (!requestedEmailValidation.ok) return res.status(400).json({ error: requestedEmailValidation.error });

      const requestedLogin = requestedLoginValidation.value;
      const requestedEmail = requestedEmailValidation.value;

      const wantsLoginChange = Boolean(requestedLogin && requestedLogin !== user.login);
      const wantsEmailChange = Boolean(requestedEmail && requestedEmail !== user.email);

      if (!wantsLoginChange && !wantsEmailChange) {
        return res.status(400).json({ error: 'No changes requested' });
      }

      if (wantsLoginChange) {
        const existingLogin = await resolvedUserModel.findOne({ where: { login: requestedLogin } });
        if (existingLogin && existingLogin.id !== user.id) {
          return res.status(409).json({ error: 'Login already in use' });
        }
      }

      const recipientEmail = wantsEmailChange ? requestedEmail : user.email;
      const requestedChanges = {
        ...(wantsLoginChange ? { login: requestedLogin } : {}),
        ...(wantsEmailChange ? { email: requestedEmail } : {}),
      };

      const challenge = await oneTimeCodeService.issueChallenge({
        purpose: 'profile update',
        recipient: recipientEmail,
        subject: 'Confirm your profile update',
        payload: {
          userId: user.id,
          email: recipientEmail,
          login: user.login,
          changes: requestedChanges,
        },
        textBuilder: ({ code, expiresInMinutes, attemptsRemaining, purposeLabel }) => (
          [
            `Your ${purposeLabel} code is ${code}.`,
            `It expires in ${expiresInMinutes} minute(s).`,
            `You have ${attemptsRemaining} attempt(s) to enter it correctly.`,
            'If you did not request this profile update, you can ignore this message.',
          ].join(' ')
        ),
      });

      return respondWithChallenge(res, token, user, challenge, recipientEmail, requestedChanges);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  return { updateMe };
};

module.exports = { createUpdateMeHandler };