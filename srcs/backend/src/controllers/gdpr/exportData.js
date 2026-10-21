const sequelize = require('../../db');

const toPlain = (record) => (record && typeof record.get === 'function' ? record.get({ plain: true }) : record);

const serializeRows = (rows) => rows.map((row) => toPlain(row));

const buildGdprExportData = async (user) => {
  const models = sequelize.models;
  const userId = user?.id;

  if (!userId) {
    throw new Error('Missing user for GDPR export');
  }

  const [authSessions, oauthAccounts, oneTimeChallenges, oauthStateIntents, gdprExportQuota, gdprAuditEvents, documentsOwned, receivedShares] = await Promise.all([
    models.authSession?.findAll({
      where: { userId },
      attributes: ['token', 'userId', 'loginAt', 'lastSeenAt', 'expiresAt'],
      order: [['lastSeenAt', 'DESC']],
    }) || [],
    models.userOauthAccount?.findAll({
      where: { userId },
      attributes: [
        'id', 'userId', 'provider', 'providerUserId', 'email', 'emailVerified',
        'displayName', 'avatarUrl', 'accessTokenHash', 'refreshTokenHash',
        'createdAt', 'updatedAt',
      ],
      order: [['createdAt', 'ASC']],
    }) || [],
    models.oneTimeChallenge?.findAll({
      where: { userId },
      attributes: [
        'challengeId', 'userId', 'purpose', 'recipient', 'payload',
        'attemptsRemaining', 'expiresAt', 'createdAt', 'updatedAt',
      ],
      order: [['createdAt', 'ASC']],
    }) || [],
    models.oauthStateIntent?.findAll({
      where: { userId },
      attributes: ['stateId', 'userId', 'provider', 'mode', 'next', 'nonce', 'expiresAt', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'ASC']],
    }) || [],
    models.gdprExportQuota?.findByPk(userId, {
      attributes: ['userId', 'windowStartAt', 'exportCount', 'lastExportAt'],
    }) || null,
    models.gdprAuditEvent?.findAll({
      where: { userId },
      attributes: ['id', 'userId', 'actionType', 'status', 'reference', 'ipAddress', 'userAgent', 'metadata', 'eventAt'],
      order: [['eventAt', 'ASC']],
    }) || [],
    models.document?.findAll({
      where: { ownerId: userId },
      attributes: ['id', 'title', 'content', 'ownerId', 'createdAt', 'updatedAt'],
      include: [{
        model: models.documentShare,
        as: 'shares',
        attributes: ['id', 'documentId', 'userId', 'permission', 'createdAt', 'updatedAt'],
      }],
      order: [['createdAt', 'ASC']],
    }) || [],
    models.documentShare?.findAll({
      where: { userId },
      attributes: ['id', 'documentId', 'userId', 'permission', 'createdAt', 'updatedAt'],
      include: [{
        model: models.document,
        attributes: ['id', 'title', 'content', 'ownerId', 'createdAt', 'updatedAt'],
      }],
      order: [['createdAt', 'ASC']],
    }) || [],
  ]);

  return {
    exportDate: new Date().toISOString(),
    userData: {
      profile: {
        id: user.id,
        login: user.login,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      authSessions: serializeRows(authSessions),
      oauthAccounts: serializeRows(oauthAccounts),
      oneTimeChallenges: serializeRows(oneTimeChallenges),
      oauthStateIntents: serializeRows(oauthStateIntents),
      gdprExportQuota: toPlain(gdprExportQuota),
      gdprAuditEvents: serializeRows(gdprAuditEvents),
      documentsOwned: serializeRows(documentsOwned),
      documentSharesReceived: serializeRows(receivedShares),
    },
  };
};

const csvEscape = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const normalized = value instanceof Date ? value.toISOString() : String(value);
  const sanitized = /^\s*[=+\-@\t]/.test(normalized) ? `'${normalized}` : normalized;
  const escaped = sanitized.replace(/"/g, '""').replace(/\r\n|\n|\r/g, '\\n');
  return `"${escaped}"`;
};

const pushCsvRows = (rows, section, value, fieldPath = '') => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      rows.push([section, fieldPath || 'items', '[]']);
      return;
    }

    value.forEach((item, index) => {
      pushCsvRows(rows, section, item, fieldPath ? `${fieldPath}.${index}` : String(index));
    });
    return;
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      rows.push([section, fieldPath || 'value', '{}']);
      return;
    }

    entries.forEach(([key, nestedValue]) => {
      pushCsvRows(rows, section, nestedValue, fieldPath ? `${fieldPath}.${key}` : key);
    });
    return;
  }

  rows.push([section, fieldPath || 'value', value]);
};

const buildGdprExportCsv = (exportData) => {
  const rows = [['section', 'field', 'value']];
  pushCsvRows(rows, 'meta', { exportDate: exportData.exportDate });
  pushCsvRows(rows, 'profile', exportData.userData.profile);
  pushCsvRows(rows, 'authSessions', exportData.userData.authSessions);
  pushCsvRows(rows, 'oauthAccounts', exportData.userData.oauthAccounts);
  pushCsvRows(rows, 'oneTimeChallenges', exportData.userData.oneTimeChallenges);
  pushCsvRows(rows, 'oauthStateIntents', exportData.userData.oauthStateIntents);
  pushCsvRows(rows, 'gdprExportQuota', exportData.userData.gdprExportQuota);
  pushCsvRows(rows, 'gdprAuditEvents', exportData.userData.gdprAuditEvents);
  pushCsvRows(rows, 'documentsOwned', exportData.userData.documentsOwned);
  pushCsvRows(rows, 'documentSharesReceived', exportData.userData.documentSharesReceived);

  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
};

module.exports = {
  buildGdprExportData,
  buildGdprExportCsv,
};