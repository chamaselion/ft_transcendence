const jwt = require('jsonwebtoken');
const { requireEnv } = require('../../config');
const sequelize = require('../../db');
const { ensureSession, getTokenFromCookie, isSessionActive } = require('../auth/helpers');

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
      return res.end();
    } catch (err) {
      console.error(`[AUTH] Data export error: ${err.message}`);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  return { dataExport };
};

module.exports = { createDataExportHandler };
