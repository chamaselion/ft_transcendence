const bcrypt = require('bcrypt');
const sequelize = require('../../db');
const { requireNumberEnv } = require('../../config');
const { purgeSessionsForUser } = require('./helpers');
const { oneTimeCodeService: defaultOneTimeCodeService } = require('./oneTimeCodeToolkit');

const BCRYPT_SALT_ROUNDS = requireNumberEnv('BCRYPT_SALT_ROUNDS');

const createPasswordResetConfirmHandler = ({ userModel, hashLib = bcrypt, oneTimeCodeService = defaultOneTimeCodeService } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const passwordResetConfirm = async (req, res) => {
    try {
      const { confirmationId, email, code, newPassword } = req.body;

      if (!confirmationId || !email || !code || !newPassword) {
        return res.status(400).json({ error: 'Missing fields' });
      }

      const verification = await oneTimeCodeService.verifyChallenge({
        challengeId: confirmationId,
        recipient: email,
        purpose: 'password-reset',
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

      const passwordHash = await hashLib.hash(newPassword, BCRYPT_SALT_ROUNDS);
      await user.update({ passwordHash });
      await purgeSessionsForUser(user.id);

      return res.json({ passwordReset: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  return { passwordResetConfirm };
};

module.exports = { createPasswordResetConfirmHandler };
