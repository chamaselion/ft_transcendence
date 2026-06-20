const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_EXPORTS = 1;
const DEFAULT_MIN_INTERVAL_MS = 60 * 1000;

const { Op } = require('sequelize');
const sequelize = require('../../db');

const getQuotaConfig = (overrides = {}) => ({
  windowMs: overrides.windowMs || DEFAULT_WINDOW_MS,
  maxExports: overrides.maxExports || DEFAULT_MAX_EXPORTS,
  minIntervalMs: overrides.minIntervalMs || DEFAULT_MIN_INTERVAL_MS,
});

const pruneExpiredQuotaEntries = async (now = Date.now(), windowMs = DEFAULT_WINDOW_MS) => {
  const quotaModel = sequelize.models.gdprExportQuota;
  if (!quotaModel) {
    return;
  }

  await quotaModel.destroy({
    where: {
      windowStartAt: {
          [Op.lt]: new Date(now - windowMs),
      },
    },
  });
};

const checkAndConsumeExportQuota = async (userId, overrides = {}) => {
  if (!userId) {
    return {
      allowed: false,
      statusCode: 400,
      error: 'Missing user identifier',
    };
  }

  const now = Date.now();
  const { windowMs, maxExports, minIntervalMs } = getQuotaConfig(overrides);

  const quotaModel = sequelize.models.gdprExportQuota;
  if (!quotaModel) {
    return {
      allowed: false,
      statusCode: 500,
      error: 'Export quota storage is not available',
    };
  }

  await pruneExpiredQuotaEntries(now, windowMs);

  return sequelize.transaction(async (dbTransaction) => {
    let currentEntry = await quotaModel.findByPk(userId, {
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE,
    });

    if (!currentEntry) {
      currentEntry = await quotaModel.create({
        userId,
        windowStartAt: new Date(now),
        exportCount: 0,
        lastExportAt: null,
      }, {
        transaction: dbTransaction,
      });
    }

    const windowStartAt = currentEntry.windowStartAt ? new Date(currentEntry.windowStartAt).getTime() : now;
    const lastExportAt = currentEntry.lastExportAt ? new Date(currentEntry.lastExportAt).getTime() : 0;

    if (now - lastExportAt < minIntervalMs) {
      const retryAfterMs = minIntervalMs - (now - lastExportAt);
      return {
        allowed: false,
        statusCode: 429,
        error: 'Export rate limit exceeded. Please wait before requesting another export.',
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        limit: maxExports,
        remaining: Math.max(0, maxExports - currentEntry.exportCount),
        resetAt: lastExportAt + minIntervalMs,
      };
    }

    if (now - windowStartAt >= windowMs) {
      currentEntry.windowStartAt = new Date(now);
      currentEntry.exportCount = 0;
    }

    if (currentEntry.exportCount >= maxExports) {
      const resetAt = new Date(currentEntry.windowStartAt).getTime() + windowMs;
      return {
        allowed: false,
        statusCode: 429,
        error: 'Export quota exceeded for this period. Try again later.',
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        limit: maxExports,
        remaining: 0,
        resetAt,
      };
    }

    currentEntry.exportCount += 1;
    currentEntry.lastExportAt = new Date(now);
    await currentEntry.save({ transaction: dbTransaction });

    return {
      allowed: true,
      limit: maxExports,
      remaining: Math.max(0, maxExports - currentEntry.exportCount),
      resetAt: new Date(currentEntry.windowStartAt).getTime() + windowMs,
    };
  });
};

module.exports = {
  DEFAULT_MAX_EXPORTS,
  DEFAULT_MIN_INTERVAL_MS,
  DEFAULT_WINDOW_MS,
  checkAndConsumeExportQuota,
  pruneExpiredQuotaEntries,
};