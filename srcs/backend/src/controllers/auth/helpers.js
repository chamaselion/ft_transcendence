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
const sessionCache = new Map();
let cacheHydrated = false;
let hydrationPromise = null;

const toTimestamp = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const toSessionCacheRecord = (row) => ({
  token: row.token,
  userId: row.userId,
  loginAt: toTimestamp(row.loginAt) || Date.now(),
  lastSeenAt: toTimestamp(row.lastSeenAt) || Date.now(),
  expiresAt: toTimestamp(row.expiresAt),
});

const getTokenExpiryDate = (token) => {
  const decoded = jwt.decode(token);
  if (!decoded || !decoded.exp) {
    return null;
  }

  return new Date(decoded.exp * 1000);
};

const hydrateSessionCacheFromDb = async () => {
  if (cacheHydrated) return;
  if (hydrationPromise) {
    await hydrationPromise;
    return;
  }

  hydrationPromise = (async () => {
    const authSessionModel = getAuthSessionModel();
    if (!authSessionModel) {
      cacheHydrated = true;
      return;
    }

    const rows = await authSessionModel.findAll({
      where: {
        [Op.or]: [
          { expiresAt: null },
          {
            expiresAt: {
              [Op.gt]: new Date(),
            },
          },
        ],
      },
    });
    sessionCache.clear();

    for (const row of rows) {
      const entry = toSessionCacheRecord(row);
      sessionCache.set(entry.token, entry);
    }

    cacheHydrated = true;
  })();

  try {
    await hydrationPromise;
  } finally {
    hydrationPromise = null;
  }
};

const flushSessionStateToDb = async () => {
  const authSessionModel = getAuthSessionModel();
  if (!authSessionModel) return;

  await hydrateSessionCacheFromDb();

  const now = Date.now();
  const recordsToUpsert = [];
  const expiredTokens = [];

  for (const [token, cached] of sessionCache.entries()) {
    if (cached.expiresAt && cached.expiresAt <= now) {
      expiredTokens.push(token);
      continue;
    }

    recordsToUpsert.push({
      token,
      userId: cached.userId,
      loginAt: new Date(cached.loginAt),
      lastSeenAt: new Date(cached.lastSeenAt),
      expiresAt: cached.expiresAt ? new Date(cached.expiresAt) : null,
    });
  }

  if (!recordsToUpsert.length && !expiredTokens.length) {
    return;
  }

  await sequelize.transaction(async (dbTransaction) => {
    if (recordsToUpsert.length) {
      await authSessionModel.bulkCreate(recordsToUpsert, {
        updateOnDuplicate: ['userId', 'loginAt', 'lastSeenAt', 'expiresAt'],
        transaction: dbTransaction,
      });
    }

    if (expiredTokens.length) {
      await authSessionModel.destroy({
        where: {
          token: {
            [Op.in]: expiredTokens,
          },
        },
        transaction: dbTransaction,
      });
    }
  });

  expiredTokens.forEach((token) => {
    sessionCache.delete(token);
  });
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

  await hydrateSessionCacheFromDb();

  const existing = sessionCache.get(token);
  const now = new Date();
  const record = {
    token,
    userId: user.id,
    loginAt: existing?.loginAt || now,
    lastSeenAt: now,
    expiresAt: getTokenExpiryDate(token),
  };

  sessionCache.set(token, toSessionCacheRecord(record));

  await authSessionModel.upsert(record);
};

const purgeExpiredSessions = async () => {
  const authSessionModel = getAuthSessionModel();
  if (!authSessionModel) return;

  await hydrateSessionCacheFromDb();

  const now = Date.now();
  const expiredTokens = [];

  for (const [token, session] of sessionCache.entries()) {
    if (session.expiresAt && session.expiresAt <= now) {
      expiredTokens.push(token);
    }
  }

  if (!expiredTokens.length) return;

  expiredTokens.forEach((token) => {
    sessionCache.delete(token);
  });

  await authSessionModel.destroy({
    where: {
      token: {
        [Op.in]: expiredTokens,
      },
    },
  });
};

const purgeSessionsForUser = async (userId) => {
  if (!userId) return;

  const authSessionModel = getAuthSessionModel();
  if (!authSessionModel) return;

  await hydrateSessionCacheFromDb();

  for (const [token, session] of sessionCache.entries()) {
    if (String(session.userId) === String(userId)) {
      sessionCache.delete(token);
    }
  }

  await authSessionModel.destroy({
    where: { userId },
  });
};

const removeSessionByToken = async (token) => {
  if (!token) return;

  const authSessionModel = getAuthSessionModel();
  if (!authSessionModel) return;

  await hydrateSessionCacheFromDb();

  sessionCache.delete(token);

  await authSessionModel.destroy({
    where: { token },
  });
};

const isSessionActive = async (token) => {
  if (!token) return false;

  await hydrateSessionCacheFromDb();

  const session = sessionCache.get(token);
  if (!session) return false;

  if (session.expiresAt && session.expiresAt <= Date.now()) {
    await removeSessionByToken(token);
    return false;
  }

  return true;
};

const listActiveSessionsForUser = async (userId) => {
  if (!userId) return [];

  await hydrateSessionCacheFromDb();

  const now = Date.now();
  const userSessions = [];
  const userIds = new Set();
  const expiredTokens = [];
  const authSessionModel = getAuthSessionModel();

  for (const [token, session] of sessionCache.entries()) {
    if (String(session.userId) !== String(userId)) {
      continue;
    }

    if (session.expiresAt && session.expiresAt <= now) {
      sessionCache.delete(token);
      expiredTokens.push(token);
      continue;
    }

    userSessions.push({ token, ...session });
    userIds.add(session.userId);
  }

  const userModel = sequelize.models.user;
  const usersById = new Map();

  if (userModel && userIds.size) {
    const users = await userModel.findAll({
      where: {
        id: {
          [Op.in]: [...userIds],
        },
      },
      attributes: ['id', 'login', 'email'],
      raw: true,
    });

    users.forEach((row) => usersById.set(String(row.id), row));
  }

  if (authSessionModel && expiredTokens.length) {
    await authSessionModel.destroy({
      where: {
        token: {
          [Op.in]: expiredTokens,
        },
      },
    });
  }

  return userSessions
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .map((session) => ({
      sessionId: session.token,
      userId: session.userId,
      login: usersById.get(String(session.userId))?.login || null,
      email: usersById.get(String(session.userId))?.email || null,
      loginAt: new Date(session.loginAt),
      lastSeenAt: new Date(session.lastSeenAt),
      expiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
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
  flushSessionStateToDb,
  getTokenFromCookie,
  hydrateSessionCacheFromDb,
  isSessionActive,
  listActiveSessionsForUser,
  purgeExpiredSessions,
  purgeSessionsForUser,
  removeSessionByToken,
  setAuthCookie,
};