const jwt = require('jsonwebtoken');
const { requireEnv, requireNumberEnv } = require('../config');

const BCRYPT_SALT_ROUNDS = requireNumberEnv('BCRYPT_SALT_ROUNDS');
const JWT_EXPIRES_IN = requireEnv('JWT_EXPIRES_IN');
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'strict', secure: false, maxAge: COOKIE_MAX_AGE };

const createAuthController = ({ userModel, hashLib, tokenLib = jwt, secret = requireEnv('JWT_SECRET') } = {}) => {
  const resolvedHashLib = hashLib || require('bcrypt');
  const resolvedUserModel = userModel || require('../models/user');

  const setAuthCookie = (res, token) => {
    res.cookie('token', token, COOKIE_OPTIONS);
  };

  const getTokenFromCookie = (req) => {
    const rawCookie = req.headers.cookie || '';
    const tokenCookie = rawCookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('token='));
    return tokenCookie ? decodeURIComponent(tokenCookie.slice('token='.length)) : null;
  };

  const register = async (req, res) => {
    try {
      const { login, email, password } = req.body;
      if (!login || !email || !password) return res.status(400).json({ error: 'Missing fields' });

      const existing = await resolvedUserModel.findOne({ where: { email } });
      if (existing) return res.status(409).json({ error: 'Email already in use' });

      const hash = await resolvedHashLib.hash(password, BCRYPT_SALT_ROUNDS);
      const user = await resolvedUserModel.create({ login, email, passwordHash: hash });
      return res.status(201).json({ id: user.id, login: user.login, email: user.email, registered: true });
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

      const token = tokenLib.sign({ id: user.id, email: user.email }, secret, { expiresIn: JWT_EXPIRES_IN });
      setAuthCookie(res, token);
      return res.json({ id: user.id, login: user.login, email: user.email, loggedIn: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  const me = async (req, res) => {
    try {
      const token = getTokenFromCookie(req);
      if (!token) return res.status(401).json({ loggedIn: false });

      const payload = tokenLib.verify(token, secret);
      const user = await resolvedUserModel.findByPk(payload.id, {
        attributes: ['id', 'login', 'email'],
      });

      if (!user) return res.status(401).json({ loggedIn: false });
      return res.json({ loggedIn: true, user });
    } catch (err) {
      return res.status(401).json({ loggedIn: false });
    }
  };

  return { register, login, me };
};

module.exports = { createAuthController };
