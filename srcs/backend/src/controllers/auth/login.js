const bcrypt = require('bcryptjs');
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
      if (!user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });

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
        htmlBuilder: ({ code, expiresInMinutes, attemptsRemaining, purposeLabel }) => `
          <!DOCTYPE html>
          <html lang="de">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Verification Code</title>
          </head>
          <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; color: #333333;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.06); margin: 30px auto;">
              <tr>
                <td style="padding: 32px 32px 16px 32px;">
                  <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827; font-weight: 600;">
                    Your verification code
                  </h2>
                  <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #4b5563;">
                    Use this one-time-verfication code for <strong>${purposeLabel}</strong>:
                  </p>
                  
                  <!-- Code Box -->
                  <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 24px;">
                    <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1f2937;">
                      ${code}
                    </span>
                  </div>

                  <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; line-height: 1.4;">
                    • Valid for <strong>${expiresInMinutes} minutes</strong>.<br>
                    • You got <strong>${attemptsRemaining} trys</strong>.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 32px 32px 32px; border-top: 1px solid #f3f4f6;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.4;">
                    If you haven't requested this code, there may be someone trying to access your tranedit.info - account. Please change your password soon!
                  </p>
                </td>
              </tr>
            </table>
          </body>
          </html>
          `.trim(),
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
