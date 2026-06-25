const jwt = require('jsonwebtoken');
const { requireEnv } = require('../../config');
const sequelize = require('../../db');
const { clearAuthCookie, ensureSession, getTokenFromCookie, isSessionActive, purgeSessionsForUser } = require('../auth/helpers');
const { oneTimeCodeService: defaultOneTimeCodeService } = require('../auth/oneTimeCodeToolkit');
const { createGdprNotificationService } = require('../../services/gdprNotificationService');
const { validateChallengeId, validateOtpCode } = require('../auth/validation');

const gdprNotificationService = createGdprNotificationService();

const createDataDeletionConfirmHandler = ({ userModel, tokenLib = jwt, secret = requireEnv('JWT_SECRET'), oneTimeCodeService = defaultOneTimeCodeService } = {}) => {
  const resolvedUserModel = userModel || sequelize.models.user;

  const dataDeletionConfirm = async (req, res) => {
    try {
      console.log(`[AUTH] POST /me/data-deletion/confirm from ${req.ip}`, { token: getTokenFromCookie(req) ? 'present' : 'missing' });
      const token = getTokenFromCookie(req);
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const payload = tokenLib.verify(token, secret);
      if (!(await isSessionActive(token))) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const confirmationIdValidation = validateChallengeId(req.body?.confirmationId, 'confirmationId');
      if (!confirmationIdValidation.ok) return res.status(400).json({ error: confirmationIdValidation.error });

      const codeValidation = validateOtpCode(req.body?.code);
      if (!codeValidation.ok) return res.status(400).json({ error: codeValidation.error });

      const confirmationId = confirmationIdValidation.value;
      const code = codeValidation.value;

      const user = await resolvedUserModel.findByPk(payload.id, {
        attributes: ['id', 'login', 'email'],
      });

      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      await ensureSession({ token, user });

      const verification = await oneTimeCodeService.verifyChallenge({
        challengeId: confirmationId,
        recipient: user.email,
        purpose: 'data deletion',
        code,
      });

      if (!verification.ok) {
        return res.status(verification.statusCode || 400).json({
          error: verification.error,
          attemptsRemaining: verification.attemptsRemaining,
        });
      }

      if (String(verification.payload.userId) !== String(payload.id)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { asset, assetValuation, transaction, gdprExportQuota, gdprAuditEvent } = sequelize.models;
      const relatedAssetRows = await transaction.findAll({
        where: { userId: user.id },
        attributes: ['assetId'],
        group: ['assetId'],
        raw: true,
      });

      const assetIds = new Set();
      for (const row of relatedAssetRows) {
        if (row.assetId) {
          assetIds.add(row.assetId);
        }
      }

      const deletableAssetIds = [...assetIds];

      const deletionCounts = {
        transactions: await transaction.count({ where: { userId: user.id } }),
        valuations: deletableAssetIds.length ? await assetValuation.count({ where: { assetId: deletableAssetIds } }) : 0,
        assets: deletableAssetIds.length ? await asset.count({ where: { id: deletableAssetIds } }) : 0,
      };

      await sequelize.transaction(async (dbTransaction) => {
        await transaction.destroy({
          where: { userId: user.id },
          transaction: dbTransaction,
        });

        if (deletableAssetIds.length) {
          const survivingAssetRows = await transaction.findAll({
            where: { assetId: deletableAssetIds },
            attributes: ['assetId'],
            group: ['assetId'],
            raw: true,
            transaction: dbTransaction,
          });

          const survivingAssetIds = new Set(survivingAssetRows.map((row) => row.assetId));
          const orphanedAssetIds = deletableAssetIds.filter((assetId) => !survivingAssetIds.has(assetId));

          if (orphanedAssetIds.length) {
            await assetValuation.destroy({
              where: { assetId: orphanedAssetIds },
              transaction: dbTransaction,
            });

            await asset.destroy({
              where: { id: orphanedAssetIds },
              transaction: dbTransaction,
            });
          }
        }

        await gdprExportQuota.destroy({
          where: { userId: user.id },
          transaction: dbTransaction,
        });

        await gdprAuditEvent.destroy({
          where: { userId: user.id },
          transaction: dbTransaction,
        });

        await resolvedUserModel.destroy({
          where: { id: user.id },
          transaction: dbTransaction,
        });
      });

      await purgeSessionsForUser(user.id);
      clearAuthCookie(res);

      void gdprNotificationService.sendDataDeletionConfirmation({
        to: user.email,
        reference: verification.payload.reference || `deletion-${user.id}-${Date.now()}`,
      }).catch((err) => {
        console.error(`[AUTH] Data deletion notification error: ${err.message}`);
      });

      return res.json({
        deleted: true,
        loggedOut: true,
        message: 'Your data has been deleted.',
        deletedRecords: deletionCounts,
      });
    } catch (err) {
      console.error(`[AUTH] Data deletion confirm error: ${err.message}`);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  return { dataDeletionConfirm };
};

module.exports = { createDataDeletionConfirmHandler };