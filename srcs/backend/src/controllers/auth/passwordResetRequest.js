const sequelize = require('../../db');
const { randomUUID } = require('crypto');
const { oneTimeCodeService: defaultOneTimeCodeService } = require('./oneTimeCodeToolkit');
const { validateEmail } = require('./validation');

const createPasswordResetRequestHandler = ({ userModel, oneTimeCodeService = defaultOneTimeCodeService } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const passwordResetRequest = async (req, res) => {
    try {
      const emailValidation = validateEmail(req.body?.email);
      if (!emailValidation.ok) return res.status(400).json({ error: emailValidation.error });

      const email = emailValidation.value;

      const genericAcceptedResponse = {
        accepted: true,
        message: 'If an account exists for that email, a password reset code has been sent.',
      };

      const user = await resolvedUserModel.findOne({ where: { email } });

      if (!user) {
        return res.status(202).json({
          ...genericAcceptedResponse,
          confirmationId: randomUUID(),
        });
      }

      const challenge = await oneTimeCodeService.issueChallenge({
        purpose: 'password reset',
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
        ...genericAcceptedResponse,
        confirmationId: challenge.challengeId,
        codeLength: challenge.codeLength,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  return { passwordResetRequest };
};

module.exports = { createPasswordResetRequestHandler };
