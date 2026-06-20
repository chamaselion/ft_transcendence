const sequelize = require('../../db');

const buildAuditMetadata = ({ ipAddress, userAgent, ...rest } = {}) => ({
  ipAddress: ipAddress || null,
  userAgent: userAgent || null,
  ...rest,
});

const recordGdprAuditEvent = async ({
  userId,
  actionType,
  status,
  reference = null,
  ipAddress = null,
  userAgent = null,
  metadata = {},
  eventAt = new Date(),
} = {}) => {
  try {
    const auditModel = sequelize.models.gdprAuditEvent;
    if (!auditModel || !userId || !actionType || !status) {
      return null;
    }

    return await auditModel.create({
      userId,
      actionType,
      status,
      reference,
      ipAddress,
      userAgent,
      metadata: buildAuditMetadata({ ipAddress, userAgent, ...metadata }),
      eventAt,
    });
  } catch (err) {
    console.error(`[GDPR] Audit logging failed: ${err.message}`);
    return null;
  }
};

module.exports = { recordGdprAuditEvent };