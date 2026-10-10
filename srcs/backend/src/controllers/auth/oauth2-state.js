const { randomUUID } = require('crypto');
const sequelize = require('../../db');
const { normalizeOAuthRedirectTarget, normalizeOAuthNonce } = require('./oauth2-config');

const DEFAULT_TTL_MS = Number(process.env.OAUTH_STATE_TTL_MS) || 10 * 60 * 1000;
const SUPPORTED_INTENT_MODES = new Set(['login', 'link']);

const getIntentModel = () => sequelize.models.oauthStateIntent;

const createOAuthStateIntent = async ({ provider, mode = 'login', userId = null, next = '/', nonce } = {}) => {
  const oauthStateIntentModel = getIntentModel();
  if (!oauthStateIntentModel) {
    throw new Error('OAuth state intent storage is not available');
  }

  if (!SUPPORTED_INTENT_MODES.has(mode)) {
    throw new Error(`Unsupported OAuth state intent mode: ${mode}`);
  }

  if (mode === 'link' && !userId) {
    throw new Error('OAuth link intents require a user id');
  }

  if (mode === 'login' && userId) {
    throw new Error('OAuth login intents must not carry a user id');
  }

  const normalizedNonce = normalizeOAuthNonce(nonce);
  if (!normalizedNonce) {
    throw new Error('OAuth intents require a valid nonce');
  }

  const stateId = randomUUID();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);

  const intent = await oauthStateIntentModel.create({
    stateId,
    provider,
    mode,
    userId,
    next: normalizeOAuthRedirectTarget(next),
    nonce: normalizedNonce,
    expiresAt,
  });

  return {
    stateId: intent.stateId,
    provider: intent.provider,
    mode: intent.mode,
    userId: intent.userId,
    next: intent.next,
    nonce: intent.nonce,
    issuedAt: intent.createdAt,
    expiresAt: intent.expiresAt,
  };
};

const consumeOAuthStateIntent = async ({ stateId, provider } = {}) => {
  const oauthStateIntentModel = getIntentModel();
  if (!oauthStateIntentModel) {
    throw new Error('OAuth state intent storage is not available');
  }

  return sequelize.transaction(async (dbTransaction) => {
    const intent = await oauthStateIntentModel.findByPk(stateId, {
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE,
    });

    if (!intent) {
      return { ok: false, statusCode: 400, error: 'Authentication failed' };
    }

    if (intent.provider !== provider) {
      await intent.destroy({ transaction: dbTransaction });
      return { ok: false, statusCode: 400, error: 'Authentication failed' };
    }

    if (new Date(intent.expiresAt).getTime() <= Date.now()) {
      await intent.destroy({ transaction: dbTransaction });
      return { ok: false, statusCode: 400, error: 'Authentication failed' };
    }

    if (!SUPPORTED_INTENT_MODES.has(intent.mode)) {
      await intent.destroy({ transaction: dbTransaction });
      return { ok: false, statusCode: 400, error: 'Authentication failed' };
    }

    if ((intent.mode === 'link' && !intent.userId) || (intent.mode === 'login' && intent.userId)) {
      await intent.destroy({ transaction: dbTransaction });
      return { ok: false, statusCode: 400, error: 'Authentication failed' };
    }

    const payload = {
      stateId: intent.stateId,
      provider: intent.provider,
      mode: intent.mode,
      userId: intent.userId,
      next: intent.next,
      nonce: intent.nonce,
      issuedAt: intent.createdAt,
      expiresAt: intent.expiresAt,
    };

    await intent.destroy({ transaction: dbTransaction });
    return { ok: true, payload };
  });
};

const cleanupExpiredOAuthStateIntents = async () => {
  const oauthStateIntentModel = getIntentModel();
  if (!oauthStateIntentModel) {
    return 0;
  }

  return oauthStateIntentModel.destroy({
    where: {
      expiresAt: {
        [sequelize.Sequelize.Op.lte]: new Date(),
      },
    },
  });
};

setInterval(async () => {
  try {
    await cleanupExpiredOAuthStateIntents();
  } catch (error) {
    console.error('[OAUTH2] Failed to cleanup expired state intents:', error.message);
  }
}, 60_000).unref?.();

module.exports = {
  createOAuthStateIntent,
  consumeOAuthStateIntent,
  cleanupExpiredOAuthStateIntents,
};