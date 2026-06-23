const bcrypt = require('bcrypt');
const { randomInt, randomUUID } = require('crypto');
const { requireNumberEnv } = require('../config');
const sequelize = require('../db');

const CODE_HASH_ROUNDS = requireNumberEnv('BCRYPT_SALT_ROUNDS');

const normalizeRecipient = (value) => String(value || '').trim().toLowerCase();
const normalizeCode = (value) => String(value || '').trim();
const buildPurposeLabel = (purpose) => String(purpose || 'confirmation').trim();

const defaultTextBuilder = ({ code, purposeLabel, expiresInMinutes, attemptsRemaining }) => (
  [
    `Your ${purposeLabel} code is ${code}.`,
    `It expires in ${expiresInMinutes} minute(s).`,
    `You have ${attemptsRemaining} attempt(s) to enter it correctly.`,
  ].join(' ')
);

const createOneTimeCodeService = ({
  emailService,
  codeLength = Number(process.env.ONE_TIME_CODE_LENGTH) || 6,
  maxAttempts = Number(process.env.ONE_TIME_CODE_MAX_ATTEMPTS) || 3,
  ttlMs = Number(process.env.ONE_TIME_CODE_TTL_MS) || 10 * 60 * 1000,
} = {}) => {
  if (!emailService) {
    throw new Error('createOneTimeCodeService requires an emailService');
  }

  const getChallengeModel = () => sequelize.models.oneTimeChallenge;

  const cleanupExpiredChallenges = async () => {
    const challengeModel = getChallengeModel();
    if (!challengeModel) {
      return;
    }

    await challengeModel.destroy({
      where: {
        expiresAt: {
          [sequelize.Sequelize.Op.lte]: new Date(),
        },
      },
    });
  };

  const buildCode = () => randomInt(0, 10 ** codeLength).toString().padStart(codeLength, '0');

  const issueChallenge = async ({
    purpose,
    recipient,
    subject,
    textBuilder,
    htmlBuilder,
    payload = {},
  }) => {
    await cleanupExpiredChallenges();

    const challengeModel = getChallengeModel();
    if (!challengeModel) {
      throw new Error('One-time challenge storage is not available');
    }

    const challengeId = randomUUID();
    const code = buildCode();
    const expiresAt = Date.now() + ttlMs;
    const codeHash = await bcrypt.hash(code, CODE_HASH_ROUNDS);
    const normalizedRecipient = normalizeRecipient(recipient);

    await challengeModel.create({
      challengeId,
      userId: payload?.userId || null,
      purpose,
      recipient: normalizedRecipient,
      codeHash,
      payload,
      attemptsRemaining: maxAttempts,
      expiresAt: new Date(expiresAt),
    });

    const context = {
      code,
      purpose,
      purposeLabel: buildPurposeLabel(purpose),
      recipient: normalizedRecipient,
      expiresAt,
      expiresInMinutes: Math.max(1, Math.ceil(ttlMs / 60000)),
      attemptsRemaining: maxAttempts,
    };

    await emailService.sendEmail({
      to: recipient,
      subject: subject || `Your ${context.purposeLabel} code`,
      text: textBuilder ? textBuilder(context) : defaultTextBuilder(context),
      html: htmlBuilder ? htmlBuilder(context) : undefined,
    });

    return {
      challengeId,
      expiresAt,
      attemptsRemaining: maxAttempts,
      codeLength,
      debugCode: emailService.transportMode === 'console' ? code : undefined,
    };
  };

  const verifyChallenge = async ({ challengeId, recipient, purpose, code }) => {
    await cleanupExpiredChallenges();

    const challengeModel = getChallengeModel();
    if (!challengeModel) {
      return {
        ok: false,
        statusCode: 500,
        error: 'Confirmation service unavailable',
      };
    }

    return sequelize.transaction(async (dbTransaction) => {
      const challenge = await challengeModel.findByPk(challengeId, {
        transaction: dbTransaction,
        lock: dbTransaction.LOCK.UPDATE,
      });

      if (!challenge) {
        return {
          ok: false,
          statusCode: 410,
          error: 'Confirmation code expired or was not found',
        };
      }

      if (challenge.purpose !== purpose) {
        return {
          ok: false,
          statusCode: 400,
          error: 'Confirmation code purpose mismatch',
        };
      }

      if (challenge.recipient !== normalizeRecipient(recipient)) {
        return {
          ok: false,
          statusCode: 400,
          error: 'Confirmation code recipient mismatch',
        };
      }

      if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
        await challenge.destroy({ transaction: dbTransaction });
        return {
          ok: false,
          statusCode: 410,
          error: 'Confirmation code expired',
        };
      }

      const isMatch = await bcrypt.compare(normalizeCode(code), challenge.codeHash);

      if (!isMatch) {
        challenge.attemptsRemaining -= 1;

        if (challenge.attemptsRemaining <= 0) {
          await challenge.destroy({ transaction: dbTransaction });
          return {
            ok: false,
            statusCode: 401,
            error: 'Invalid code. Confirmation cancelled after maximum failed attempts.',
            attemptsRemaining: 0,
          };
        }

        await challenge.save({ transaction: dbTransaction });
        return {
          ok: false,
          statusCode: 401,
          error: `Invalid code. ${challenge.attemptsRemaining} attempt(s) remaining.`,
          attemptsRemaining: challenge.attemptsRemaining,
        };
      }

      const payload = challenge.payload;
      await challenge.destroy({ transaction: dbTransaction });
      return {
        ok: true,
        payload,
      };
    });
  };

  setInterval(() => {
    void cleanupExpiredChallenges();
  }, 60_000).unref?.();

  return {
    issueChallenge,
    verifyChallenge,
    cleanupExpiredChallenges,
  };
};

module.exports = { createOneTimeCodeService };