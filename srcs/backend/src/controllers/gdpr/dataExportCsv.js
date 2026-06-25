const jwt = require('jsonwebtoken');
const { requireEnv } = require('../../config');
const sequelize = require('../../db');
const { ensureSession, getTokenFromCookie, isSessionActive } = require('../auth/helpers');
const { checkAndConsumeExportQuota } = require('./exportQuota');
const { recordGdprAuditEvent } = require('./audit');
const { createGdprNotificationService } = require('../../services/gdprNotificationService');

const gdprNotificationService = createGdprNotificationService();

const buildAssetsById = (transactions) => {
  const assetsById = new Map();

  for (const transaction of transactions || []) {
    if (transaction.asset && !assetsById.has(transaction.asset.id)) {
      assetsById.set(transaction.asset.id, transaction.asset.toJSON());
    }
  }

  return assetsById;
};

const neutralizeCsvFormula = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /^\s*[=+\-@\t]/.test(text) ? `'${text}` : text;
};

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const normalized = neutralizeCsvFormula(value).replace(/\r\n|\n|\r/g, '\\n');
  const escaped = normalized.replace(/"/g, '""');
  return `"${escaped}"`;
};

const toCsvRow = (fields) => fields.map((field) => escapeCsvValue(field)).join(',');

const createDataExportCsvHandler = ({ userModel, tokenLib = jwt, secret = requireEnv('JWT_SECRET') } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const dataExportCsv = async (req, res) => {
    try {
      console.log(`[AUTH] GET /me/data-export/csv from ${req.ip}`, { token: getTokenFromCookie(req) ? 'present' : 'missing' });
      const token = getTokenFromCookie(req);
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const payload = tokenLib.verify(token, secret);
      if (!(await isSessionActive(token))) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const quotaResult = await checkAndConsumeExportQuota(payload.id);
      if (!quotaResult.allowed) {
        void recordGdprAuditEvent({
          userId: payload.id,
          actionType: 'data_export',
          status: 'rejected',
          reference: null,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            endpoint: '/me/data-export/csv',
            reason: quotaResult.error || 'Rate limit exceeded',
            retryAfterSeconds: quotaResult.retryAfterSeconds || null,
            limit: quotaResult.limit ?? null,
            remaining: quotaResult.remaining ?? null,
          },
        });

        if (quotaResult.retryAfterSeconds) {
          res.setHeader('Retry-After', String(quotaResult.retryAfterSeconds));
        }
        if (quotaResult.limit !== undefined) {
          res.setHeader('X-RateLimit-Limit', String(quotaResult.limit));
        }
        if (quotaResult.remaining !== undefined) {
          res.setHeader('X-RateLimit-Remaining', String(quotaResult.remaining));
        }
        if (quotaResult.resetAt) {
          res.setHeader('X-RateLimit-Reset', String(Math.floor(quotaResult.resetAt / 1000)));
        }

        return res.status(quotaResult.statusCode || 429).json({
          error: quotaResult.error || 'Rate limit exceeded',
          retryAfterSeconds: quotaResult.retryAfterSeconds,
          limit: quotaResult.limit,
          remaining: quotaResult.remaining,
          resetAt: quotaResult.resetAt,
        });
      }

      res.setHeader('X-RateLimit-Limit', String(quotaResult.limit));
      res.setHeader('X-RateLimit-Remaining', String(quotaResult.remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.floor(quotaResult.resetAt / 1000)));

      const user = await resolvedUserModel.findByPk(payload.id, {
        attributes: ['id', 'login', 'email', 'createdAt', 'updatedAt'],
        include: [
          {
            association: 'transactions',
            attributes: ['id', 'quantity', 'date', 'createdAt', 'updatedAt'],
            include: [
              {
                association: 'asset',
                attributes: ['id', 'key', 'type', 'name', 'symbol'],
                include: [
                  {
                    association: 'assetValuations',
                    attributes: ['id', 'valuationDate', 'open', 'high', 'low', 'close'],
                  },
                ],
              },
            ],
          },
        ],
      });

      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      await ensureSession({ token, user });

      const assetsById = buildAssetsById(user.transactions);

      const assets = Array.from(assetsById.values());
      const valuationsByAsset = new Map();
      for (const asset of assets) {
        valuationsByAsset.set(asset.id, asset.assetValuations || []);
      }

      const exportReference = `export-${user.id}-${Date.now()}`;
      const fileTimestamp = Date.now();

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', `attachment; filename="user-data-${user.id}-${fileTimestamp}.csv"`);
      res.setHeader('Cache-Control', 'no-store');

      const exportDate = new Date().toISOString();

      res.write('\uFEFF');
      res.write(toCsvRow(['section', 'field', 'value']) + '\n');
      res.write(toCsvRow(['meta', 'exportDate', exportDate]) + '\n');
      res.write('\n');

      res.write(toCsvRow(['section', 'id', 'login', 'email', 'createdAt', 'updatedAt']) + '\n');
      res.write(toCsvRow(['user', user.id, user.login, user.email, user.createdAt, user.updatedAt]) + '\n');
      res.write('\n');

      res.write(toCsvRow(['section', 'assetId', 'assetKey', 'symbol', 'type', 'name']) + '\n');
      for (const asset of assets) {
        res.write(toCsvRow(['asset', asset.id, asset.key, asset.symbol, asset.type, asset.name]) + '\n');
      }
      res.write('\n');

      res.write(toCsvRow(['section', 'assetId', 'valuationId', 'valuationDate', 'open', 'high', 'low', 'close']) + '\n');
      for (const [assetId, valuations] of valuationsByAsset.entries()) {
        for (const valuation of valuations) {
          res.write(toCsvRow([
            'assetValuation',
            assetId,
            valuation.id,
            valuation.valuationDate,
            valuation.open,
            valuation.high,
            valuation.low,
            valuation.close,
          ]) + '\n');
        }
      }
      res.write('\n');

      res.write(toCsvRow([
        'section',
        'transactionId',
        'assetId',
        'assetKey',
        'assetSymbol',
        'assetType',
        'assetName',
        'quantity',
        'date',
        'createdAt',
        'updatedAt',
      ]) + '\n');

      const transactions = user.transactions ? user.transactions.map((transaction) => transaction.toJSON()) : [];
      for (const transaction of transactions) {
        const transactionAsset = transaction.asset || {};
        res.write(toCsvRow([
          'transaction',
          transaction.id,
          transactionAsset.id || null,
          transactionAsset.key || null,
          transactionAsset.symbol || null,
          transactionAsset.type || null,
          transactionAsset.name || null,
          transaction.quantity,
          transaction.date,
          transaction.createdAt,
          transaction.updatedAt,
        ]) + '\n');
      }

      res.once('finish', () => {
        void recordGdprAuditEvent({
          userId: user.id,
          actionType: 'data_export',
          status: 'completed',
          reference: exportReference,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            endpoint: '/me/data-export/csv',
            format: 'csv',
            assetCount: assets.length,
            transactionCount: transactions.length,
          },
        });

        void gdprNotificationService.sendDataExportConfirmation({
          to: user.email,
          reference: exportReference,
        }).catch((err) => {
          console.error(`[AUTH] CSV data export notification error: ${err.message}`);
        });
      });

      return res.end();
    } catch (err) {
      console.error(`[AUTH] CSV data export error: ${err.message}`);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  return { dataExportCsv };
};

module.exports = { createDataExportCsvHandler };