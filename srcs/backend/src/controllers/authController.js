const jwt = require('jsonwebtoken');
const sequelize = require('../db')
const { requireEnv, requireNumberEnv } = require('../config');
const { createEmailService } = require('../services/emailService');
const { createOneTimeCodeService } = require('../services/oneTimeCodeService');

const BCRYPT_SALT_ROUNDS = requireNumberEnv('BCRYPT_SALT_ROUNDS');
const JWT_EXPIRES_IN = requireEnv('JWT_EXPIRES_IN');
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
// Maximum security: strict CSRF protection, HTTPS required
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: true,
  maxAge: COOKIE_MAX_AGE,
  path: '/',
};
const CLEAR_COOKIE_OPTIONS = { httpOnly: true, sameSite: 'strict', secure: true, path: '/' };
const activeSessions = new Map();
const emailService = createEmailService();
const oneTimeCodeService = createOneTimeCodeService({ emailService });

const createAuthController = ({ userModel, hashLib, tokenLib = jwt, secret = requireEnv('JWT_SECRET') } = {}) => {
  const resolvedHashLib = hashLib || require('bcrypt');
  const resolvedUserModel = userModel || sequelize.models.user;
  const resolvedOneTimeCodeService = oneTimeCodeService;

  const setAuthCookie = (res, token) => {
    res.cookie('token', token, COOKIE_OPTIONS);
  };

  const clearAuthCookie = (res) => {
    res.clearCookie('token', CLEAR_COOKIE_OPTIONS);
  };

  const getTokenFromCookie = (req) => {
    const rawCookie = req.headers.cookie || '';
    const tokenCookie = rawCookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('token='));
    return tokenCookie ? decodeURIComponent(tokenCookie.slice('token='.length)) : null;
  };

  const ensureSession = ({ token, user }) => {
    if (!token || !user) return;

    const existing = activeSessions.get(token);
    const nowIso = new Date().toISOString();

    if (existing) {
      activeSessions.set(token, {
        ...existing,
        lastSeenAt: nowIso,
      });
      return;
    }

    activeSessions.set(token, {
      sessionId: `${user.id}-${Date.now()}`,
      userId: user.id,
      login: user.login,
      email: user.email,
      loginAt: nowIso,
      lastSeenAt: nowIso,
    });
  };

  const purgeExpiredSessions = () => {
    for (const [token] of activeSessions.entries()) {
      try {
        tokenLib.verify(token, secret);
      } catch {
        activeSessions.delete(token);
      }
    }
  };

  const getAuthenticatedUser = async (req) => {
    const token = getTokenFromCookie(req);

    if (!token) {
      return null;
    }

    try {
      const payload = tokenLib.verify(token, secret);
      const user = await resolvedUserModel.findByPk(payload.id, {
        attributes: ['id', 'login', 'email'],
      });

      return user ? { token, user } : null;
    } catch {
      return null;
    }
  };

  const rejectIfLoggedIn = async (req, res) => {
    const session = await getAuthenticatedUser(req);

    if (!session) {
      return false;
    }

    res.status(409).json({ error: 'Log out before starting a new registration' });
    return true;
  };

  const register = async (req, res) => {
    try {
      if (await rejectIfLoggedIn(req, res)) {
        return;
      }

      console.log(`[AUTH] POST /register from ${req.ip}`, { body: req.body, cookies: req.headers.cookie });
      const { login, email, password } = req.body;
      if (!login || !email || !password) return res.status(400).json({ error: 'Missing fields' });

      const existing = await resolvedUserModel.findOne({ where: { email } });
      if (existing) return res.status(409).json({ error: 'Email already in use' });

      const existingLogin = await resolvedUserModel.findOne({ where: { login } });
      if (existingLogin) return res.status(409).json({ error: 'Login already in use' });

      const hash = await resolvedHashLib.hash(password, BCRYPT_SALT_ROUNDS);

      const challenge = await resolvedOneTimeCodeService.issueChallenge({
        purpose: 'registration',
        recipient: email,
        subject: 'Confirm your registration',
        payload: {
          login,
          email,
          passwordHash: hash,
        },
        textBuilder: ({ code, expiresInMinutes, attemptsRemaining, purposeLabel }) => (
          [
            `Your ${purposeLabel} code is ${code}.`,
            `It expires in ${expiresInMinutes} minute(s).`,
            `You have ${attemptsRemaining} attempt(s) to enter it correctly.`,
            'If you did not request this code, you can ignore this message.',
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
        message: `A confirmation code was sent to ${email}.`,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  const confirmRegistration = async (req, res) => {
    try {
      if (await rejectIfLoggedIn(req, res)) {
        return;
      }

      const { confirmationId, email, code } = req.body;

      if (!confirmationId || !email || !code) {
        return res.status(400).json({ error: 'Missing fields' });
      }

      const verification = await resolvedOneTimeCodeService.verifyChallenge({
        challengeId: confirmationId,
        recipient: email,
        purpose: 'registration',
        code,
      });

      if (!verification.ok) {
        return res.status(verification.statusCode || 400).json({
          error: verification.error,
          attemptsRemaining: verification.attemptsRemaining,
        });
      }

      const { login, email: confirmedEmail, passwordHash } = verification.payload;

      const existingEmail = await resolvedUserModel.findOne({ where: { email: confirmedEmail } });
      if (existingEmail) return res.status(409).json({ error: 'Email already in use' });

      const existingLogin = await resolvedUserModel.findOne({ where: { login } });
      if (existingLogin) return res.status(409).json({ error: 'Login already in use' });

      const user = await resolvedUserModel.create({ login, email: confirmedEmail, passwordHash });

      const token = tokenLib.sign({ id: user.id, email: user.email }, secret, { expiresIn: JWT_EXPIRES_IN });
      setAuthCookie(res, token);
      ensureSession({ token, user });

      return res.status(201).json({
        id: user.id,
        login: user.login,
        email: user.email,
        loggedIn: true,
        registrationConfirmed: true,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  const login = async (req, res) => {
    try {
      console.log(`[AUTH] POST /login from ${req.ip}`, { body: { email: req.body.email }, cookies: req.headers.cookie });
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

      const user = await resolvedUserModel.findOne({ where: { email } });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const match = await resolvedHashLib.compare(password, user.passwordHash);
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

  const me = async (req, res) => {
    try {
      console.log(`[AUTH] GET /me from ${req.ip}`, { token: getTokenFromCookie(req) ? 'present' : 'missing' });
      const token = getTokenFromCookie(req);
      if (!token) return res.status(401).json({ loggedIn: false });

      const payload = tokenLib.verify(token, secret);
      const user = await resolvedUserModel.findByPk(payload.id, {
        attributes: ['id', 'login', 'email'],
      });

      if (!user) return res.status(401).json({ loggedIn: false });
      ensureSession({ token, user });
      return res.json({ loggedIn: true, user });
    } catch (err) {
      return res.status(401).json({ loggedIn: false });
    }
  };

  const logout = async (req, res) => {
    console.log(`[AUTH] POST /logout from ${req.ip}`);
    const token = getTokenFromCookie(req);
    if (token) {
      activeSessions.delete(token);
    }
    clearAuthCookie(res);
    return res.json({ loggedIn: false, loggedOut: true });
  };

  const listSessions = async (req, res) => {
    try {
      const token = getTokenFromCookie(req);
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const payload = tokenLib.verify(token, secret);
      const requester = await resolvedUserModel.findByPk(payload.id, {
        attributes: ['id', 'login', 'email'],
      });

      if (!requester) return res.status(401).json({ error: 'Unauthorized' });

      ensureSession({ token, user: requester });
      purgeExpiredSessions();

      return res.json({
        count: activeSessions.size,
        sessions: [...activeSessions.values()],
      });
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };

  return { register, confirmRegistration, login, me, logout, listSessions };
};

module.exports = { createAuthController };
