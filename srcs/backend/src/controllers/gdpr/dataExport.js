const jwt = require('jsonwebtoken');
const { requireEnv } = require('../../config');
const sequelize = require('../../db');
const { ensureSession, getTokenFromCookie, isSessionActive } = require('../auth/helpers');
const { checkAndConsumeExportQuota } = require('./exportQuota');
const { recordGdprAuditEvent } = require('./audit');
const { createGdprNotificationService } = require('../../services/gdprNotificationService');

const gdprNotificationService = createGdprNotificationService();

const createDataExportHandler = ({ userModel, tokenLib = jwt, secret = requireEnv('JWT_SECRET') } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const dataExport = async (req, res) => {
    try {
      console.log(`[AUTH] GET /me/data-export from ${req.ip}`, { token: getTokenFromCookie(req) ? 'present' : 'missing' });
      const token = getTokenFromCookie(req);
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const payload = tokenLib.verify(token, secret);
      if (!isSessionActive(token)) {
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
            endpoint: '/me/data-export',
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
            association: 'asset',
            attributes: ['id', 'type', 'name'],
            include: [
              {
                association: 'transactions',
                attributes: ['id', 'quantity', 'createdAt', 'updatedAt']
              },
              {
                association: 'assetValuations',
                attributes: ['id', 'valuationDate', 'open', 'high', 'low', 'close']
              }
            ]
          },
          {
            association: 'transactions',
            attributes: ['id', 'quantity', 'createdAt', 'updatedAt'],
            include: [
              {
                association: 'asset',
                attributes: ['id', 'type', 'name'],
                include: [
                  {
                    association: 'assetValuations',
                    attributes: ['id', 'valuationDate', 'open', 'high', 'low', 'close']
                  }
                ]
              }
            ]
          }
        ]
      });

      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      ensureSession({ token, user });

      const assetsById = new Map();
      if (user.asset) {
        assetsById.set(user.asset.id, user.asset.toJSON());
      }

      for (const transaction of user.transactions || []) {
        if (transaction.asset && !assetsById.has(transaction.asset.id)) {
          assetsById.set(transaction.asset.id, transaction.asset.toJSON());
        }
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        userData: {
          id: user.id,
          login: user.login,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        assets: Array.from(assetsById.values()),
        transactions: user.transactions ? user.transactions.map(t => t.toJSON()) : []
      };
      const exportReference = `export-${user.id}-${Date.now()}`;

      // Set headers for secure download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="user-data-${user.id}-${Date.now()}.json"`);
      res.setHeader('Cache-Control', 'no-store');

      // Stream the JSON response to minimize memory pressure and avoid creating a temp file
      // Write top-level fields and stream arrays item-by-item
      res.write('{' );
      res.write('"exportDate":' + JSON.stringify(exportData.exportDate) + ',');
      res.write('"userData":' + JSON.stringify(exportData.userData) + ',');

      // assets array
      res.write('"assets":[');
      for (let i = 0; i < exportData.assets.length; i++) {
        if (i > 0) res.write(',');
        res.write(JSON.stringify(exportData.assets[i]));
      }
      res.write('],');

      // transactions array
      res.write('"transactions":[');
      for (let i = 0; i < exportData.transactions.length; i++) {
        if (i > 0) res.write(',');
        res.write(JSON.stringify(exportData.transactions[i]));
      }
      res.write(']');

      res.write('}');
      res.once('finish', () => {
        void recordGdprAuditEvent({
          userId: user.id,
          actionType: 'data_export',
          status: 'completed',
          reference: exportReference,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            endpoint: '/me/data-export',
            assetCount: exportData.assets.length,
            transactionCount: exportData.transactions.length,
          },
        });

        void gdprNotificationService.sendDataExportConfirmation({
          to: user.email,
          reference: exportReference,
        }).catch((err) => {
          console.error(`[AUTH] Data export notification error: ${err.message}`);
        });
      });
      return res.end();
    } catch (err) {
      console.error(`[AUTH] Data export error: ${err.message}`);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  return { dataExport };
};

module.exports = { createDataExportHandler };
