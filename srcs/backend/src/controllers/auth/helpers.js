const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const sequelize = require('../../db');

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: true,
  maxAge: COOKIE_MAX_AGE,
  path: '/',
};
const CLEAR_COOKIE_OPTIONS = { httpOnly: true, sameSite: 'strict', secure: true, path: '/' };

const getAuthSessionModel = () => sequelize.models.authSession;

const getTokenExpiryDate = (token) => {
  const decoded = jwt.decode(token);
  if (!decoded || !decoded.exp) {
    return null;
  }

  return new Date(decoded.exp * 1000);
};

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

const ensureSession = async ({ token, user }) => {
  if (!token || !user) return;

  const authSessionModel = getAuthSessionModel();
  if (!authSessionModel) return;

  const existing = await authSessionModel.findByPk(token);
  const now = new Date();

  await authSessionModel.upsert({
    token,
    userId: user.id,
    loginAt: existing?.loginAt || now,
    lastSeenAt: now,
    expiresAt: getTokenExpiryDate(token),
  });
};

const purgeExpiredSessions = async () => {
  const authSessionModel = getAuthSessionModel();
  if (!authSessionModel) return;

  await authSessionModel.destroy({
    where: {
      expiresAt: {
        [Op.lte]: new Date(),
      },
    },
  });
};

const purgeSessionsForUser = async (userId) => {
  if (!userId) return;

  const authSessionModel = getAuthSessionModel();
  if (!authSessionModel) return;

  await authSessionModel.destroy({
    where: { userId },
  });
};

const removeSessionByToken = async (token) => {
  if (!token) return;

  const authSessionModel = getAuthSessionModel();
  if (!authSessionModel) return;

  await authSessionModel.destroy({
    where: { token },
  });
};

const isSessionActive = async (token) => {
  if (!token) return false;

  const authSessionModel = getAuthSessionModel();
  if (!authSessionModel) return false;

  const session = await authSessionModel.findByPk(token);
  if (!session) return false;

  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    await removeSessionByToken(token);
    return false;
  }

  return true;
};

const listActiveSessionsForUser = async (userId) => {
  if (!userId) return [];

  const authSessionModel = getAuthSessionModel();
  if (!authSessionModel) return [];

  const rows = await authSessionModel.findAll({
    where: {
      userId,
      [Op.or]: [
        { expiresAt: null },
        {
          expiresAt: {
            [Op.gt]: new Date(),
          },
        },
      ],
    },
	include: [{
      model: sequelize.models.user,
      attributes: ['login', 'email'],
      required: false,
    }],
    order: [['lastSeenAt', 'DESC']],
  });

  return rows.map((row) => ({
    sessionId: row.token,
    userId: row.userId,
    login: row.user?.login || null,
    email: row.user?.email || null,
    loginAt: row.loginAt,
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt,
  }));
};

setInterval(() => {
  void purgeExpiredSessions();
}, 60_000).unref?.();

module.exports = {
  CLEAR_COOKIE_OPTIONS,
  COOKIE_OPTIONS,
  clearAuthCookie,
  ensureSession,
  getTokenFromCookie,
  isSessionActive,
  listActiveSessionsForUser,
  purgeExpiredSessions,
  purgeSessionsForUser,
  removeSessionByToken,
  setAuthCookie,
};