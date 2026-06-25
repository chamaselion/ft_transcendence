const bcrypt = require('bcrypt');
const sequelize = require('../../db');
const { oneTimeCodeService: defaultOneTimeCodeService } = require('./oneTimeCodeToolkit');
const { validateEmail, validatePassword } = require('./validation');

const maskEmail = (email) => {
  const normalizedEmail = String(email || '').trim();
  const [localPart = '', domain = ''] = normalizedEmail.split('@');

  if (!localPart || !domain) {
    return normalizedEmail;
  }

  const visiblePrefix = localPart.slice(0, 2);
  return `${visiblePrefix}${localPart.length > 2 ? '***' : ''}@${domain}`;
};

const createLoginHandler = ({ userModel, hashLib = bcrypt, oneTimeCodeService = defaultOneTimeCodeService } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const login = async (req, res) => {
    try {
      const emailValidation = validateEmail(req.body?.email);
      if (!emailValidation.ok) return res.status(400).json({ error: emailValidation.error });

      const passwordValidation = validatePassword(req.body?.password);
      if (!passwordValidation.ok) return res.status(400).json({ error: passwordValidation.error });

      const email = emailValidation.value;
      const password = passwordValidation.value;
      console.log(`[AUTH] POST /login from ${req.ip}`, { email });

      const user = await resolvedUserModel.findOne({ where: { email } });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const match = await hashLib.compare(password, user.passwordHash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });

      const challenge = await oneTimeCodeService.issueChallenge({
        purpose: 'login 2fa',
        recipient: user.email,
        subject: 'Your login verification code',
        payload: {
          userId: user.id,
          email: user.email,
        },
        textBuilder: ({ code, expiresInMinutes, attemptsRemaining, purposeLabel }) => (
          [
            `Your ${purposeLabel} code is ${code}.`,
            `It expires in ${expiresInMinutes} minute(s).`,
            `You have ${attemptsRemaining} attempt(s) to enter it correctly.`,
            'If you did not try to log in, you can ignore this message.',
          ].join(' ')
        ),
      });

      return res.status(202).json({
        loginChallenge: true,
        challengeId: challenge.challengeId,
        email: user.email,
        emailMasked: maskEmail(user.email),
        attemptsRemaining: challenge.attemptsRemaining,
        codeLength: challenge.codeLength,
        expiresAt: challenge.expiresAt,
        codeSent: true,
        debugCode: challenge.debugCode,
        message: 'A login verification code has been sent.',
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  return { login };
};

module.exports = { createLoginHandler };