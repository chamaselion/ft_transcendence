const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { requireEnv } = require('../../config');
const sequelize = require('../../db');
const { ensureSession, setAuthCookie } = require('./helpers');

const JWT_EXPIRES_IN = requireEnv('JWT_EXPIRES_IN');

const createLoginHandler = ({ userModel, hashLib = bcrypt, tokenLib = jwt, secret = requireEnv('JWT_SECRET') } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const login = async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log(`[AUTH] POST /login from ${req.ip}`, { email });
      if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

      const user = await resolvedUserModel.findOne({ where: { email } });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const match = await hashLib.compare(password, user.passwordHash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });

      const token = tokenLib.sign({ id: user.id, email: user.email }, secret, { expiresIn: JWT_EXPIRES_IN });
      setAuthCookie(res, token);
      ensureSession({ token, user });
      return res.json({ id: user.id, login: user.login, email: user.email, loggedIn: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  return { login };
};

module.exports = { createLoginHandler };