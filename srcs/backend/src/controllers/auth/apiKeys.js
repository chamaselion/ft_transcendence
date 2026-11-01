const crypto = require('crypto');
const sequelize = require('../../db');
const { validateUuid } = require('./validation');

const MAX_ACTIVE_KEYS = 10;
const TOKEN_PREFIX = 'transedit_';

const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

const publicKey = (key) => ({
  id: key.id,
  name: key.name,
  prefix: key.prefix,
  lastUsedAt: key.lastUsedAt,
  createdAt: key.createdAt,
});

const createApiKeyController = ({ apiKeyModel } = {}) => {
  const model = () => apiKeyModel || sequelize.models.apiKey;

  const listApiKeys = async (req, res) => {
    try {
      const keys = await model().findAll({
        where: { userId: req.user.id, revokedAt: null },
        order: [['createdAt', 'DESC']],
      });
      return res.json({ apiKeys: keys.map(publicKey) });
    } catch (err) {
      console.error('[API KEYS] list failed:', err);
      return res.status(500).json({ error: 'Failed to list API keys' });
    }
  };

  const createApiKey = async (req, res) => {
    try {
      const name =
        typeof req.body?.name === 'string' && req.body.name.trim()
          ? req.body.name.trim().slice(0, 100)
          : 'API key';
      const active = await model().count({
        where: { userId: req.user.id, revokedAt: null },
      });
      if (active >= MAX_ACTIVE_KEYS) {
        return res.status(409).json({
          error: `At most ${MAX_ACTIVE_KEYS} active API keys are allowed`,
        });
      }

      const rawToken = `${TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
      const key = await model().create({
        userId: req.user.id,
        name,
        keyHash: hashToken(rawToken),
        prefix: rawToken.slice(0, 16),
      });

      return res.status(201).json({
        apiKey: publicKey(key),
        token: rawToken,
      });
    } catch (err) {
      console.error('[API KEYS] create failed:', err);
      return res.status(500).json({ error: 'Failed to create API key' });
    }
  };

  const revokeApiKey = async (req, res) => {
    try {
      const idCheck = validateUuid(req.params.id, 'api key id');
      if (!idCheck.ok) return res.status(400).json({ error: idCheck.error });

      const key = await model().findOne({
        where: { id: idCheck.value, userId: req.user.id, revokedAt: null },
      });
      if (!key) return res.status(404).json({ error: 'API key not found' });

      await key.update({ revokedAt: new Date() });
      return res.status(204).send();
    } catch (err) {
      console.error('[API KEYS] revoke failed:', err);
      return res.status(500).json({ error: 'Failed to revoke API key' });
    }
  };

  return { listApiKeys, createApiKey, revokeApiKey };
};

const findUserForApiKey = async ({ token, apiKeyModel, userModel }) => {
  if (!token) return null;
  const key = await (apiKeyModel || sequelize.models.apiKey).findOne({
    where: { keyHash: hashToken(token), revokedAt: null },
  });
  if (!key) return null;
  const user = await (userModel || sequelize.models.user).findByPk(key.userId, {
    attributes: ['id', 'login', 'email', 'role'],
  });
  if (!user) return null;
  const lastUsed = key.lastUsedAt ? new Date(key.lastUsedAt).getTime() : 0;
  if (Date.now() - lastUsed > 60_000) {
    void key.update({ lastUsedAt: new Date() }).catch(() => {});
  }
  return { user, key };
};

module.exports = {
  createApiKeyController,
  findUserForApiKey,
  hashToken,
  TOKEN_PREFIX,
};
