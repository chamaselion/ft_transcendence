const bcrypt = require('bcrypt');
const { requireEnv, requireNumberEnv } = require('../../config');
const sequelize = require('../../db');

const BCRYPT_SALT_ROUNDS = requireNumberEnv('BCRYPT_SALT_ROUNDS');

const createRegisterHandler = ({ userModel, hashLib = bcrypt } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const register = async (req, res) => {
    try {
      console.log(`[AUTH] POST /register from ${req.ip}`, { body: req.body, cookies: req.headers.cookie });
      const { login, email, password } = req.body;
      if (!login || !email || !password) return res.status(400).json({ error: 'Missing fields' });

      const existing = await resolvedUserModel.findOne({ where: { email } });
      if (existing) return res.status(409).json({ error: 'Email already in use' });

      const hash = await hashLib.hash(password, BCRYPT_SALT_ROUNDS);
      const user = await resolvedUserModel.create({ login, email, passwordHash: hash });
      return res.status(201).json({ id: user.id, login: user.login, email: user.email, registered: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  return { register };
};

module.exports = { createRegisterHandler };