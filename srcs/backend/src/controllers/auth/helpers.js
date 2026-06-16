const jwt = require('jsonwebtoken');
const { requireEnv } = require('../../config');

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: true,
  maxAge: COOKIE_MAX_AGE,
  path: '/',
};
const CLEAR_COOKIE_OPTIONS = { httpOnly: true, sameSite: 'strict', secure: true, path: '/' };
const activeSessions = new Map();

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

const purgeExpiredSessions = ({ tokenLib = jwt, secret = requireEnv('JWT_SECRET') } = {}) => {
  for (const [token] of activeSessions.entries()) {
    try {
      tokenLib.verify(token, secret);
    } catch {
      activeSessions.delete(token);
    }
  }
};

module.exports = {
  CLEAR_COOKIE_OPTIONS,
  COOKIE_OPTIONS,
  activeSessions,
  clearAuthCookie,
  ensureSession,
  getTokenFromCookie,
  purgeExpiredSessions,
  setAuthCookie,
};