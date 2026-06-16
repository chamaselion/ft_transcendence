const sequelize = require('../../db');
const { oneTimeCodeService: defaultOneTimeCodeService } = require('./oneTimeCodeToolkit');

const createPasswordResetRequestHandler = ({ userModel, oneTimeCodeService = defaultOneTimeCodeService } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const passwordResetRequest = async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Missing fields' });

      const user = await resolvedUserModel.findOne({ where: { email } });

      if (!user) {
        return res.status(202).json({
          codeSent: false,
          message: 'If an account exists for that email, a password reset code has been sent.',
        });
      }

      const challenge = await oneTimeCodeService.issueChallenge({
        purpose: 'password-reset',
        recipient: email,
        subject: 'Reset your password',
        payload: {
          userId: user.id,
          email: user.email,
        },
        textBuilder: ({ code, expiresInMinutes, attemptsRemaining, purposeLabel }) => (
          [
            `Your ${purposeLabel} code is ${code}.`,
            `It expires in ${expiresInMinutes} minute(s).`,
            `You have ${attemptsRemaining} attempt(s) to enter it correctly.`,
            'If you did not request this reset, you can ignore this message.',
          ].join(' ')
        ),
      });

      return res.status(202).json({
        confirmationId: challenge.challengeId,
        email,
        attemptsRemaining: challenge.attemptsRemaining,
        codeLength: challenge.codeLength,
        expiresAt: challenge.expiresAt,
        codeSent: true,
        debugCode: challenge.debugCode,
        message: 'If an account exists for that email, a password reset code has been sent.',
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  return { passwordResetRequest };
};

module.exports = { createPasswordResetRequestHandler };
