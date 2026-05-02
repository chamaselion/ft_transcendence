const jwt = require('jsonwebtoken');

const createAuthController = ({ userModel, hashLib, tokenLib = jwt, secret = process.env.JWT_SECRET || 'dev-secret' } = {}) => {
  const resolvedHashLib = hashLib || require('bcrypt');
  const resolvedUserModel = userModel || require('../models/user');

  const register = async (req, res) => {
    try {
      const { login, email, password } = req.body;
      if (!login || !email || !password) return res.status(400).json({ error: 'Missing fields' });

      const existing = await resolvedUserModel.findOne({ where: { email } });
      if (existing) return res.status(409).json({ error: 'Email already in use' });

      const hash = await resolvedHashLib.hash(password, 10);
      const user = await resolvedUserModel.create({ login, email, passwordHash: hash });
      return res.status(201).json({ id: user.id, login: user.login, email: user.email });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  const login = async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

      const user = await resolvedUserModel.findOne({ where: { email } });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const match = await resolvedHashLib.compare(password, user.passwordHash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });

      const token = tokenLib.sign({ id: user.id, email: user.email }, secret, { expiresIn: '7d' });
      return res.json({ token });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  return { register, login };
};

module.exports = { createAuthController };
