const bcrypt = require('bcryptjs');
const { UniqueConstraintError } = require('sequelize');
const { requireNumberEnv } = require('../../config');
const sequelize = require('../../db');
const { validateEmail, validateLogin, validatePassword } = require('./validation');

const BCRYPT_SALT_ROUNDS = requireNumberEnv('BCRYPT_SALT_ROUNDS');

const createRegisterHandler = ({ userModel, hashLib = bcrypt } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const register = async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : null;
      if (!body || Object.keys(body).length === 0) {
        return res.status(400).json({ error: 'Request body is required' });
      }

      console.log(`[AUTH] POST /register from ${req.ip}`, {
        bodyReceived: true,
        bodyKeys: Object.keys(body),
      });

      const loginValidation = validateLogin(body.login);
      if (!loginValidation.ok) return res.status(400).json({ error: loginValidation.error });

      const emailValidation = validateEmail(body.email);
      if (!emailValidation.ok) return res.status(400).json({ error: emailValidation.error });

      const passwordValidation = validatePassword(body.password);
      if (!passwordValidation.ok) return res.status(400).json({ error: passwordValidation.error });

      const login = loginValidation.value;
      const email = emailValidation.value;
      const password = passwordValidation.value;


      const existingEmail = await resolvedUserModel.findOne({ where: { email } });
      if (existingEmail) return res.status(409).json({ error: 'Email already in use' });

      const existingLogin = await resolvedUserModel.findOne({ where: { login } });
      if (existingLogin) return res.status(409).json({ error: 'Login already in use' });

      const hash = await hashLib.hash(password, BCRYPT_SALT_ROUNDS);
      const user = await resolvedUserModel.create({ login, email, passwordHash: hash });
      return res.status(201).json({ id: user.id, login: user.login, email: user.email, registered: true });
    } catch (err) {

      if (err instanceof UniqueConstraintError) {
        const conflicting = String(err.errors?.[0]?.path || Object.keys(err.fields || {})[0] || '');
        const label = conflicting.includes('login')
          ? 'Login'
          : conflicting.includes('email')
            ? 'Email'
            : null;
        return res.status(409).json({
          error: label ? `${label} already in use` : 'Login or email already in use',
        });
      }

      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  return { register };
};

module.exports = { createRegisterHandler };
